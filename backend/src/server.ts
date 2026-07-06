import app from "./app"
import env from "./shared/config/env"
import { logger } from "./shared/utils/logger"

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 JobsForWomen API engine active on port ${env.PORT} [mode: ${env.NODE_ENV}]`)
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
