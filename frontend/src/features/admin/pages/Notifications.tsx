import { useState, useTransition } from "react"
import { motion } from "framer-motion"
import { Search, CheckCheck, BellRing, Bell, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { cn } from "@/lib/utils"

interface AdminNotificationItem {
  id: string
  title: string
  description: string
  category: "Moderation" | "System" | "Verification"
  read: boolean
  time: string
}

const mockAdminNotifications: AdminNotificationItem[] = [
  {
    id: "an-1",
    title: "New Company Perks Claim",
    description: "InnoTech Corp submitted paid menstrual leave compliance documentation for review.",
    category: "Verification",
    read: false,
    time: "10 mins ago",
  },
  {
    id: "an-2",
    title: "High API Latency Alert",
    description: "Database connection pool reached 85% capacity threshold. Active latency at 180ms.",
    category: "System",
    read: false,
    time: "45 mins ago",
  },
  {
    id: "an-3",
    title: "Job Listing Flagged",
    description: "Technical Writer listing at WriteAway reported by 3 candidates for duplicate content.",
    category: "Moderation",
    read: true,
    time: "3 hours ago",
  },
  {
    id: "an-4",
    title: "Security Config Modified",
    description: "Administrator enabled Multi-Factor Auth (MFA) requirement for policy matrix updates.",
    category: "System",
    read: true,
    time: "1 day ago",
  },
]

export function Notifications() {
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>(mockAdminNotifications)
  const [categoryFilter, setCategoryFilter] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false)
  const [, startTransition] = useTransition()

  const handleMarkRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const filteredNotifications = notifications.filter((n) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!n.title.toLowerCase().includes(q) && !n.description.toLowerCase().includes(q)) {
        return false
      }
    }
    if (categoryFilter !== "All" && n.category !== categoryFilter) {
      return false
    }
    if (unreadOnly && n.read) {
      return false
    }
    return true
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5 select-none"
    >
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-105 pb-4 dark:border-slate-850">
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
            Monitor system-wide alarms, reported postings, and company approvals requests.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            type="button"
            onClick={handleMarkAllRead}
            className="self-start sm:self-auto bg-[#6B2C91] text-white hover:bg-[#5a237b] h-9 gap-1.5 font-extrabold text-xs dark:bg-pink-600 dark:hover:bg-pink-700"
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
            {["All", "Verification", "Moderation", "System"].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => startTransition(() => setCategoryFilter(cat))}
                className={cn(
                  "px-2.5 py-1 text-xs font-bold rounded transition-colors",
                  categoryFilter === cat
                    ? "bg-[#6B2C91] text-white dark:bg-pink-650"
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
              className="rounded border-slate-350 text-[#6B2C91] focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950"
            />
            Unread Only
          </label>
        </div>
      </DashboardCard>

      {/* Notifications list */}
      <div className="relative min-h-[300px] space-y-3">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => (
            <DashboardCard
              key={notif.id}
              className={cn(
                "p-4 flex items-start justify-between gap-4 border-l-4 transition-all",
                notif.read
                  ? "border-l-slate-200 dark:border-l-slate-800"
                  : "border-l-[#6B2C91] dark:border-l-pink-500 bg-[#6B2C91]/5 dark:bg-pink-900/5"
              )}
            >
              <div className="flex gap-3">
                <div className={cn(
                  "p-2 rounded-xl shrink-0 mt-0.5",
                  notif.read
                    ? "bg-slate-100 text-slate-450 dark:bg-slate-800"
                    : "bg-violet-100 text-[#6B2C91] dark:bg-pink-900/20 dark:text-pink-300"
                )}>
                  <Bell className="size-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    {notif.title}
                    {!notif.read && (
                      <span className="size-2 rounded-full bg-pink-550 shrink-0" />
                    )}
                  </h4>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-450 leading-relaxed">
                    {notif.description}
                  </p>
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-450 dark:text-slate-500 pt-1">
                    <span>{notif.category}</span>
                    <span>•</span>
                    <span>{notif.time}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {!notif.read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleMarkRead(notif.id)}
                    className="h-7 text-[10px] font-bold"
                  >
                    Mark read
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(notif.id)}
                  className="h-7 size-7 p-0 text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </DashboardCard>
          ))
        ) : (
          <div className="py-12">
            <EmptyState
              icon={BellRing}
              title="No Notifications"
              description="No new updates or system alerts match your current filters."
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}
export default Notifications
