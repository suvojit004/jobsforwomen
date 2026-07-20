import type { Request, Response, NextFunction } from "express"
import { redis } from "../utils/redis"
import { sendError } from "../utils/response"
import { logger } from "../utils/logger"
import env from "../config/env"

const memoryTracker = new Map<string, { count: number; resetTime: number }>()

export interface RateLimiterOptions {
  windowMs: number
  max: number
  // Distinguishes buckets across limiter tiers -- without this, a request
  // that legitimately passes the "candidate" tier and the "global" tier
  // would collide on the same IP/user key and share one counter, which is
  // not what stacking a route-group limiter on top of the global one is
  // supposed to mean.
  keyPrefix: string
  // When true, key off the authenticated user's id (set by the JWT auth
  // middleware upstream) instead of the IP, falling back to IP if the
  // request somehow reaches this limiter unauthenticated. Appropriate for
  // route groups that are always behind auth (admin/recruiter/candidate/
  // uploads) -- keying by IP there would let one abusive user behind a
  // shared/NAT'd IP (an office, a mobile carrier) degrade service for
  // everyone else on that address, and would let a single user dodge the
  // limiter just by roaming IPs.
  useUserId?: boolean
}

function resolveIdentity(req: Request, opts: RateLimiterOptions): string {
  const userId = opts.useUserId ? (req as any).user?.userId : undefined
  return userId || req.ip || "unknown_ip"
}

/**
 * Builds a rate-limiting middleware for one tier (auth, admin, recruiter,
 * candidate, uploads, search, or the global default). Redis-backed when
 * available (works correctly across multiple server instances/dynos, since
 * the counter lives in a shared store); falls back to an in-process Map
 * when Redis is unreachable so the app degrades to "rate limiting only
 * within this instance" instead of failing open or hard-crashing requests.
 */
export function createRateLimiter(opts: RateLimiterOptions) {
  return async function rateLimiter(req: Request, res: Response, next: NextFunction) {
    // Bypass rate limiting in test mode to facilitate test suite executions.
    if (process.env.NODE_ENV === "test") {
      return next()
    }

    const identity = resolveIdentity(req, opts)
    const key = `ratelimit:${opts.keyPrefix}:${identity}`
    const now = Date.now()
    const windowSeconds = Math.max(1, Math.ceil(opts.windowMs / 1000))

    const setHeader = (name: string, value: string) => {
      if (typeof res.setHeader === "function") {
        res.setHeader(name, value)
      }
    }

    const applyHeaders = (remaining: number, resetAtMs: number) => {
      setHeader("X-RateLimit-Limit", String(opts.max))
      setHeader("X-RateLimit-Remaining", String(Math.max(0, remaining)))
      setHeader("X-RateLimit-Reset", String(Math.ceil(resetAtMs / 1000)))
    }

    const reject = (retryAfterSeconds: number) => {
      setHeader("Retry-After", String(Math.max(1, retryAfterSeconds)))
      logger.warn(`[RateLimit:${opts.keyPrefix}] Limit exceeded for: ${identity}`)
      return sendError(res, "Too many requests. Please try again later.", null, 429)
    }

    if (redis && redis.status === "ready") {
      try {
        const current = await redis.incr(key)
        if (current === 1) {
          await redis.expire(key, windowSeconds)
        }
        // TTL lookup is best-effort -- if it fails for any reason, fall back
        // to the full window so headers/Retry-After stay sane rather than
        // throwing and losing the whole request.
        let ttl = windowSeconds
        try {
          const rawTtl = await redis.ttl(key)
          if (typeof rawTtl === "number" && rawTtl > 0) ttl = rawTtl
        } catch {
          // Keep the windowSeconds fallback.
        }

        if (current > opts.max) {
          return reject(ttl)
        }

        applyHeaders(opts.max - current, now + ttl * 1000)
        return next()
      } catch (err: any) {
        logger.error(`[RateLimit:${opts.keyPrefix}] Redis command failed: ${err.message}. Falling back to memory.`)
        // Falls through to the in-memory tracker below -- this only runs
        // when Redis is unavailable or just failed, not after a successful
        // Redis check, so a request can't be limited twice by two separate
        // counters.
      }
    }

    const tracker = memoryTracker.get(key)
    if (!tracker || now > tracker.resetTime) {
      memoryTracker.set(key, { count: 1, resetTime: now + opts.windowMs })
      applyHeaders(opts.max - 1, now + opts.windowMs)
      return next()
    }

    tracker.count++
    if (tracker.count > opts.max) {
      return reject(Math.ceil((tracker.resetTime - now) / 1000))
    }

    applyHeaders(opts.max - tracker.count, tracker.resetTime)
    return next()
  }
}

// ==========================================
// Named tier presets -- limits are configurable via env vars (see env.ts)
// rather than hardcoded, per the production rate-limiting requirements.
// ==========================================

// Applied globally in app.ts as a baseline floor under every route (kept as
// the default export for backward compatibility with that existing wiring).
export const rateLimitMiddleware = createRateLimiter({
  windowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MS,
  max: env.RATE_LIMIT_GLOBAL_MAX,
  keyPrefix: "global",
})

// Very strict -- login, register, forgot/reset password, verify-email, oauth.
// IP-keyed (not user-keyed): these endpoints are exactly the ones an
// unauthenticated attacker hits, so there is no req.user yet to key off.
export const authRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  keyPrefix: "auth",
})

export const adminRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_ADMIN_WINDOW_MS,
  max: env.RATE_LIMIT_ADMIN_MAX,
  keyPrefix: "admin",
  useUserId: true,
})

export const recruiterRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_RECRUITER_WINDOW_MS,
  max: env.RATE_LIMIT_RECRUITER_MAX,
  keyPrefix: "recruiter",
  useUserId: true,
})

export const candidateRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_CANDIDATE_WINDOW_MS,
  max: env.RATE_LIMIT_CANDIDATE_MAX,
  keyPrefix: "candidate",
  useUserId: true,
})

// Resume uploads, company logo/document uploads, etc.
export const uploadRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_UPLOAD_WINDOW_MS,
  max: env.RATE_LIMIT_UPLOAD_MAX,
  keyPrefix: "upload",
  useUserId: true,
})

// Job search/browse -- higher ceiling (legitimate paging/filtering fires
// many requests quickly) but still bounded, and still IP-keyed since job
// search is reachable while logged out.
export const searchRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_SEARCH_WINDOW_MS,
  max: env.RATE_LIMIT_SEARCH_MAX,
  keyPrefix: "search",
})

export default rateLimitMiddleware
