import { logger } from "../utils/logger"

export type EventHandler<T = any> = (data: T) => void | Promise<void>

export class EventBus {
  private static listeners: Map<string, Set<EventHandler>> = new Map()
  private static activePromises: Set<Promise<any>> = new Set()

  /**
   * Subscribes a handler to a specific domain event.
   */
  static subscribe(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    logger.debug(`[EventBus] Subscribed handler to event: ${event}`)
  }

  /**
   * Unsubscribes a handler from a specific domain event.
   */
  static unsubscribe(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler)
      logger.debug(`[EventBus] Unsubscribed handler from event: ${event}`)
    }
  }

  /**
   * Publishes an event to all subscribed listeners.
   * Tracks in-flight promises to enable proper teardown coordination.
   */
  static publish(event: string, data: any): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      logger.debug(`[EventBus] Publishing event: ${event} to ${handlers.size} handlers`)
      handlers.forEach((handler) => {
        try {
          const result = handler(data)
          if (result instanceof Promise) {
            const wrappedPromise = Promise.resolve(result)
            this.activePromises.add(wrappedPromise)
            wrappedPromise.catch((err) => {
              logger.error(`[EventBus] Async handler error for event '${event}': ${err.message}`, { error: err })
            }).finally(() => {
              this.activePromises.delete(wrappedPromise)
            })
          }
        } catch (err: any) {
          logger.error(`[EventBus] Synchronous handler error for event '${event}': ${err.message}`, { error: err })
        }
      })
    } else {
      logger.debug(`[EventBus] Event '${event}' published but has no subscribers`)
    }
  }

  /**
   * Awaits all currently in-flight background handlers to settle.
   */
  static async allSettled(): Promise<void> {
    while (this.activePromises.size > 0) {
      await Promise.allSettled(Array.from(this.activePromises))
    }
  }

  /**
   * Clears all listeners and in-flight promises tracking.
   */
  static clearAll(): void {
    this.listeners.clear()
    this.activePromises.clear()
    logger.debug("[EventBus] Cleared all listeners and active promises")
  }
}

export default EventBus
