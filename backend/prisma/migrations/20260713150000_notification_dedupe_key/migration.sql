-- AlterTable
-- Adds an optional idempotency key to Notification so event-driven
-- notifications (job submitted/approved/rejected, etc) can be created via
-- an upsert-like "create, ignore if it already exists" pattern instead of
-- risking duplicate rows if a domain event is published more than once
-- (e.g. a retried API call, or an admin double-clicking an action button).
-- Nullable + unique is safe for existing rows and other notification types
-- that never set it: Postgres allows any number of NULLs in a unique index.
ALTER TABLE "Notification"
ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
