-- Final Implementation Pass, Part 10: ConversationService.getOrCreateForApplication
-- concurrency hardening. Adds a deterministic, sorted "userIdA:userIdB" identity
-- key (participantsKey) backed by a real Postgres UNIQUE constraint, replacing the
-- previous racy findFirst()-then-create() pattern with an atomic upsert() in
-- application code (see conversation.service.ts, ConversationService.pairKey()).
-- Nullable because pre-existing conversations are backfilled best-effort below;
-- Postgres permits multiple NULLs under a UNIQUE constraint, so any true legacy
-- duplicate pairs (if they exist from the exact race this migration closes) are
-- simply left unkeyed rather than forcibly merged -- merging conversation/message
-- history is a distinct, higher-risk data migration this fix does not attempt.
ALTER TABLE "Conversation"
ADD COLUMN "participantsKey" TEXT;

-- Backfill: for every conversation, compute the same sorted-participant-userIds
-- key the application will use going forward, and set it ONLY on the earliest (by
-- createdAt) conversation per computed key -- if more than one conversation
-- already exists for the same pair, later row(s) are deliberately left NULL.
WITH pair_keys AS (
  SELECT
    c."id",
    c."createdAt",
    (
      SELECT string_agg(cp."userId", ':' ORDER BY cp."userId")
      FROM "ConversationParticipant" cp
      WHERE cp."conversationId" = c."id"
    ) AS "computedKey"
  FROM "Conversation" c
),
ranked AS (
  SELECT
    "id",
    "computedKey",
    ROW_NUMBER() OVER (PARTITION BY "computedKey" ORDER BY "createdAt" ASC) AS rn
  FROM pair_keys
  WHERE "computedKey" IS NOT NULL
)
UPDATE "Conversation" c
SET "participantsKey" = ranked."computedKey"
FROM ranked
WHERE c."id" = ranked."id" AND ranked.rn = 1;

-- Real uniqueness enforcement going forward.
CREATE UNIQUE INDEX "Conversation_participantsKey_key" ON "Conversation"("participantsKey");
