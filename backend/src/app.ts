import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"

import { requestId } from "./shared/middleware/requestId"
import { errorHandler } from "./shared/middleware/errorHandler"
import { logger } from "./shared/utils/logger"
import { sendSuccess } from "./shared/utils/response"
import prisma from "./shared/database/db"
import env from "./shared/config/env"

// Import EventBus Listeners
import { initAuditListener } from "./shared/listeners/audit.listener"
import { initNotificationListener } from "./shared/listeners/notification.listener"
import { initEmailListener } from "./shared/listeners/email.listener"

const app = express()

// Trust the Render reverse proxy for exactly one hop, so req.ip resolves to
// the real client IP (used by the per-IP rate limiter and audit logging)
// instead of the proxy's own address. `1`, not `true`: trusting every hop
// would let a client forge X-Forwarded-For and spoof their IP.
const trustProxyHops = process.env.NODE_ENV === "production" ? 1 : false
app.set("trust proxy", trustProxyHops)

// Initialize in-memory listeners
initAuditListener()
initNotificationListener()
initEmailListener()

import { rateLimitMiddleware } from "./shared/middleware/rateLimit.middleware"

// Safety Headers & CORS Policy
app.use(helmet())
app.use(rateLimitMiddleware)

const allowedOrigins = new Set(
  [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://jobs-for-women-ob43.vercel.app",
    env.CLIENT_URL,
    env.FRONTEND_URL,
  ].filter((origin): origin is string => Boolean(origin))
)

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header:
    // Postman, curl, health checks, server-to-server requests
    if (!origin) {
      return callback(null, true)
    }

    if (allowedOrigins.has(origin)) {
      return callback(null, true)
    }

    logger.warn(`[CORS] Blocked origin: ${origin}`)
    return callback(null, false)
  },

  credentials: true,

  methods: [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-request-id",
  ],

  optionsSuccessStatus: 204,
}

app.use(cors(corsOptions))

// Request Trace & Logging
app.use(requestId)
const morganFormat = process.env.NODE_ENV === "production" ? "combined" : "dev"
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message: string) => logger.http(message.trim()),
    },
  })
)

// Parsers
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Custom Cookie Parser middleware
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie
  const cookies: Record<string, string> = {}
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const parts = cookie.split("=")
      const name = parts[0]?.trim()
      const val = parts[1]?.trim()
      if (name && val) {
        cookies[name] = decodeURIComponent(val)
      }
    })
  }
  ;(req as any).cookies = cookies
  next()
})

// Authentication Routes mount
import authRouter from "./modules/auth/auth.routes"
app.use("/api/v1/auth", authRouter)

// RBAC Routes mount
import rbacRouter from "./modules/rbac/rbac.routes"
app.use("/api/v1/rbac", rbacRouter)

// Candidate Routes mount
import candidateRouter from "./modules/candidate/candidate.routes"
app.use("/api/v1/candidates", candidateRouter)

// Recruiter Routes mount
import recruiterRouter from "./modules/recruiter/recruiter.routes"
app.use("/api/v1/recruiters", recruiterRouter)

// Admin Routes mount
import adminRouter from "./modules/admin/admin.routes"
app.use("/api/v1/admins", adminRouter)

// Company Verification Routes mount (public, token-authenticated -- Part 3
// of the recruiter onboarding/approval spec). Deliberately not behind
// authenticateToken: see company-verification.routes.ts.
import companyVerificationRouter from "./modules/company-verification/company-verification.routes"
app.use("/api/v1/company-verification", companyVerificationRouter)

// Local-disk file storage delivery route (replaces Cloudinary asset URLs).
import filesRouter from "./shared/routes/files.routes"
app.use("/files", filesRouter)

// Swagger API Documentation routes mount
import { serveSwaggerJson, serveSwaggerUi } from "./shared/utils/swagger"
app.get("/api/v1/api-docs.json", serveSwaggerJson)
app.get("/api/v1/api-docs", serveSwaggerUi)

