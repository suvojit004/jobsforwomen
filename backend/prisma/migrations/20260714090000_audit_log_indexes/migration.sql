-- Final Implementation Pass, Part 2: Activity Logs real server-side
-- pagination/filtering. admin.service.ts's getAuditLogs() now always orders
-- by timestamp desc and frequently filters by category/entity/operatorId,
-- so these keep those queries index-backed instead of falling back to a
-- full table scan as the AuditLog table grows.
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
CREATE INDEX "AuditLog_category_idx" ON "AuditLog"("category");
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");
CREATE INDEX "AuditLog_operatorId_idx" ON "AuditLog"("operatorId");
