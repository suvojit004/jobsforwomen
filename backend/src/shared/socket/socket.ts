import { Server, Socket } from "socket.io"
import type { Server as HttpServer } from "http"
import jwt from "jsonwebtoken"
import { createAdapter } from "@socket.io/redis-adapter"
import env from "../config/env"
import { logger } from "../utils/logger"
import redis from "../utils/redis"
import prisma from "../database/db"

export let io: Server

// Whether Socket.IO is running with the Redis adapter (real cross-instance
// fanout) or has fallen back to the in-memory adapter. Exposed so System
// Health reports the real state instead of assuming Redis is wired up just
// because REDIS_URL is set. "redis" = attached; "memory" = test mode,
// single-process only; "error" = Redis expected but unavailable/failed to
// attach, so production is silently single-instance-only.
export let socketAdapterStatus: "redis" | "memory" | "error" = "memory"

// Observable performance metrics in-memory hook
export const socketMetrics = {
  connectedCandidates: 0,
  connectedRecruiters: 0,
  connectedAdmins: 0,
  messagesSec: 0,
  notificationsSec: 0,
  totalEventsProcessed: 0,
}

// Reset rate limits statistics periodically
if (process.env.NODE_ENV !== "test") {
  setInterval(() => {
    socketMetrics.messagesSec = 0
    socketMetrics.notificationsSec = 0
  }, 1000)
}

