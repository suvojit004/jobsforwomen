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

  // CONFIRMED BUG (fixed alongside app.ts's trust-proxy config): this used to
  // fall back to the raw x-forwarded-for request header when req.ip was
  // falsy. That header is fully client-controlled input -- a request can send
  // any X-Forwarded-For value it likes, so keying the rate limiter off it
  // directly would let a client trivially pick a fresh "IP" on every request
  // to dodge the limiter entirely, or frame another user by supplying their
  // IP. Now that app.ts sets `trust proxy` to the correct single-hop value
  // for this deployment, req.ip is Express's own vetted computation (it reads
  // X-Forwarded-For but only trusts it up to the configured proxy count), so
  // it's the only source used here -- no direct header fallback.
  const ip = req.ip || "unknown_ip"
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
