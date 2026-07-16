import prisma from "../database/db"
import { logger } from "./logger"

// CONFIRMED BUG (fixed here): the FeatureFlag table (chat_enabled,
// email_automation, push_notifications, advanced_analytics,
// experimental_sockets, mfa_enforced) was fully real and DB-persisted via
// the Admin Feature Configs CRUD, but nothing in the backend ever *read*
// a flag's value to actually gate behavior -- toggling "Messaging" or
// "Email Automation" off in the Admin UI changed nothing about what the
// API actually allowed. This is the single real enforcement chokepoint:
// ConversationService (chat_enabled) and the BullMQ "email" queue
// (email_automation) both call isFeatureEnabled() before doing real work.
//
// A tiny in-memory TTL cache is used instead of a new Redis key namespace --
// there are only 6 flag rows and they change rarely, so a short cache avoids
// hitting Postgres on every message send without introducing new
// infrastructure.
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
