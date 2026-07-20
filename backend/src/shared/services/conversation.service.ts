import prisma from "../database/db"
import { sendRealTimeNotification } from "../socket/socket"
import { logger } from "../utils/logger"
import { isFeatureEnabled } from "../utils/featureFlags"

export class ConversationService {
  // Deterministic, order-independent identity key for the (candidate,
  // recruiter) pair -- sorting guarantees "A:B" and "B:A" produce the same
  // key regardless of request order. Must stay in sync with the migration's
  // backfill computation (20260715000000_conversation_participants_key).
  private static pairKey(userIdA: string, userIdB: string): string {
    return [userIdA, userIdB].sort().join(":")
  }

  // Finds or creates a 1:1 conversation between a candidate and the
  // recruiter side of one of the candidate's applications -- the only
  // relationship that legitimately links the two. Scoped by
  // requireOwnership("Application") at the route layer so only the actual
  // applicant or hiring recruiter can open it.
  static async getOrCreateForApplication(applicationId: string, requestingUserId: string) {
    if (!(await isFeatureEnabled("chat_enabled"))) {
      throw new Error("Forbidden: Messaging is currently disabled by the platform administrator")
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: { include: { user: true } },
        job: { include: { recruiter: { include: { user: true } } } },
      },
    })

    if (!application) {
      throw new Error("Application not found")
    }

    const candidateUserId = application.candidate.user.id
    const recruiterUserId = application.job.recruiter.user.id

    if (requestingUserId !== candidateUserId && requestingUserId !== recruiterUserId) {
      throw new Error("Forbidden: Access denied")
    }

    const participantsKey = ConversationService.pairKey(candidateUserId, recruiterUserId)

    // upsert() against the UNIQUE constraint on participantsKey avoids a
    // findFirst()-then-create() race: two concurrent first-opens for the
    // same pair (realistic right after an application is submitted, since
    // both sides get notified at once) would otherwise both create a
    // separate Conversation row, silently splitting later messages. The
    // `update: {}` branch is a no-op that just returns the existing row.
    try {
      return await prisma.conversation.upsert({
        where: { participantsKey },
        update: {},
        create: {
          participantsKey,
          participants: {
            create: [{ userId: candidateUserId }, { userId: recruiterUserId }],
          },
        },
      })
    } catch (err: any) {
      // Defensive fallback only: if the Prisma/Postgres version in use ever
      // compiles this upsert as separate SELECT+INSERT statements instead
      // of a true atomic ON CONFLICT and two requests still race past each
      // other, the loser's INSERT hits the real UNIQUE constraint and
      // Prisma surfaces it here as P2002 -- simply re-read the winner's row
      // and return that, instead of letting a legitimate concurrent
      // request fail with a 500.
      if (err?.code === "P2002") {
        const winner = await prisma.conversation.findUnique({ where: { participantsKey } })
        if (winner) return winner
      }
      throw err
    }
  }

  static async getConversations(userId: string) {
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                candidateProfile: { select: { fullName: true, avatarUrl: true } },
                recruiterProfile: { select: { fullName: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    })

    // real per-conversation unread
    // counts. Previously the Messages nav/sidebar badge had no real backend
    // count to read at all -- this computes, for the requesting user, how
    // many messages in each conversation were sent by the OTHER participant
    // and have not yet been marked read. Computed as one count() per
    // conversation rather than a single grouped query because Prisma's
    // `groupBy` can't easily express "count where senderId != this specific
    // user" per conversation in one pass without raw SQL, and the list is
    // always small (a user's own conversation count, not a global scan).
    const unreadCounts = await Promise.all(
      conversations.map((c) =>
        prisma.message.count({
          where: { conversationId: c.id, senderId: { not: userId }, readAt: null },
        })
      )
    )

    return conversations.map((c, idx) => ({ ...c, unreadCount: unreadCounts[idx] }))
  }

  static async getMessages(conversationId: string, userId: string) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    })

    if (!participant) {
      throw new Error("Forbidden: You are not a participant in this conversation")
    }

    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: "asc" },
    })
  }

  static async sendMessage(conversationId: string, senderId: string, content: string) {
    if (!(await isFeatureEnabled("chat_enabled"))) {
      throw new Error("Forbidden: Messaging is currently disabled by the platform administrator")
    }

    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId: senderId },
      },
    })

    if (!participant) {
      throw new Error("Forbidden: Access denied")
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
      },
    })

    // Push a real-time signal to every other participant so open chat
    // windows refresh without waiting for a manual reload. This does not
    // create a persisted Notification row -- chat has its own inbox, and
    // every message doesn't need a bell entry.
    try {
      const others = await prisma.conversationParticipant.findMany({
        where: { conversationId, userId: { not: senderId } },
        select: { userId: true },
      })
      for (const { userId } of others) {
        sendRealTimeNotification(userId, {
          type: "message",
          conversationId,
          messageId: message.id,
          senderId,
        })
      }
    } catch (err: any) {
      logger.warn(`[ConversationService] Real-time message emit failed: ${err.message}`)
    }

    return message
  }

  // Server-authoritative message read state: verifies real
  // ConversationParticipant membership, updates only unread messages sent
  // by the OTHER participant (never a user's own outgoing messages), and
  // returns the update count so a second call with nothing unread is a safe
  // no-op rather than an error.
  static async markConversationAsRead(conversationId: string, userId: string) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    })

    if (!participant) {
      throw new Error("Forbidden: You are not a participant in this conversation")
    }

    const result = await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    })

    // Socket emission only happens AFTER the DB mutation has actually
    // committed, and only when something real changed -- an idempotent
    // repeat call (nothing left unread) must not re-broadcast a no-op read
    // event to the other participant.
    if (result.count > 0) {
      try {
        const others = await prisma.conversationParticipant.findMany({
          where: { conversationId, userId: { not: userId } },
          select: { userId: true },
        })
        for (const { userId: otherUserId } of others) {
          sendRealTimeNotification(otherUserId, {
            type: "message:read",
            conversationId,
            readByUserId: userId,
          })
        }
      } catch (err: any) {
        logger.warn(`[ConversationService] Real-time read-receipt emit failed: ${err.message}`)
      }
    }

    return { updatedCount: result.count }
  }
}
