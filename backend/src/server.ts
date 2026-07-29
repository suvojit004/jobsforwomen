import app from "./app"
import env from "./shared/config/env"
import { logger } from "./shared/utils/logger"
import { initSocket } from "./shared/socket/socket"
import { bootstrapScheduler } from "./shared/queue/scheduler"

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 JobsForWomen API engine active on port ${env.PORT} [mode: ${env.NODE_ENV}]`)
})

// CRITICAL: initSocket() attaches Socket.IO to this HTTP server. It was
// previously never called anywhere in the boot sequence -- `app.listen()`
// alone gives you a plain HTTP server with no WebSocket layer, so real-time
// chat and live notification delivery never actually ran, despite the
// socket.ts implementation itself being complete and correct.
initSocket(server)

// CRITICAL: same class of bug as initSocket above -- bootstrapScheduler()
// registers the repeatable BullMQ cron jobs (invitation/job/notification
// cleanup, daily/weekly candidate job digests, monthly admin report) but was
// previously never called anywhere in the boot sequence. The cron patterns,
// queue handlers, and email templates all existed and worked correctly in
// isolation; nothing ever actually scheduled them. BullMQ's repeatable-job
// registration is idempotent (re-adding the same name+pattern on every
// restart does not create duplicates), so this is safe to call
// unconditionally on every boot.
bootstrapScheduler().catch((err) => {
  logger.error(`Failed to bootstrap scheduled cron tasks: ${err?.message || err}`)
})

// Graceful Shutdown hooks
const shutdown = () => {
  logger.info("Gracefully closing API server connections...")
  server.close(() => {
    logger.info("Server process terminated cleanly.")
    process.exit(0)
  })
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

process.on("unhandledRejection", (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`)
})

process.on("uncaughtException", (error) => {
  logger.error(`Uncaught Exception thrown: ${error.stack || error}`)
  process.exit(1)
})
