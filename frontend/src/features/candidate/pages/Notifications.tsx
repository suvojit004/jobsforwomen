import { useState, useTransition } from "react"
import { motion } from "framer-motion"
import { Search, CheckCheck, BellRing } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { NotificationList } from "../components/Notifications/NotificationList"
import { cn } from "@/lib/utils"
import { useNotificationContext } from "@/contexts/NotificationContext"

export function Notifications() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: handleMarkRead,
    markAllAsRead: handleMarkAllRead,
    deleteNotification: handleDelete,
  } = useNotificationContext()

  const [categoryFilter, setCategoryFilter] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false)
  const [, startTransition] = useTransition()

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
