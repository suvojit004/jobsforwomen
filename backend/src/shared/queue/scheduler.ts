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
      // 1. Run Expired Invitations Cleanup every hour
      await cleanupQueue.add("invitationExpiry", {}, {
        repeat: { pattern: "0 * * * *" }
      })

      // 2. Run Job Expiry Cleanup every day at midnight
      await cleanupQueue.add("jobExpiry", {}, {
        repeat: { pattern: "0 0 * * *" }
      })

      // 3. Run old notification cleanup every Sunday at midnight
      await cleanupQueue.add("notificationCleanup", {}, {
        repeat: { pattern: "0 0 * * 0" }
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
