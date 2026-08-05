import type { Request, Response, NextFunction } from "express"
import prisma from "../database/db"
import { redis } from "../utils/redis"
import { sendError } from "../utils/response"
import { logger } from "../utils/logger"

// Enforces the two real, Super-Admin-configurable platform security policies
// on the Administrative Settings page -- both used to be honestly-disabled
// controls with zero runtime effect:
//   - Inactivity Session Timeout (enforceAdminSessionTimeout)
//   - Force Two-Factor (2FA) for admin-tier accounts (enforceTwoFactorPolicy)
// Both read the same SecurityPolicy singleton row (see admin.service.ts's
// getSecuritySettings/updateSecuritySettings), so this file shares one
// cached read of it rather than each maintaining its own Redis key.
// (This file was named sessionTimeout.middleware.ts before Force 2FA was
// added -- renamed since it now covers more than session timeout.)

const SETTINGS_ROW_ID = "singleton"
const SETTINGS_CACHE_KEY = "security:policy"
const SETTINGS_CACHE_TTL_SECONDS = 60 // Super Admin policy changes take effect within a minute platform-wide.
const LAST_ACTIVE_PREFIX = "session:lastActive:"

interface SecurityPolicySnapshot {
  adminSessionTimeoutMinutes: number | null
  forceTwoFactorForAdmins: boolean
}

async function getSecurityPolicy(): Promise<SecurityPolicySnapshot> {
  if (redis) {
    try {
      const cached = await redis.get(SETTINGS_CACHE_KEY)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (err: any) {
      logger.warn(`[SecurityPolicy] Redis cache read failed, falling back to DB: ${err.message}`)
    }
  }

  const row = await prisma.securityPolicy.findUnique({ where: { id: SETTINGS_ROW_ID } })
  const snapshot: SecurityPolicySnapshot = {
    adminSessionTimeoutMinutes: row?.adminSessionTimeoutMinutes ?? null,
    forceTwoFactorForAdmins: row?.forceTwoFactorForAdmins ?? false,
  }

  if (redis) {
    try {
      await redis.set(SETTINGS_CACHE_KEY, JSON.stringify(snapshot), "EX", SETTINGS_CACHE_TTL_SECONDS)
    } catch (err: any) {
      logger.warn(`[SecurityPolicy] Redis cache write failed: ${err.message}`)
    }
  }

  return snapshot
}

// Called by AdminService.updateSecuritySettings right after a Super Admin
// changes either policy, so the new value is picked up immediately instead
// of waiting out the cache TTL.
export async function invalidateSecurityPolicyCache(): Promise<void> {
  if (!redis) return
  try {
    await redis.del(SETTINGS_CACHE_KEY)
  } catch (err: any) {
    logger.warn(`[SecurityPolicy] Failed to invalidate cache: ${err.message}`)
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
    logger.warn(`[SecurityPolicy] Failed to mark session ${sessionId} revoked: ${err.message}`)
  }
  try {
    await prisma.refreshToken.updateMany({ where: { sessionId, revoked: false }, data: { revoked: true } })
  } catch (err: any) {
    logger.warn(`[SecurityPolicy] Failed to revoke refresh tokens for session ${sessionId}: ${err.message}`)
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
    const policy = await getSecurityPolicy()
    const timeoutMinutes = policy.adminSessionTimeoutMinutes
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
        logger.warn(`[SecurityPolicy] Redis check failed, falling back to DB: ${err.message}`)
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
    logger.error(`[SecurityPolicy] Unexpected error enforcing session timeout, failing open: ${err.message}`)
    return next()
  }
}

export async function enforceTwoFactorPolicy(req: Request, res: Response, next: NextFunction) {
  const user = req.user
  if (!user) {
    return sendError(res, "Authentication required", null, 401)
  }

  try {
    const policy = await getSecurityPolicy()
    if (!policy.forceTwoFactorForAdmins) {
      return next()
    }

    // Tokens minted before Force 2FA existed (or before this admin last
    // logged in/refreshed) won't carry twoFactorEnabled -- treated as "not
    // enrolled" rather than crashing. This can transiently block an admin
    // who actually does have 2FA enabled until their token naturally
    // refreshes (bounded by JWT_ACCESS_EXPIRY), which is the safe direction
    // to be wrong in for a security gate.
    if (user.twoFactorEnabled) {
      return next()
    }

    return sendError(
      res,
      "Two-factor authentication is required for admin accounts. Enable it from Administrative Settings to continue.",
      null,
      403
    )
  } catch (err: any) {
    logger.error(`[SecurityPolicy] Unexpected error enforcing 2FA policy, failing open: ${err.message}`)
    return next()
  }
}
