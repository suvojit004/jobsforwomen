import { initialNotifications } from "@/mock/notifications/notificationsMock"
import type { Notification } from "@/types/notification"

export class NotificationService {
  private static notificationsList: Notification[] = [...initialNotifications] as any

  static async getNotifications(): Promise<Notification[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.notificationsList), 100)
    })
  }

  static async markAsRead(id: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.notificationsList = this.notificationsList.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
      setTimeout(() => resolve(true), 80)
    })
  }

  static async clearNotification(id: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.notificationsList = this.notificationsList.filter((n) => n.id !== id)
      setTimeout(() => resolve(true), 80)
    })
  }
}
export default NotificationService
