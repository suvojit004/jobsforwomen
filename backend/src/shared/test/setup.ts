import prisma from "../database/db"
import redis from "../utils/redis"
import EventBus from "../eventBus/eventBus"

afterAll(async () => {
  // Wait for all active background EventBus handlers to settle
  if (EventBus && typeof EventBus.allSettled === "function") {
    await EventBus.allSettled()
  }

  // Clear all background EventBus listeners to prevent in-flight updates
  if (EventBus && typeof EventBus.clearAll === "function") {
    EventBus.clearAll()
  }

  // Gracefully disconnect Prisma Client
  if (prisma && typeof prisma.$disconnect === "function") {
    await prisma.$disconnect()
  }

  // Gracefully disconnect Redis connection
  if (redis) {
    try {
      if (typeof redis.quit === "function") {
        await redis.quit()
      } else if (typeof redis.disconnect === "function") {
        redis.disconnect()
      }
    } catch (err) {
      try {
        redis.disconnect()
      } catch (e) {
        // Ignore
      }
    }
  }

  // Allow a tiny delay for network sockets to fully flush and close
  await new Promise((resolve) => setTimeout(resolve, 50))
})
