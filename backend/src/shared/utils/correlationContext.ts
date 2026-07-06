import { AsyncLocalStorage } from "async_hooks"

export const correlationLocalStorage = new AsyncLocalStorage<string>()

export function getCorrelationId(): string | undefined {
  return correlationLocalStorage.getStore()
}
