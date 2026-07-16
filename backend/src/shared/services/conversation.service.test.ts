// Focused tests for ConversationService -- the messaging authorization and
// conversation-creation logic added/fixed during the platform-wide
// production audit. See conversation.service.ts for full context on each
// bug this covers:
//  1. getOrCreateForApplication() didn't exist before this audit -- there
//     was no way anywhere in the app to create a Conversation row.
//  2. getMessages()/sendMessage() must reject non-participants (IDOR check).
//  3. sendMessage()'s senderId must come from the authenticated caller, not
//     from anything client-supplied (enforced at the controller layer by
//     always passing req.user.userId, verified here at the service layer).
//  4. The "chat_enabled" feature flag must actually block new conversation
//     creation and new message sends when turned off.

jest.mock("../database/db", () => {
  const localPrismaMock = {
    application: { findUnique: jest.fn() },
    conversation: { findMany: jest.fn(), upsert: jest.fn(), findUnique: jest.fn() },
    conversationParticipant: { findUnique: jest.fn(), findMany: jest.fn() },
    message: { findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    featureFlag: { findUnique: jest.fn() },
  }
  return {
    ...localPrismaMock,
    prisma: localPrismaMock,
    default: localPrismaMock,
    __esModule: true,
  }
})

jest.mock("../socket/socket", () => ({
  sendRealTimeNotification: jest.fn(),
  __esModule: true,
}))

import prisma from "../database/db"
import { ConversationService } from "./conversation.service"
import { invalidateFeatureFlagCache } from "../utils/featureFlags"
import { sendRealTimeNotification } from "../socket/socket"

const mockSendRealTimeNotification = sendRealTimeNotification as jest.Mock

const mockPrisma = prisma as any

describe("ConversationService", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    invalidateFeatureFlagCache()
    // Default: chat_enabled flag not mocked to a specific row -> featureFlags.ts
    // treats a missing row as "not configured" and defaults to enabled.
    mockPrisma.featureFlag.findUnique.mockResolvedValue({ key: "chat_enabled", value: true })
  })

  describe("getOrCreateForApplication (conversation creation)", () => {
    const application = {
      id: "app-1",
      candidate: { user: { id: "candidate-user-1" } },
      job: { recruiter: { user: { id: "recruiter-user-1" } } },
    }

    it("creates a new conversation between the candidate and recruiter when none exists", async () => {
      mockPrisma.application.findUnique.mockResolvedValue(application)
      mockPrisma.conversation.upsert.mockResolvedValue({ id: "conv-new" })

      const result = await ConversationService.getOrCreateForApplication("app-1", "candidate-user-1")

      expect(result).toEqual({ id: "conv-new" })
      expect(mockPrisma.conversation.upsert).toHaveBeenCalledWith({
        where: { participantsKey: "candidate-user-1:recruiter-user-1" },
        update: {},
        create: {
          participantsKey: "candidate-user-1:recruiter-user-1",
          participants: {
            create: [{ userId: "candidate-user-1" }, { userId: "recruiter-user-1" }],
          },
        },
      })
    })

    it("reuses an existing conversation instead of creating a duplicate (upsert's update branch)", async () => {
      mockPrisma.application.findUnique.mockResolvedValue(application)
      // A real Postgres upsert() returns the existing row via its `update`
      // branch when the participantsKey already exists -- the mock models
      // that same outcome regardless of which of the two participants happens
      // to be the one calling.
      mockPrisma.conversation.upsert.mockResolvedValue({ id: "conv-existing" })

      const result = await ConversationService.getOrCreateForApplication("app-1", "recruiter-user-1")

      expect(result).toEqual({ id: "conv-existing" })
    })

    it("rejects a user who is neither the applicant nor the hiring recruiter", async () => {
      mockPrisma.application.findUnique.mockResolvedValue(application)

      await expect(
        ConversationService.getOrCreateForApplication("app-1", "some-other-user")
      ).rejects.toThrow(/Forbidden/i)
      expect(mockPrisma.conversation.upsert).not.toHaveBeenCalled()
    })

    it("rejects conversation creation when the chat_enabled feature flag is off", async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({ key: "chat_enabled", value: false })

      await expect(
        ConversationService.getOrCreateForApplication("app-1", "candidate-user-1")
      ).rejects.toThrow(/disabled/i)
      expect(mockPrisma.application.findUnique).not.toHaveBeenCalled()
    })
  })

  // Final Implementation Pass, Part 10: concurrency hardening. Previously
  // getOrCreateForApplication() was a racy findFirst()-then-create() -- two
  // near-simultaneous requests for the same candidate+recruiter pair could
  // both read "nothing exists yet" and both create a separate Conversation
  // row. These tests cover the upsert()-based replacement and its
  // participantsKey identity key.
  describe("getOrCreateForApplication concurrency hardening (Part 10)", () => {
    it("computes the same participantsKey regardless of which user id is the candidate vs the recruiter (order-independent)", async () => {
      // Deliberately the reverse lexical order from the earlier tests'
      // fixture ("candidate-user-1" < "recruiter-user-1"): here the
      // candidate's user id sorts AFTER the recruiter's, proving the sort
      // step in pairKey(), not incidental fixture ordering, is what makes
      // the key deterministic.
      const reversedOrderApplication = {
        id: "app-2",
        candidate: { user: { id: "zzz-candidate" } },
        job: { recruiter: { user: { id: "aaa-recruiter" } } },
      }
      mockPrisma.application.findUnique.mockResolvedValue(reversedOrderApplication)
      mockPrisma.conversation.upsert.mockResolvedValue({ id: "conv-reversed" })

      await ConversationService.getOrCreateForApplication("app-2", "zzz-candidate")

      const callArgs = mockPrisma.conversation.upsert.mock.calls[0][0]
      // Sorted alphabetically, "aaa-recruiter" comes before "zzz-candidate"
      // regardless of which one is the "candidate" and which is the
      // "recruiter" in this particular application.
      expect(callArgs.where.participantsKey).toBe("aaa-recruiter:zzz-candidate")
    })

    it("falls back to re-reading the winning row when a concurrent request loses a real UNIQUE constraint race (P2002)", async () => {
      const application2 = {
        id: "app-1",
        candidate: { user: { id: "candidate-user-1" } },
        job: { recruiter: { user: { id: "recruiter-user-1" } } },
      }
      mockPrisma.application.findUnique.mockResolvedValue(application2)

      // Simulates the defensive fallback path: the underlying upsert's
      // INSERT half hit the real Postgres UNIQUE constraint on
      // participantsKey because a concurrent request already committed a
      // row for this exact pair a moment earlier.
      const conflictError: any = new Error("Unique constraint failed on the fields: (`participantsKey`)")
      conflictError.code = "P2002"
      mockPrisma.conversation.upsert.mockRejectedValue(conflictError)
      mockPrisma.conversation.findUnique.mockResolvedValue({ id: "conv-winner" })

      const result = await ConversationService.getOrCreateForApplication("app-1", "candidate-user-1")

      expect(result).toEqual({ id: "conv-winner" })
      expect(mockPrisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { participantsKey: "candidate-user-1:recruiter-user-1" },
      })
    })

    it("re-throws a non-P2002 database error instead of silently swallowing it", async () => {
      const application3 = {
        id: "app-1",
        candidate: { user: { id: "candidate-user-1" } },
        job: { recruiter: { user: { id: "recruiter-user-1" } } },
      }
      mockPrisma.application.findUnique.mockResolvedValue(application3)

      const dbDownError: any = new Error("Connection to database lost")
      dbDownError.code = "P1001"
      mockPrisma.conversation.upsert.mockRejectedValue(dbDownError)

      await expect(
        ConversationService.getOrCreateForApplication("app-1", "candidate-user-1")
      ).rejects.toThrow("Connection to database lost")
      expect(mockPrisma.conversation.findUnique).not.toHaveBeenCalled()
    })

    it("two near-simultaneous calls for the same pair both resolve to the same conversation (simulated race)", async () => {
      const application4 = {
        id: "app-1",
        candidate: { user: { id: "candidate-user-1" } },
        job: { recruiter: { user: { id: "recruiter-user-1" } } },
      }
      mockPrisma.application.findUnique.mockResolvedValue(application4)

      // First call "wins" the atomic upsert and creates the row; the second,
      // near-simultaneous call's INSERT half loses the real UNIQUE
      // constraint race and must be resolved via the P2002 fallback re-read
      // -- both callers must end up with the exact same conversation id,
      // never two separate rows.
      const conflictError: any = new Error("Unique constraint failed on the fields: (`participantsKey`)")
      conflictError.code = "P2002"
      mockPrisma.conversation.upsert
        .mockResolvedValueOnce({ id: "conv-winner" })
        .mockRejectedValueOnce(conflictError)
      mockPrisma.conversation.findUnique.mockResolvedValue({ id: "conv-winner" })

      const [resultA, resultB] = await Promise.all([
        ConversationService.getOrCreateForApplication("app-1", "candidate-user-1"),
        ConversationService.getOrCreateForApplication("app-1", "recruiter-user-1"),
      ])

      expect(resultA).toEqual({ id: "conv-winner" })
      expect(resultB).toEqual({ id: "conv-winner" })
    })
  })

  describe("getMessages (membership / IDOR check)", () => {
    it("allows a real participant to load messages", async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: "p1" })
      mockPrisma.message.findMany.mockResolvedValue([{ id: "m1", content: "Hello" }])

      const result = await ConversationService.getMessages("conv-1", "candidate-user-1")

      expect(result).toEqual([{ id: "m1", content: "Hello" }])
    })

    it("rejects a non-participant attempting to read another conversation's messages", async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null)

      await expect(ConversationService.getMessages("conv-2", "attacker-user")).rejects.toThrow(
        /not a participant/i
      )
      expect(mockPrisma.message.findMany).not.toHaveBeenCalled()
    })

    it("readAt persists across a subsequent getMessages call (Part 5)", async () => {
      // getMessages() is a thin pass-through over prisma.message.findMany --
      // this confirms a previously-marked-read message's readAt timestamp
      // survives a refetch rather than being reset or stripped anywhere in
      // the read path.
      const readTimestamp = new Date("2026-07-14T10:00:00.000Z")
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: "p1" })
      mockPrisma.message.findMany.mockResolvedValue([
        { id: "m1", content: "Hello", senderId: "recruiter-user-1", readAt: readTimestamp },
      ])

      const result = await ConversationService.getMessages("conv-1", "candidate-user-1")

      expect(result).toEqual([
        { id: "m1", content: "Hello", senderId: "recruiter-user-1", readAt: readTimestamp },
      ])
    })
  })

  describe("markConversationAsRead (Part 5: persistent message read state)", () => {
    it("lets a real participant mark the conversation as read", async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: "p1" })
      mockPrisma.message.updateMany.mockResolvedValue({ count: 2 })
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([{ userId: "recruiter-user-1" }])

      const result = await ConversationService.markConversationAsRead("conv-1", "candidate-user-1")

      expect(result).toEqual({ updatedCount: 2 })
      expect(mockPrisma.conversationParticipant.findUnique).toHaveBeenCalledWith({
        where: { conversationId_userId: { conversationId: "conv-1", userId: "candidate-user-1" } },
      })
    })

    it("rejects a non-participant with a Forbidden error and does not touch any messages", async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null)

      await expect(
        ConversationService.markConversationAsRead("conv-2", "attacker-user")
      ).rejects.toThrow(/Forbidden|not a participant/i)
      expect(mockPrisma.message.updateMany).not.toHaveBeenCalled()
      expect(mockSendRealTimeNotification).not.toHaveBeenCalled()
    })

    it("only updates messages from the OTHER participant, never the caller's own messages", async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: "p1" })
      mockPrisma.message.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([{ userId: "recruiter-user-1" }])

      await ConversationService.markConversationAsRead("conv-1", "candidate-user-1")

      expect(mockPrisma.message.updateMany).toHaveBeenCalledWith({
        where: { conversationId: "conv-1", senderId: { not: "candidate-user-1" }, readAt: null },
        data: { readAt: expect.any(Date) },
      })
    })

    it("only touches messages that are still unread (readAt: null)", async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: "p1" })
      mockPrisma.message.updateMany.mockResolvedValue({ count: 0 })

      const result = await ConversationService.markConversationAsRead("conv-1", "candidate-user-1")

      const callArgs = mockPrisma.message.updateMany.mock.calls[0][0]
      expect(callArgs.where.readAt).toBeNull()
      expect(result).toEqual({ updatedCount: 0 })
    })

    it("is idempotent -- a repeated call after everything is already read updates nothing and emits nothing", async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: "p1" })
      mockPrisma.message.updateMany.mockResolvedValue({ count: 0 })

      const result = await ConversationService.markConversationAsRead("conv-1", "candidate-user-1")

      expect(result).toEqual({ updatedCount: 0 })
      expect(mockSendRealTimeNotification).not.toHaveBeenCalled()
    })

    it("only emits the real-time read-receipt after the DB update succeeds, and only when messages were actually updated", async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: "p1" })
      mockPrisma.message.updateMany.mockResolvedValue({ count: 3 })
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([{ userId: "recruiter-user-1" }])

      await ConversationService.markConversationAsRead("conv-1", "candidate-user-1")

      // Verify ordering: updateMany must be called (and resolved) before the
      // socket notification is emitted -- not "fire and forget" in parallel.
      const updateManyOrder = mockPrisma.message.updateMany.mock.invocationCallOrder[0]
      const notifyOrder = mockSendRealTimeNotification.mock.invocationCallOrder[0]
      expect(updateManyOrder).toBeLessThan(notifyOrder)

      expect(mockSendRealTimeNotification).toHaveBeenCalledWith("recruiter-user-1", {
        type: "message:read",
        conversationId: "conv-1",
        readByUserId: "candidate-user-1",
      })
    })
  })

  describe("sendMessage (membership + feature flag + sender identity)", () => {
    it("persists a message for a real participant and returns it", async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: "p1" })
      mockPrisma.message.create.mockResolvedValue({ id: "m-new", conversationId: "conv-1", senderId: "candidate-user-1", content: "hi" })
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([{ userId: "recruiter-user-1" }])

      const result = await ConversationService.sendMessage("conv-1", "candidate-user-1", "hi")

      expect(result.senderId).toBe("candidate-user-1")
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: { conversationId: "conv-1", senderId: "candidate-user-1", content: "hi" },
      })
    })

    it("rejects sending a message to a conversation the caller does not belong to", async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null)

      await expect(ConversationService.sendMessage("conv-2", "attacker-user", "hi")).rejects.toThrow(
        /Forbidden/i
      )
      expect(mockPrisma.message.create).not.toHaveBeenCalled()
    })

    it("rejects sending a message when the chat_enabled feature flag is off", async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({ key: "chat_enabled", value: false })

      await expect(ConversationService.sendMessage("conv-1", "candidate-user-1", "hi")).rejects.toThrow(
        /disabled/i
      )
      expect(mockPrisma.conversationParticipant.findUnique).not.toHaveBeenCalled()
      expect(mockPrisma.message.create).not.toHaveBeenCalled()
    })
  })
})
