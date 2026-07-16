import prisma from "../database/db"
import { sendRealTimeNotification } from "../socket/socket"
import { logger } from "../utils/logger"
import { isFeatureEnabled } from "../utils/featureFlags"

export class ConversationService {
  // Deterministic, order-independent identity key for the two-party
  // (candidate, recruiter) relationship this schema models -- sorting
  // guarantees "A:B" and "B:A" always produce the same key regardless of
  // which side's request reaches getOrCreateForApplication() first. Must
  // stay in sync with the migration's backfill computation
  // (20260715000000_conversation_participants_key/migration.sql), which
  // sorts the same two userId strings the same way via Postgres string
  // ordering.
  private static pairKey(userIdA: string, userIdB: string): string {
    return [userIdA, userIdB].sort().join(":")
  }

  // CONFIRMED CRITICAL BUG (fixed here): there was no endpoint anywhere in
  // the app -- frontend or backend -- that could ever create a Conversation
  // row. Messages.tsx (both Candidate and Recruiter) only ever called
  // getConversations()/getMessages()/sendMessage() against an existing
  // conversation id; nothing ever called `prisma.conversation.create`
  // outside of this method. On a real production database with zero rows
  // pre-seeded directly in Postgres, the Messages page would show an empty
  // "Select a conversation" state forever, for every user, permanently --
  // the feature was reachable in the UI but functionally dead end-to-end.
  //
  // This finds-or-creates a 1:1 conversation between a candidate and the
  // recruiter side of one of the candidate's job applications (the only
  // relationship in the schema that legitimately links a candidate and a
  // recruiter), scoped by requireOwnership("Application") at the route
  // layer so only the actual applicant or the actual hiring recruiter can
  // open it -- never an arbitrary user pair.
  static async getOrCreateForApplication(applicationId: string, requestingUserId: string) {
    // CONFIRMED ENFORCEMENT (fixed here): the "chat_enabled" feature flag
    // existed in the database and was toggleable from the Admin Feature
    // Configs page, but nothing ever checked it -- see
    // shared/utils/featureFlags.ts. Blocking new conversation creation and
    // new message sends (below) while still allowing existing history to
    // be read matches the task's own example: turning Messaging off must
    // reject new writes, not delete what already happened.
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

    // Final Implementation Pass, Part 10: concurrency hardening.
    // CONFIRMED BUG (fixed here): the previous implementation was a racy
    // findFirst()-then-create() -- if both the candidate and the recruiter
    // opened the chat for the first time within the same few milliseconds
    // (a realistic scenario right after an application is submitted, since
    // both sides get notified at once), both requests could read "no
    // existing conversation" before either had committed its create(), and
    // both would then create() a separate Conversation row for the same
    // pair -- silently splitting later messages across two conversations
    // depending on which row each request's sender happened to read next,
    // with no error and no way for either user to discover the "other"
    // conversation from the UI.
    //
    // upsert() against the real Postgres UNIQUE constraint on
    // participantsKey (see schema.prisma / the migration listed above)
    // replaces that read-then-write race with a single atomic
    // INSERT ... ON CONFLICT (participantsKey) DO UPDATE statement -- two
    // concurrent calls for the same pair can no longer both "win" the
    // create path. The `update: {}` branch is a deliberate no-op: if the
    // row already exists, nothing about it needs to change; it just tells
    // Prisma to return the existing row instead of throwing a conflict.
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

    // Final Implementation Pass, Part 11: real per-conversation unread
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

  // Final Implementation Pass, Part 5: persistent message read state.
  // Previously "message:read" was a pure Socket.IO broadcast (see
  // shared/socket/socket.ts) -- no DB write, no participant check, and a
  // client could claim any messageId as read. This is the real,
  // server-authoritative version: verifies real ConversationParticipant
  // membership (never trusts a client-supplied sender/user id), updates
  // only messages that are actually unread and actually sent by the OTHER
  // participant (a user can never "read" -- or accidentally clear the
  // unread badge for -- their own outgoing messages), and returns exactly
  // how many rows were updated so callers/tests can assert idempotency
  // (a second call with nothing left unread simply updates zero rows,
  // rather than erroring).
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
