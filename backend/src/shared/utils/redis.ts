import Redis from "ioredis"
import env from "../config/env"
import { logger } from "./logger"

let redisClient: Redis | null = null

try {
  // Gracefully fallback or suppress connection errors in test mode
  const options = env.NODE_ENV === "test" 
    ? { maxRetriesPerRequest: 1, enableOfflineQueue: false } 
    : { maxRetriesPerRequest: 3 }

  redisClient = new Redis(env.REDIS_URL, options)

  redisClient.on("error", (err) => {
    logger.warn(`Redis connection error: ${err.message}. Running without permission cache.`)
  })

  redisClient.on("connect", () => {
    logger.info("Redis cache client connected successfully.")
  })
} catch (err: any) {
  logger.error(`Failed to initialize Redis: ${err.message}`)
}

export const redis = redisClient
export default redis
