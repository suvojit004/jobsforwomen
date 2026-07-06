import EventBus from "../eventBus/eventBus"
import { createAuditLog } from "../utils/audit"
import { logger } from "../utils/logger"

export function initAuditListener() {
  EventBus.subscribe("AuditCreated", async (payload: any) => {
    logger.debug(`[AuditListener] Processing audit event: ${payload.action}`)
    await createAuditLog(payload)
  })
}

export default initAuditListener