// Email Delivery Observability
//
// AWS SNS endpoint receiving real SES bounce/complaint/delivery events. Must
// be mounted BEFORE the generic webhooks below, and brings its own raw body
// parser because SNS posts text/plain, which express.json() ignores.
import snsRouter from "./shared/routes/sns.routes"
app.use("/api/v1/emails", snsRouter)

// Generic provider-agnostic webhooks, retained for manual testing and any
// non-SES sender. SES itself delivers to /api/v1/emails/sns above.
import { emailMetrics } from "./shared/utils/email"
app.post("/api/v1/emails/bounce", async (req, res) => {
  const { email, type } = req.body || {}
  emailMetrics.bounced++
  logger.warn(`[EmailWebhook] Email bounced: ${email} | Type: ${type}`)
  try {
    await prisma.auditLog.create({
      data: {
        category: "SYSTEM",
        action: "EMAIL_BOUNCED",
        entity: "Email",
        entityId: email || "unknown",
        // AuditLog has no `metadata` column -- it exposes oldValue/newValue
        // (both Json?). Writing `metadata` threw PrismaClientValidationError
        // at runtime, swallowed by the catch below, so these rows were never
        // actually persisted.
        newValue: req.body,
        timestamp: new Date(),
      },
    })
  } catch (err: any) {
    logger.error(`Failed to log bounce audit: ${err.message}`)
  }
  return res.status(200).json({ success: true })
})

app.post("/api/v1/emails/complaint", async (req, res) => {
  const { email } = req.body || {}
  logger.warn(`[EmailWebhook] Email complaint registered for: ${email}`)
  try {
    await prisma.auditLog.create({
      data: {
        category: "SYSTEM",
        action: "EMAIL_COMPLAINT",
        entity: "Email",
        entityId: email || "unknown",
        // AuditLog has no `metadata` column -- it exposes oldValue/newValue
        // (both Json?). Writing `metadata` threw PrismaClientValidationError
        // at runtime, swallowed by the catch below, so these rows were never
        // actually persisted.
        newValue: req.body,
        timestamp: new Date(),
      },
    })
  } catch (err: any) {
    logger.error(`Failed to log complaint audit: ${err.message}`)
  }
  return res.status(200).json({ success: true })
})

// Health check endpoint
import { socketMetrics } from "./shared/socket/socket"
import { queueMetrics } from "./shared/queue/queue"
import { storageMetrics } from "./shared/utils/fileStorage"

app.get("/health", async (req, res) => {
  logger.debug("System health check triggered")
  
  const dbStart = Date.now()
  let dbStatus = "UP"
  let dbLatency = 0
  try {
    await prisma.$queryRaw`SELECT 1`
    dbLatency = Date.now() - dbStart
  } catch (err) {
    dbStatus = "DOWN"
  }

  return sendSuccess(res, {
    status: dbStatus === "UP" ? "UP" : "DEGRADED",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latencyMs: dbLatency,
    },
    sockets: socketMetrics,
    queues: queueMetrics,
    storage: storageMetrics,
    email: emailMetrics,
  }, "System is healthy")
})

// Liveness probe
app.get("/live", (req, res) => {
  return res.status(200).send("Live")
})

// Readiness probe
app.get("/ready", async (req, res) => {
  try {
    // Check DB
    await prisma.$queryRaw`SELECT 1`
    return res.status(200).send("Ready")
  } catch (err: any) {
    logger.error(`[ReadinessCheck] Database DOWN: ${err.message}`)
    return res.status(503).send("Service Unavailable")
  }
})

// Version endpoint
app.get("/version", (req, res) => {
  return res.status(200).json({ version: "1.0.0" })
})

app.use((req, res) => {
  logger.warn(`Resource not found for ${req.method} ${req.baseUrl || req.originalUrl}`)
  res.status(404).json({
    success: false,
    message: "Resource not found",
  })
})

// Catch-all Error Middleware
app.use(errorHandler)

export default app
