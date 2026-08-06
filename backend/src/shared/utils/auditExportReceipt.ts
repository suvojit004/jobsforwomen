import { redis } from "./redis"
import { logger } from "./logger"

// Server-side enforcement for "Delete All Logs must not be possible without
// a genuine, recent export having happened" on Platform Activity Logs.
// Previously this was only a client-side sequencing guarantee -- ActivityLogs.
// tsx auto-triggered Export before calling Delete if the admin hadn't
// clicked it yet -- but nothing stopped a request crafted directly against
// DELETE /admins/audits (bypassing the UI entirely) from purging the whole
// audit trail with no export ever having happened. Now the backend itself
// tracks "this admin successfully exported the full log at time T" and
// DELETE checks for a receipt issued within the last RECEIPT_TTL_SECONDS
// before allowing the purge -- see admin.service.ts's exportAuditLogsCsv/
// deleteAllAuditLogs. Redis-backed with an in-memory Map fallback (same
// degrade-gracefully pattern as loginSecurity.ts) so this still works,
// per-instance, if Redis is unreachable.

const RECEIPT_KEY_PREFIX = "auditexport:receipt:"
// Long enough to comfortably cover "click Export, watch the download land,
// click Delete" -- short enough that a receipt from an old, unrelated
// session can't be replayed much later to justify a fresh purge.
const RECEIPT_TTL_SECONDS = 10 * 60

const memoryReceipts = new Map<string, number>() // adminId -> expiresAt (ms)

function memorySet(key: string, ttlMs: number): void {
  memoryReceipts.set(key, Date.now() + ttlMs)
}

function memoryHas(key: string): boolean {
  const expiresAt = memoryReceipts.get(key)
  if (!expiresAt) return false
  if (Date.now() > expiresAt) {
    memoryReceipts.delete(key)
    return false
  }
  return true
}

function memoryClear(key: string): void {
  memoryReceipts.delete(key)
}

const receiptKey = (adminId: string) => `${RECEIPT_KEY_PREFIX}${adminId}`

// Called right after a successful GET /admins/audits/export.
export async function recordAuditExportReceipt(adminId: string): Promise<void> {
  const key = receiptKey(adminId)
  if (redis && redis.status === "ready") {
    try {
      await redis.set(key, "1", "EX", RECEIPT_TTL_SECONDS)
      return
    } catch (err: any) {
      logger.warn(`[AuditExportReceipt] Redis write failed for ${key}, falling back to memory: ${err.message}`)
    }
  }
  memorySet(key, RECEIPT_TTL_SECONDS * 1000)
}

// Called at the start of DELETE /admins/audits, before anything is deleted.
export async function hasRecentAuditExportReceipt(adminId: string): Promise<boolean> {
  const key = receiptKey(adminId)
  if (redis && redis.status === "ready") {
    try {
      const raw = await redis.get(key)
      return raw !== null
    } catch (err: any) {
      logger.warn(`[AuditExportReceipt] Redis read failed for ${key}, falling back to memory: ${err.message}`)
    }
  }
  return memoryHas(key)
}

// Called after a successful purge -- a receipt is single-use, so a second
// DELETE call right after (with no new export in between) can't ride the
// same receipt to purge again.
export async function clearAuditExportReceipt(adminId: string): Promise<void> {
  const key = receiptKey(adminId)
  if (redis && redis.status === "ready") {
    try {
      await redis.del(key)
    } catch (err: any) {
      logger.warn(`[AuditExportReceipt] Redis clear failed for ${key}: ${err.message}`)
    }
  }
  memoryClear(key)
}
