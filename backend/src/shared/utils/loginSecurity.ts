import { redis } from "./redis"
import { logger } from "./logger"
import env from "../config/env"

// Backs the "Admin sessions are tracked by IP audit registries. Suspicious
// access patterns trigger instant lockouts" claim on Administrative
// Settings, which previously had nothing admin-specific behind it -- just
// the generic, IP-keyed authRateLimiter every auth endpoint gets (a blunt
// request-rate throttle, not a failed-login counter, not account-specific,
// not anomaly detection). This tracks two distinct signals, both scoped to
// admin-tier login targets only (Admin/Super Admin/Moderator/Support
// Executive) so candidate/recruiter login behavior is unaffected:
//   - Per-account failed attempts -> a durable lock (User.lockedUntil),
//     survives past this counter's own window.
//   - Per-IP failed attempts across admin accounts -> a "suspicious
//     pattern" signal (one address probing multiple/repeated admin
//     logins), blocked for as long as the window keeps refreshing.
// Redis-backed with an in-memory Map fallback (same degrade-gracefully
// pattern as rateLimit.middleware.ts) so this still works, per-instance,
// if Redis is unreachable rather than silently doing nothing.

const EMAIL_KEY_PREFIX = "loginfail:email:"
const IP_KEY_PREFIX = "loginfail:ip:"

const memoryCounters = new Map<string, { count: number; resetTime: number }>()

function memoryIncrement(key: string, windowMs: number): number {
  const now = Date.now()
  const existing = memoryCounters.get(key)
  if (!existing || now > existing.resetTime) {
    memoryCounters.set(key, { count: 1, resetTime: now + windowMs })
    return 1
  }
  existing.count++
  return existing.count
}

function memoryGet(key: string): number {
  const existing = memoryCounters.get(key)
  if (!existing || Date.now() > existing.resetTime) return 0
  return existing.count
}

function memoryClear(key: string): void {
  memoryCounters.delete(key)
}

async function increment(key: string, windowSeconds: number): Promise<number> {
  if (redis && redis.status === "ready") {
    try {
      const count = await redis.incr(key)
      if (count === 1) {
        await redis.expire(key, windowSeconds)
      }
      return count
    } catch (err: any) {
      logger.warn(`[LoginSecurity] Redis increment failed for ${key}, falling back to memory: ${err.message}`)
    }
  }
  return memoryIncrement(key, windowSeconds * 1000)
}

async function getCount(key: string): Promise<number> {
  if (redis && redis.status === "ready") {
    try {
      const raw = await redis.get(key)
      return raw ? Number(raw) : 0
    } catch (err: any) {
      logger.warn(`[LoginSecurity] Redis read failed for ${key}, falling back to memory: ${err.message}`)
    }
  }
  return memoryGet(key)
}

async function clear(key: string): Promise<void> {
  if (redis && redis.status === "ready") {
    try {
      await redis.del(key)
    } catch (err: any) {
      logger.warn(`[LoginSecurity] Redis clear failed for ${key}: ${err.message}`)
    }
  }
  memoryClear(key)
}

const emailKey = (email: string) => `${EMAIL_KEY_PREFIX}${email.toLowerCase()}`
const ipKey = (ipAddress: string) => `${IP_KEY_PREFIX}${ipAddress}`

// Records one failed login attempt against an admin-tier account. Returns
// the new per-account failure count (for the caller to compare against
// ADMIN_LOGIN_LOCKOUT_THRESHOLD) and whether this IP has now crossed the
// broader per-IP suspicious-pattern threshold.
export async function recordFailedAdminLogin(
  email: string,
  ipAddress: string
): Promise<{ emailFailureCount: number; ipFlagged: boolean }> {
  const windowSeconds = env.ADMIN_LOGIN_LOCKOUT_WINDOW_MINUTES * 60
  const [emailFailureCount, ipFailureCount] = await Promise.all([
    increment(emailKey(email), windowSeconds),
    increment(ipKey(ipAddress), windowSeconds),
  ])
  return {
    emailFailureCount,
    ipFlagged: ipFailureCount >= env.ADMIN_LOGIN_IP_LOCKOUT_THRESHOLD,
  }
}

export async function isIpFlaggedForAdminLogins(ipAddress: string): Promise<boolean> {
  const count = await getCount(ipKey(ipAddress))
  return count >= env.ADMIN_LOGIN_IP_LOCKOUT_THRESHOLD
}

// Called on a successful admin login -- a real login resets both counters
// for that account/IP pair rather than letting old failures linger toward
// a future false lockout.
export async function clearFailedAdminLogins(email: string, ipAddress: string): Promise<void> {
  await Promise.all([clear(emailKey(email)), clear(ipKey(ipAddress))])
}
