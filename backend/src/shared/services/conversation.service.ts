import prisma from "../database/db"
import { sendRealTimeNotification } from "../socket/socket"
import { logger } from "../utils/logger"

export class ConversationService {
  static async getConversations(userId: string) {
    return prisma.conversation.findMany({
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
}
