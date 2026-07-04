import { useState, useEffect } from "react"
import { NotificationService } from "@/services/notification.service"
import type { Notification } from "@/types/notification"

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const data = await NotificationService.getNotifications()
      setNotifications(data)
    } catch (error) {
      console.error("Error fetching notifications:", error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await NotificationService.markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    } catch (error) {
      console.error("Error marking notification read:", error)
    }
  }

  const clearNotification = async (id: string) => {
    try {
      await NotificationService.clearNotification(id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch (error) {
      console.error("Error clearing notification:", error)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    fetchNotifications()
  }, [])

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    clearNotification,
    refresh: fetchNotifications,
  }
}
export default useNotifications
