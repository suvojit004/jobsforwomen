import type { Request, Response, NextFunction } from "express"
import { redis } from "../utils/redis"
import { sendError } from "../utils/response"
import { logger } from "../utils/logger"

const memoryTracker = new Map<string, { count: number; resetTime: number }>()

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  // Bypass rate limiting in test mode to facilitate test suite executions
  if (process.env.NODE_ENV === "test") {
    return next()
  }

  const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "unknown_ip"
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute window
  const maxRequests = 100 // max 100 requests per minute

  if (redis && redis.status === "ready") {
    const key = `ratelimit:${ip}`
    try {
      const current = await redis.incr(key)
      if (current === 1) {
        await redis.expire(key, 60)
      }
      if (current > maxRequests) {
        logger.warn(`[RateLimit] Rate limit exceeded for IP: ${ip}`)
        return sendError(res, "Too many requests. Please try again later.", null, 429)
      }
    } catch (err: any) {
      logger.error(`[RateLimit] Redis command failed: ${err.message}. Falling back to memory.`)
    }
  }

  // In-memory fallback tracking
  const tracker = memoryTracker.get(ip)
  if (!tracker || now > tracker.resetTime) {
    memoryTracker.set(ip, { count: 1, resetTime: now + windowMs })
  } else {
    tracker.count++
    if (tracker.count > maxRequests) {
      logger.warn(`[RateLimit] In-memory limit exceeded for IP: ${ip}`)
      return sendError(res, "Too many requests. Please try again later.", null, 429)
    }
  }

  next()
}

export default rateLimitMiddleware
