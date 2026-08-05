import type { Request, Response, NextFunction } from "express"
import prisma from "../database/db"
import { redis } from "../utils/redis"
import { sendError } from "../utils/response"
import { logger } from "../utils/logger"

// Enforces the "Inactivity Session Timeout" security policy configured on
// the Administrative Settings page (SecurityPolicy.adminSessionTimeoutMinutes,
// Super-Admin-only to change -- see admin.service.ts's
// getSecuritySettings/updateSecuritySettings). Previously this control was a
// disabled dropdown locked to "30 Minutes (fixed)": access/refresh token
// lifetimes are fixed, process-wide env vars (JWT_ACCESS_EXPIRY/
// JWT_REFRESH_EXPIRY), the same for every user, and nothing tracked
// "time since last activity" at all. This middleware is the real
// enforcement point.

const SETTINGS_ROW_ID = "singleton"
const SETTINGS_CACHE_KEY = "security:adminSessionTimeoutMinutes"
const SETTINGS_CACHE_TTL_SECONDS = 60 // Super Admin policy changes take effect within a minute platform-wide.
const LAST_ACTIVE_PREFIX = "session:lastActive:"

async function getConfiguredTimeoutMinutes(): Promise<number | null> {
  if (redis) {
    try {
      const cached = await redis.get(SETTINGS_CACHE_KEY)
      if (cached !== null) {
        return cached === "" ? null : Number(cached)
      }
    } catch (err: any) {
      logger.warn(`[SessionTimeout] Redis cache read failed, falling back to DB: ${err.message}`)
    }
  }

  const row = await prisma.securityPolicy.findUnique({ where: { id: SETTINGS_ROW_ID } })
  const minutes = row?.adminSessionTimeoutMinutes ?? null

  if (redis) {
    try {
      await redis.set(SETTINGS_CACHE_KEY, minutes === null ? "" : String(minutes), "EX", SETTINGS_CACHE_TTL_SECONDS)
    } catch (err: any) {
      logger.warn(`[SessionTimeout] Redis cache write failed: ${err.message}`)
    }
  }

  return minutes
}

// Called by AdminService.updateSecuritySettings right after a Super Admin
// changes the timeout, so the new value is picked up immediately instead of
// waiting out the cache TTL.
export async function invalidateSessionTimeoutSettingsCache(): Promise<void> {
  if (!redis) return
  try {
    await redis.del(SETTINGS_CACHE_KEY)
  } catch (err: any) {
    logger.warn(`[SessionTimeout] Failed to invalidate settings cache: ${err.message}`)
  }
}

// Revokes the Session row and any RefreshToken issued alongside it. Revoking
// the refresh token too is what actually matters: without it, the
// frontend's automatic 401 -> POST /auth/refresh retry (see
// frontend/src/api/client.ts's tryRefreshToken) would silently mint a brand
// new session and access token, completely undoing the timeout.
async function expireSession(sessionId: string): Promise<void> {
  try {
    await prisma.session.update({ where: { id: sessionId }, data: { revoked: true } })
  } catch (err: any) {
    logger.warn(`[SessionTimeout] Failed to mark session ${sessionId} revoked: ${err.message}`)
  }
  try {
    await prisma.refreshToken.updateMany({ where: { sessionId, revoked: false }, data: { revoked: true } })
  } catch (err: any) {
    logger.warn(`[SessionTimeout] Failed to revoke refresh tokens for session ${sessionId}: ${err.message}`)
  }
  if (redis) {
    try {
      await redis.del(`${LAST_ACTIVE_PREFIX}${sessionId}`)
    } catch {
      // Best-effort cleanup only -- the key would have expired on its own TTL anyway.
    }
  }
}

export async function enforceAdminSessionTimeout(req: Request, res: Response, next: NextFunction) {
  const user = req.user
  if (!user) {
    return sendError(res, "Authentication required", null, 401)
  }

  // Tokens issued before this feature shipped won't carry a sessionId.
  // Access tokens are short-lived (JWT_ACCESS_EXPIRY), so every already
  // logged-in admin picks one up naturally on their next refresh/login --
  // no need to hard-reject them the moment this deploys.
  const sessionId = user.sessionId
  if (!sessionId) {
    return next()
  }

  try {
    const timeoutMinutes = await getConfiguredTimeoutMinutes()
    if (!timeoutMinutes || timeoutMinutes <= 0) {
      // Enforcement disabled (the honest default) -- nothing to check.
      return next()
    }

    const timeoutMs = timeoutMinutes * 60 * 1000
    const nowMs = Date.now()
    const key = `${LAST_ACTIVE_PREFIX}${sessionId}`

    if (redis) {
      try {
        const lastActiveRaw = await redis.get(key)
        if (lastActiveRaw) {
          const elapsedMs = nowMs - Number(lastActiveRaw)
          if (elapsedMs > timeoutMs) {
            await expireSession(sessionId)
            return sendError(res, "Session expired due to inactivity. Please sign in again.", null, 401)
          }
        }
        // Sliding window: the key's own TTL (reset on every authenticated
        // request) IS the inactivity timeout -- no need to track and diff
        // timestamps beyond this one comparison.
        await redis.set(key, String(nowMs), "EX", Math.ceil(timeoutMs / 1000))
        return next()
      } catch (err: any) {
        logger.warn(`[SessionTimeout] Redis check failed, falling back to DB: ${err.message}`)
      }
    }

    // Redis unavailable -- fall back to the persisted Session.lastActiveAt.
    const session = await prisma.session.findUnique({ where: { id: sessionId } })
    if (!session || session.revoked) {
      return sendError(res, "Session expired due to inactivity. Please sign in again.", null, 401)
    }
    const elapsedMs = nowMs - session.lastActiveAt.getTime()
    if (elapsedMs > timeoutMs) {
      await expireSession(sessionId)
      return sendError(res, "Session expired due to inactivity. Please sign in again.", null, 401)
    }
    await prisma.session.update({ where: { id: sessionId }, data: { lastActiveAt: new Date(nowMs) } }).catch(() => {})
    return next()
  } catch (err: any) {
    // Fail open: an unrelated infra hiccup in this middleware shouldn't lock
    // every admin out of the platform. The request still passed real JWT
    // signature verification upstream -- this only weakens the inactivity
    // check specifically, not authentication itself.
    logger.error(`[SessionTimeout] Unexpected error, failing open: ${err.message}`)
    return next()
  }
}
