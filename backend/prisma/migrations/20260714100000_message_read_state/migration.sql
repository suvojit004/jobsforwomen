-- Final Implementation Pass, Part 5: persistent message read state.
-- "message:read" was previously an ephemeral Socket.IO broadcast only, with
-- no database record at all -- a page refresh or a recipient who was
-- offline when the event fired lost all read-state information
-- permanently. Conversations in this schema are strictly two-party (see
-- ConversationService.getOrCreateForApplication -- always exactly one
-- candidate + one recruiter), so a single nullable `readAt` timestamp per
-- message is sufficient; this schema has no group-conversation concept to
-- justify a per-user read-receipt join table.
ALTER TABLE "Message"
ADD COLUMN "readAt" TIMESTAMP(3);

-- Supports ConversationService.markConversationAsRead()'s updateMany
-- (conversationId + senderId != caller + readAt IS NULL) and
-- getConversations()'s per-conversation unread count() -- both filter on
-- exactly this column combination.
CREATE INDEX "Message_conversationId_senderId_readAt_idx" ON "Message"("conversationId", "senderId", "readAt");
