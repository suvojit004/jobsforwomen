import React, { createContext, useContext, useState, useEffect } from "react"
import { useAuth } from "./AuthContext"
import { AdminApi } from "@/features/admin/services/adminApi"
import { RecruiterApi } from "@/features/recruiter/services/recruiterApi"
import { candidateApi } from "@/features/candidate/services/candidateApi"
import { getSocket, disconnectSocket } from "@/api/socket"

export interface NotificationItem {
  id: string
  title: string
  description: string
  category: string
  read: boolean
  time: string
  dateGroup: "Today" | "Yesterday" | "Earlier"
  // Backend-generated internal path (see notification.listener.ts's
  // createAndEmitNotification callers) -- never a full/external URL.
  actionUrl?: string
}

// Only ever treat this as a same-app client-side route: it must start with
// exactly one leading "/" (a bare root-relative path). This rejects
// protocol-relative ("//evil.com") and absolute ("https://...") strings a
// future backend bug could otherwise produce, since this value ultimately
// flows into `navigate()`. Defense in depth -- values in this app already
// come only from our own backend, never from user input.
export function isSafeInternalPath(url?: string | null): url is string {
  return !!url && url.startsWith("/") && !url.startsWith("//")
}

interface NotificationContextType {
  notifications: NotificationItem[]
  unreadCount: number
  isLoading: boolean
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

function mapApiNotification(n: any): NotificationItem {
  const createdDate = new Date(n.createdAt || Date.now())
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  let dateGroup: "Today" | "Yesterday" | "Earlier" = "Earlier"
  if (createdDate.toDateString() === today.toDateString()) {
    dateGroup = "Today"
  } else if (createdDate.toDateString() === yesterday.toDateString()) {
    dateGroup = "Yesterday"
  }

  const timeStr = createdDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  })

  return {
    id: n.id,
    title: n.title || "Alert",
    description: n.message || n.description || "",
    category: n.category || "General",
    read: !!n.read,
    time: timeStr,
    dateGroup,
    actionUrl: n.actionUrl || undefined,
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Resolve API based on roles
  const getApiForRole = () => {
    if (!user) return null
    const roles = user.roles || []
    if (roles.includes("Super Admin") || roles.includes("Admin")) {
      return AdminApi
    }
    if (roles.includes("Recruiter")) {
      return RecruiterApi
    }
    return candidateApi
  }

  const getNamespaceForRole = (): "candidate" | "recruiter" | "admin" => {
    const roles = user?.roles || []
    if (roles.includes("Super Admin") || roles.includes("Admin")) return "admin"
    if (roles.includes("Recruiter")) return "recruiter"
    return "candidate"
  }

  const fetchNotifications = async () => {
    if (!isAuthenticated || !user) return
    const api = getApiForRole()
    if (!api) return

    try {
      setIsLoading(true)
      const list = await api.getNotifications()
      setNotifications((list || []).map(mapApiNotification))
    } catch (error) {
      console.error("Error loading notifications from API:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    const api = getApiForRole()
    if (!api) return
    try {
      // Optimistic UI update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      await api.markNotificationRead(id)
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
      fetchNotifications() // rollback
    }
  }

  const markAllAsRead = async () => {
    const api = getApiForRole()
    if (!api) return
    try {
      // Optimistic UI update
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      await api.markAllNotificationsRead()
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error)
      fetchNotifications() // rollback
    }
  }

  const deleteNotification = async (id: string) => {
    const api = getApiForRole()
    if (!api) return
    try {
      // Optimistic UI update
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      await api.deleteNotification(id)
    } catch (error) {
      console.error("Failed to delete notification:", error)
      fetchNotifications() // rollback
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications()
    } else {
      setNotifications([])
    }
  }, [isAuthenticated, user?.id])

  // Live updates: the bell previously only refreshed on login/identity change,
  // so a notification created while the user was already browsing wouldn't
  // show up until the next reload. The backend already emits a "notification"
  // socket event on every real Notification row it creates (see
  // notification.listener.ts) -- chat also reuses that same event name for a
  // lightweight "a new message arrived" ping (type === "message"), which we
  // deliberately ignore here since chat has its own inbox.
  useEffect(() => {
    if (!isAuthenticated || !user) return

    const socket = getSocket(getNamespaceForRole())

    const handleRealtimeNotification = (payload: any) => {
      if (!payload || payload.type === "message") return
      setNotifications((prev) => {
        if (prev.some((n) => n.id === payload.id)) return prev
        return [mapApiNotification(payload), ...prev]
      })
    }

    socket.on("notification", handleRealtimeNotification)

    return () => {
      socket.off("notification", handleRealtimeNotification)
    }
  }, [isAuthenticated, user?.id])

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket()
    }
  }, [isAuthenticated])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refresh: fetchNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotificationContext() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotificationContext must be used within a NotificationProvider")
  }
  return context
}
