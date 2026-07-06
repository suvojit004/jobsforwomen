import prisma from "../database/db"
import { logger } from "./logger"

export interface AuditLogInput {
  operatorId?: string
  operatorEmail?: string
  category: string
  action: string
  entity?: string
  entityId?: string
  oldValue?: any
  newValue?: any
  ipAddress?: string
  browser?: string
  device?: string
}

export async function createAuditLog(input: AuditLogInput) {
  try {
    const log = await prisma.auditLog.create({
      data: {
        operatorId: input.operatorId || null,
        operatorEmail: input.operatorEmail || null,
        category: input.category,
        action: input.action,
        entity: input.entity || null,
        entityId: input.entityId || null,
        oldValue: input.oldValue !== undefined ? (input.oldValue as any) : null,
        newValue: input.newValue !== undefined ? (input.newValue as any) : null,
        ipAddress: input.ipAddress || null,
        browser: input.browser || null,
        device: input.device || null,
      },
    })
    logger.info(`[AuditLog] Logged action: ${input.action} on ${input.entity || "System"}:${input.entityId || "N/A"} by operator: ${input.operatorEmail || "System"}`)
    return log
  } catch (err: any) {
    logger.error(`[AuditLog] Failed to create audit log entry: ${err.message}`)
    return null
  }
}

export default createAuditLog
