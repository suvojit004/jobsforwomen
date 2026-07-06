import { Server, Socket } from "socket.io"
import type { Server as HttpServer } from "http"
import jwt from "jsonwebtoken"
import env from "../config/env"
import { logger } from "../utils/logger"
import redis from "../utils/redis"

export let io: Server

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

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://jobs-for-women-ob43-nl39b4npa.vercel.app",
]

if (env.CLIENT_URL) {
  allowedOrigins.push(env.CLIENT_URL)
}

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
    socket.on("typing", (data: { conversationId: string; isTyping: boolean }) => {
      socketMetrics.messagesSec++
      socket.to(`conversation:${data.conversationId}`).emit("typing", {
        userId: user.userId,
        isTyping: data.isTyping,
      })
    })

    // 3. Message Read Acknowledgements (Read receipts)
    socket.on("message:read", (data: { conversationId: string; messageId: string }) => {
      socketMetrics.messagesSec++
      socket.to(`conversation:${data.conversationId}`).emit("message:read", {
        userId: user.userId,
        messageId: data.messageId,
      })
    })

    // 4. Safe room subscription join
    socket.on("join:conversation", (data: { conversationId: string }) => {
      socket.join(`conversation:${data.conversationId}`)
      logger.debug(`[SocketIO] Socket ${socket.id} joined conversation room: ${data.conversationId}`)
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
}
