import { useState, useTransition, useEffect } from "react"
import { motion } from "framer-motion"
import { Search, CheckCheck, BellRing } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { NotificationList } from "../components/Notifications/NotificationList"
import { candidateApi } from "../services/candidateApi"
import type { NotificationItemType } from "@/types/notification"
import { cn } from "@/lib/utils"

function mapApiNotificationToItemType(n: any): NotificationItemType {
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
    title: n.title,
    description: n.message || n.description || "",
    category: n.category || "General",
    read: !!n.read,
    time: timeStr,
    dateGroup
  }
}

export function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItemType[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(true)
  const [, startTransition] = useTransition()

  async function loadNotifications() {
    try {
      const list = await candidateApi.getNotifications()
      setNotifications((list || []).map(mapApiNotificationToItemType))
    } catch (err) {
      console.error("Failed to load notifications", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const handleMarkRead = async (id: string) => {
    try {
      await candidateApi.markNotificationRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    } catch (err) {
      console.error("Failed to mark notification read", err)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await candidateApi.deleteNotification(id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      console.error("Failed to delete notification", err)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await candidateApi.markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (err) {
      console.error("Failed to mark all notifications read", err)
    }
  }

  // Count unread items
  const unreadCount = notifications.filter((n) => !n.read).length

  // Filter application
  const filteredNotifications = notifications.filter((n) => {
    // Search query match
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!n.title.toLowerCase().includes(q) && !n.description.toLowerCase().includes(q)) {
        return false
      }
    }

    // Category match
    if (categoryFilter !== "All" && n.category !== categoryFilter) {
      return false
    }

    // Unread match
    if (unreadOnly && n.read) {
      return false
    }

    return true
  })

  const handleCategoryChange = (cat: string) => {
    startTransition(() => {
      setCategoryFilter(cat)
    })
  }

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading notifications...</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
            Notification Center
            {unreadCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Stay updated with profile views, application responses, and interviews.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            type="button"
            onClick={handleMarkAllRead}
            className="self-start sm:self-auto bg-[#6B2C91] text-white hover:bg-[#5a237b] h-9 gap-1.5 font-extrabold text-xs"
          >
            <CheckCheck className="size-4" />
            Mark All Read
          </Button>
        )}
      </div>

      {/* Filter Control Deck */}
      <DashboardCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>

        {/* Categories Tabs & Toggle */}
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="flex gap-1.5 bg-slate-50 p-1 rounded-lg dark:bg-slate-950/40">
            {["All", "Jobs", "Interviews", "General"].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={cn(
                  "px-2.5 py-1 text-xs font-bold rounded transition-colors",
                  categoryFilter === cat
                    ? "bg-[#6B2C91] text-white"
                    : "text-slate-600 hover:text-[#6B2C91] dark:text-slate-400 dark:hover:text-white"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950"
            />
            Unread Only
          </label>
        </div>
      </DashboardCard>

      {/* Notifications list */}
      <div className="relative min-h-[300px]">
        {filteredNotifications.length > 0 ? (
          <NotificationList
            notifications={filteredNotifications}
            onMarkRead={handleMarkRead}
            onDelete={handleDelete}
          />
        ) : (
          <div className="py-12">
            <EmptyState
              icon={BellRing}
              title="No Notifications"
              description="No new updates or alerts match your current filter settings. We will notify you when things change."
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}
