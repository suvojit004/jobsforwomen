import prisma from "../database/db"

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

    return prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
      },
    })
  }
}
