import { queues } from "./queue"
import { logger } from "../utils/logger"

const isTest = process.env.NODE_ENV === "test"

export async function bootstrapScheduler() {
  if (isTest) {
    logger.info("[Scheduler] Cron repeatable schedules skipped in test environment.")
    return
  }

  try {
    const cleanupQueue = queues["cleanup"]
    const reportsQueue = queues["reports"]

    if (cleanupQueue && cleanupQueue.add) {
      // BullMQ keys a repeatable job by its name + cron pattern -- changing
      // the pattern in code (as just happened to notificationCleanup, weekly
      // -> hourly for the new 48h notification TTL) registers a SECOND
      // repeatable schedule alongside the old one rather than replacing it,
      // since from BullMQ's point of view they're different repeat configs.
      // Clearing any existing "notificationCleanup" schedules first makes
      // this idempotent across deploys: whatever cron string is in this file
      // right now is the only one that ends up actually registered.
      if (cleanupQueue.getRepeatableJobs) {
        const existing = await cleanupQueue.getRepeatableJobs()
        for (const job of existing) {
          if (job.name === "notificationCleanup" && cleanupQueue.removeRepeatableByKey) {
            await cleanupQueue.removeRepeatableByKey(job.key)
            logger.info(`[Scheduler] Removed stale notificationCleanup schedule: ${job.pattern}`)
          }
        }
      }

      // 1. Run Expired Invitations Cleanup every hour
      await cleanupQueue.add("invitationExpiry", {}, {
        repeat: { pattern: "0 * * * *" }
      })

      // 2. Run Job Expiry Cleanup every day at midnight
      await cleanupQueue.add("jobExpiry", {}, {
        repeat: { pattern: "0 0 * * *" }
      })

      // 3. Sweep expired notifications every hour -- notifications now carry
      // a 48h expiresAt (see notification.listener.ts), so this needs to run
      // far more often than the old 30-day/read-only cleanup did (that ran
      // weekly, which is far too infrequent for a 48h TTL -- a notification
      // could otherwise sit expired-but-visible for up to ~6 days).
      await cleanupQueue.add("notificationCleanup", {}, {
        repeat: { pattern: "0 * * * *" }
      })

      // 4. Compile Daily Digests every day at 9 AM
      await cleanupQueue.add("compileDailyDigests", {}, {
        repeat: { pattern: "0 9 * * *" }
      })

      // 5. Compile Weekly Digests every Friday at 9 AM
      await cleanupQueue.add("compileWeeklyDigests", {}, {
        repeat: { pattern: "0 9 * * 5" }
      })

      logger.info("[Scheduler] Repeatable background cleanup cron jobs registered.")
    }

    if (reportsQueue && reportsQueue.add) {
      // 4. Generate Admin Report every month
      await reportsQueue.add("monthlyReport", {}, {
        repeat: { pattern: "0 0 1 * *" }
      })
      logger.info("[Scheduler] Monthly reports cron job registered.")
    }
  } catch (err: any) {
    logger.error(`[Scheduler] Failed to bootstrap cron tasks: ${err.message}`)
  }
}

export default bootstrapScheduler