// Kept in sync with app.ts's CORS allowlist -- these must not diverge, or
// Socket.IO handshakes and REST requests from the same production frontend
// could be accepted/rejected inconsistently.
const allowedOrigins = Array.from(
  new Set(
    [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://jobs-for-women-ob43.vercel.app",
      env.CLIENT_URL,
      env.FRONTEND_URL,
    ].filter((origin): origin is string => Boolean(origin))
  )
)

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Connection recovery configurations for network reliability
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  })

  // Redis adapter for cross-instance fanout: without it, Socket.IO's default
  // in-memory adapter only reaches sockets connected to this specific
  // process, so a multi-instance deployment would silently drop broadcasts
  // between users on different instances. Uses the existing ioredis client
  // (shared/utils/redis.ts) -- Upstash's `rediss://` endpoint speaks the
  // standard Redis wire protocol, so PUBLISH/SUBSCRIBE works as expected.
  // Skipped in test mode since Jest runs a bare in-process server with no
  // real Redis connection.
  if (env.NODE_ENV !== "test") {
    if (redis) {
      try {
        const pubClient = redis.duplicate()
        const subClient = redis.duplicate()

        // ioredis emits an unhandled "error" event (which crashes the
        // process if nothing is listening) on connection failure -- these
        // mirror the same graceful-degradation logging already used on the
        // base `redis` client in shared/utils/redis.ts.
        pubClient.on("error", (err: Error) => {
          logger.warn(`[SocketIO:RedisAdapter] pubClient error: ${err.message}`)
        })
        subClient.on("error", (err: Error) => {
          logger.warn(`[SocketIO:RedisAdapter] subClient error: ${err.message}`)
        })

        io.adapter(createAdapter(pubClient, subClient))
        socketAdapterStatus = "redis"
        logger.info(
          "[SocketIO] Redis adapter attached -- events now fan out across all server instances via Upstash Redis pub/sub."
        )
      } catch (err: any) {
        socketAdapterStatus = "error"
        logger.error(
          `[SocketIO] Failed to attach Redis adapter -- falling back to in-memory adapter (no cross-instance fanout): ${err.message}`
        )
      }
    } else {
      socketAdapterStatus = "error"
      logger.error(
        "[SocketIO] Redis client unavailable -- Socket.IO running with in-memory adapter only (no cross-instance fanout)."
      )
    }
  }

  // Handshake Authentication Middleware
  const authMiddleware = (socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token || socket.handshake.headers["authorization"]
    if (!token) {
      logger.warn(`[SocketIO] Connection rejected: Token missing. Socket ID: ${socket.id}`)
      return next(new Error("Authentication error: Token missing"))
    }

    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token
    try {
      const decoded = jwt.verify(cleanToken, env.JWT_ACCESS_SECRET) as any
      socket.data.user = decoded
      next()
    } catch (err: any) {
      logger.warn(`[SocketIO] Connection rejected: Invalid Token. Error: ${err.message}`)
      return next(new Error("Authentication error: Invalid Token"))
    }
  }

  // Define namespaces
  const candidateNamespace = io.of("/candidate")
  const recruiterNamespace = io.of("/recruiter")
  const adminNamespace = io.of("/admin")

  // Apply Auth Middleware to all namespaces
  candidateNamespace.use(authMiddleware)
  recruiterNamespace.use(authMiddleware)
  adminNamespace.use(authMiddleware)

  // Generic presence and listener registry
  const registerCommonListeners = (socket: Socket, namespaceName: string, metricKey: "connectedCandidates" | "connectedRecruiters" | "connectedAdmins") => {
    const user = socket.data.user
    
    // Increment active count
    socketMetrics[metricKey]++
    
    // Add to Redis Presence tracking Set
    if (redis && redis.status === "ready") {
      redis.sadd("online_users", user.userId).catch((err) => {
        logger.error(`[SocketIO:Presence] Failed to add user ${user.userId} to Redis presence: ${err.message}`)
      })
    }

    // Join personal user room
    socket.join(`user:${user.userId}`)

    // 1. Rate limiting middleware per socket connection (max 15 events / 5 seconds)
    let userEventsCount = 0
    socket.use((packet, next) => {
      userEventsCount++
      socketMetrics.totalEventsProcessed++
      setTimeout(() => {
        userEventsCount = Math.max(0, userEventsCount - 1)
      }, 5000)

      if (userEventsCount > 15) {
        logger.warn(`[SocketIO:RateLimit] Rate limit exceeded for socket ${socket.id} (user: ${user.email})`)
        return next(new Error("Rate limit exceeded"))
      }
      next()
    })

    // 2. Typing Indicators within Conversations Room
    //
    // NOTE: rooms are scoped per-namespace in Socket.IO, but a conversation's
    // two participants are frequently connected on *different* namespaces
    // (a Candidate on /candidate, a Recruiter on /recruiter). socket.to(room)
    // only reaches sockets in the same namespace, so a candidate typing would
    // never reach the recruiter on the other end. Broadcast across all three
    // namespaces instead, excluding the sender's own socket.
    socket.on("typing", (data: { conversationId: string; isTyping: boolean }) => {
      socketMetrics.messagesSec++
      const room = `conversation:${data.conversationId}`
      // conversationId must travel with the payload -- a client can be joined
      // to more than one conversation room at once (it never explicitly
      // leaves old rooms), so without this the receiver can't tell which
      // conversation a "typing" event actually belongs to.
      const payload = { conversationId: data.conversationId, userId: user.userId, isTyping: data.isTyping }
      io.of("/candidate").to(room).except(socket.id).emit("typing", payload)
      io.of("/recruiter").to(room).except(socket.id).emit("typing", payload)
      io.of("/admin").to(room).except(socket.id).emit("typing", payload)
    })

    // 3. Message Read Acknowledgements (Read receipts)
    socket.on("message:read", (data: { conversationId: string; messageId: string }) => {
      socketMetrics.messagesSec++
      const room = `conversation:${data.conversationId}`
      const payload = { conversationId: data.conversationId, userId: user.userId, messageId: data.messageId }
      io.of("/candidate").to(room).except(socket.id).emit("message:read", payload)
      io.of("/recruiter").to(room).except(socket.id).emit("message:read", payload)
      io.of("/admin").to(room).except(socket.id).emit("message:read", payload)
    })

    // Explicit room departure so a socket doesn't stay subscribed to stale
    // conversation rooms (and their typing/read-receipt events) after the
    // client navigates to a different conversation.
    socket.on("leave:conversation", (data: { conversationId: string }) => {
      socket.leave(`conversation:${data.conversationId}`)
      logger.debug(`[SocketIO] Socket ${socket.id} left conversation room: ${data.conversationId}`)
    })

    // 4. Safe room subscription join
    // Previously this joined ANY conversationId the client sent with no check
    // at all -- any authenticated socket could join any conversation's room
    // and receive its typing/read-receipt events just by guessing an ID. Now
    // verifies real participation first.
    socket.on("join:conversation", async (data: { conversationId: string }) => {
      try {
        const participant = await prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: { conversationId: data.conversationId, userId: user.userId },
          },
        })
        if (!participant) {
          logger.warn(
            `[SocketIO] Rejected join:conversation -- user ${user.email} is not a participant of ${data.conversationId}`
          )
          socket.emit("error", { message: "Not authorized to join this conversation" })
          return
        }
        socket.join(`conversation:${data.conversationId}`)
        logger.debug(`[SocketIO] Socket ${socket.id} joined conversation room: ${data.conversationId}`)
      } catch (err: any) {
        logger.error(`[SocketIO] join:conversation check failed: ${err.message}`)
      }
    })

    // Handle clean disconnect
    socket.on("disconnect", () => {
      socketMetrics[metricKey] = Math.max(0, socketMetrics[metricKey] - 1)
      if (redis && redis.status === "ready") {
        redis.srem("online_users", user.userId).catch((err) => {
          logger.error(`[SocketIO:Presence] Failed to remove user ${user.userId} from Redis: ${err.message}`)
        })
      }
      logger.info(`[SocketIO:${namespaceName}] User ${user.email} disconnected. Sockets count: ${socketMetrics[metricKey]}`)
    })
  }

  // 1. Candidate Namespace Connect
  candidateNamespace.on("connection", (socket) => {
    const user = socket.data.user
    if (!user.roles.includes("Candidate")) {
      socket.disconnect(true)
      return
    }
    logger.info(`[SocketIO:candidate] Candidate ${user.email} connected.`)
    registerCommonListeners(socket, "candidate", "connectedCandidates")
  })

  // 2. Recruiter Namespace Connect
  recruiterNamespace.on("connection", (socket) => {
    const user = socket.data.user
    if (!user.roles.includes("Recruiter")) {
      socket.disconnect(true)
      return
    }
    logger.info(`[SocketIO:recruiter] Recruiter ${user.email} connected.`)
    registerCommonListeners(socket, "recruiter", "connectedRecruiters")
    if (user.companyId) {
      socket.join(`company:${user.companyId}`)
    }
  })

  // 3. Admin Namespace Connect
  adminNamespace.on("connection", (socket) => {
    const user = socket.data.user
    const adminRoles = ["Super Admin", "Admin", "Moderator", "Support Executive"]
    const hasAdminRole = user.roles.some((r: string) => adminRoles.includes(r))

    if (!hasAdminRole) {
      socket.disconnect(true)
      return
    }
    logger.info(`[SocketIO:admin] Admin ${user.email} connected.`)
    registerCommonListeners(socket, "admin", "connectedAdmins")
  })
}

/**
 * Emit real-time notification to user personal room across namespaces.
 */
export function sendRealTimeNotification(userId: string, notification: any) {
  if (!io) {
    logger.warn("[SocketIO] Server not initialized. Skipping real-time notification.")
    return
  }

  socketMetrics.notificationsSec++
  logger.info(`[SocketIO] Emitting real-time notification to user:${userId}`)
  io.of("/candidate").to(`user:${userId}`).emit("notification", notification)
  io.of("/recruiter").to(`user:${userId}`).emit("notification", notification)
  io.of("/admin").to(`user:${userId}`).emit("notification", notification)
}

export default {
  initSocket,
  sendRealTimeNotification,
  socketMetrics,
  get socketAdapterStatus() {
    return socketAdapterStatus
  },
}
