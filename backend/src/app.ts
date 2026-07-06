import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"

import { requestId } from "./shared/middleware/requestId"
import { errorHandler } from "./shared/middleware/errorHandler"
import { logger } from "./shared/utils/logger"
import { sendSuccess } from "./shared/utils/response"
import prisma from "./shared/database/db"

// Import EventBus Listeners
import { initAuditListener } from "./shared/listeners/audit.listener"
import { initNotificationListener } from "./shared/listeners/notification.listener"
import { initEmailListener } from "./shared/listeners/email.listener"

const app = express()

// Initialize in-memory listeners
initAuditListener()
initNotificationListener()
initEmailListener()

import { rateLimitMiddleware } from "./shared/middleware/rateLimit.middleware"

// Safety Headers & CORS Policy
app.use(helmet())
app.use(rateLimitMiddleware)
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
  })
)

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

// Swagger API Documentation routes mount
import { serveSwaggerJson, serveSwaggerUi } from "./shared/utils/swagger"
app.get("/api/v1/api-docs.json", serveSwaggerJson)
app.get("/api/v1/api-docs", serveSwaggerUi)

// Email Delivery Observability Webhooks
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
        metadata: req.body,
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
        metadata: req.body,
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
import { cloudinaryMetrics } from "./shared/utils/cloudinary"

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
    cloudinary: cloudinaryMetrics,
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
