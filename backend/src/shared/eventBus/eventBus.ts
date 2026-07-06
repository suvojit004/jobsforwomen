import { logger } from "../utils/logger"

export type EventHandler<T = any> = (data: T) => void | Promise<void>

export class EventBus {
  private static listeners: Map<string, Set<EventHandler>> = new Map()

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
   * If a listener returns a Promise, handles any unhandled rejections gracefully.
   */
  static publish(event: string, data: any): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      logger.debug(`[EventBus] Publishing event: ${event} to ${handlers.size} handlers`)
      handlers.forEach((handler) => {
        try {
          const result = handler(data)
          if (result instanceof Promise) {
            result.catch((err) => {
              logger.error(`[EventBus] Async handler error for event '${event}': ${err.message}`, { error: err })
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
   * Clears all listeners (mostly used for testing isolation).
   */
  static clearAll(): void {
    this.listeners.clear()
    logger.debug("[EventBus] Cleared all listeners")
  }
}

export default EventBus
