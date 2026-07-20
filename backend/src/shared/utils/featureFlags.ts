import prisma from "../database/db"
import { logger } from "./logger"

// Single real enforcement chokepoint for FeatureFlag rows: ConversationService
// (chat_enabled) and the BullMQ "email" queue (email_automation) both call
// isFeatureEnabled() before doing real work.
//
// In-memory TTL cache instead of a new Redis namespace -- only 6 flag rows
// that change rarely, so this avoids hitting Postgres on every check.
const CACHE_TTL_MS = 15_000
const cache = new Map<string, { value: boolean; expiresAt: number }>()

export async function isFeatureEnabled(key: string, defaultValue = true): Promise<boolean> {
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  try {
    const flag = await prisma.featureFlag.findUnique({ where: { key } })
    // A flag that has never been seeded/created is treated as "not
    // configured" rather than "off" -- absence of a row must not silently
    // disable a feature that was never meant to be flag-gated.
    const value = flag ? flag.value : defaultValue
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
    return value
  } catch (err: any) {
    logger.warn(`[FeatureFlags] Failed to read flag "${key}", defaulting to ${defaultValue}: ${err.message}`)
    return defaultValue
  }
}

export function invalidateFeatureFlagCache(key?: string) {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}

export default { isFeatureEnabled, invalidateFeatureFlagCache }
