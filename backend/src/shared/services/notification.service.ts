import prisma from "../database/db"

export class NotificationService {
  static async getNotifications(userId: string, filters: any = {}, pagination: any = {}) {
    const page = Number(pagination.page) || 1
    const limit = Number(pagination.limit) || 20
    const skip = (page - 1) * limit

    const whereClause: any = {
      recipientId: userId,
    }

    if (filters.search) {
      whereClause.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { message: { contains: filters.search, mode: "insensitive" } },
      ]
    }

    if (filters.category) {
      whereClause.category = filters.category
    }

    if (filters.priority) {
      whereClause.priority = filters.priority
    }

    if (filters.read !== undefined) {
      whereClause.read = filters.read === "true" || filters.read === true
    }

    const [notifications, total] = await prisma.$transaction([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: whereClause }),
    ])

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  static async markNotificationRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, recipientId: userId },
      data: { read: true },
    })
  }

  static async markAllNotificationsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { recipientId: userId },
      data: { read: true },
    })
  }

  static async deleteNotification(id: string, userId: string) {
    return prisma.notification.deleteMany({
      where: { id, recipientId: userId },
    })
  }
}
