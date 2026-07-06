import { redis } from "./redis"
import prisma from "../database/db"
import { logger } from "./logger"

const CACHE_PREFIX = "user:permissions:"
const CACHE_TTL = 24 * 60 * 60 // 24 hours

export class PermissionCacheManager {
  /**
   * Retrieves effective permissions for a user, caching them in Redis if not present.
   */
  static async getUserPermissions(userId: string): Promise<string[]> {
    const key = `${CACHE_PREFIX}${userId}`

    if (redis) {
      try {
        const cached = await redis.get(key)
        if (cached) {
          logger.debug(`[PermissionCache] Hit for user: ${userId}`)
          return JSON.parse(cached)
        }
      } catch (err: any) {
        logger.warn(`[PermissionCache] Redis read error: ${err.message}`)
      }
    }

    // Cache miss or Redis unavailable -> read from Database
    logger.debug(`[PermissionCache] Miss for user: ${userId}, querying database.`)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!user) {
      return []
    }

    const permissions = Array.from(
      new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.name)
        )
      )
    )

    if (redis) {
      try {
        await redis.set(key, JSON.stringify(permissions), "EX", CACHE_TTL)
      } catch (err: any) {
        logger.warn(`[PermissionCache] Redis write error: ${err.message}`)
      }
    }

    return permissions
  }

  /**
   * Invalidates cached permissions for a specific user.
   */
  static async invalidateUser(userId: string): Promise<void> {
    if (!redis) return
    const key = `${CACHE_PREFIX}${userId}`
    try {
      await redis.del(key)
      logger.info(`[PermissionCache] Invalidated cache for user: ${userId}`)
    } catch (err: any) {
      logger.error(`[PermissionCache] Failed to invalidate cache for user: ${userId}: ${err.message}`)
    }
  }

  /**
   * Invalidates permissions cache for all users (e.g. after a role-permission change).
   */
  static async invalidateAll(): Promise<void> {
    if (!redis) return
    try {
      const keys = await redis.keys(`${CACHE_PREFIX}*`)
      if (keys.length > 0) {
        await redis.del(...keys)
        logger.info(`[PermissionCache] Invalidated all users permission caches (${keys.length} entries).`)
      }
    } catch (err: any) {
      logger.error(`[PermissionCache] Failed to invalidate all caches: ${err.message}`)
    }
  }
}

export default PermissionCacheManager
