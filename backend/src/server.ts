import app from "./app"
import env from "./shared/config/env"
import { logger } from "./shared/utils/logger"
import { initSocket } from "./shared/socket/socket"

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 JobsForWomen API engine active on port ${env.PORT} [mode: ${env.NODE_ENV}]`)
})

// CRITICAL: initSocket() attaches Socket.IO to this HTTP server. It was
// previously never called anywhere in the boot sequence -- `app.listen()`
// alone gives you a plain HTTP server with no WebSocket layer, so real-time
// chat and live notification delivery never actually ran, despite the
// socket.ts implementation itself being complete and correct.
initSocket(server)

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
