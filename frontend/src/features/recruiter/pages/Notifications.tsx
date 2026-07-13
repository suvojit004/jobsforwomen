import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Briefcase,
  Calendar,
  Sparkles,
  Award,
  Check,
  CheckCheck,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { cn } from "@/lib/utils"

interface RecruiterNotification {
  id: string
  title: string
  description: string
  time: string
  type: "application" | "interview" | "system" | "partner"
  read: boolean
  actionUrl?: string
}

import { useNotificationContext, isSafeInternalPath } from "@/contexts/NotificationContext"

export function Notifications() {
  const navigate = useNavigate()
  const {
    notifications: contextNotifications,
    isLoading,
    markAsRead: handleMarkRead,
    markAllAsRead: handleMarkAllRead,
    deleteNotification: handleClearSingle,
  } = useNotificationContext()

  const [activeTab, setActiveTab] = useState<"all" | "unread" | "applications" | "interviews">("all")

  const notifications: RecruiterNotification[] = contextNotifications.map((n) => {
    let type: "application" | "interview" | "system" | "partner" = "system"
    const cat = n.category.toLowerCase()
    if (cat.includes("application")) type = "application"
    else if (cat.includes("interview")) type = "interview"
    else if (cat.includes("partner") || cat.includes("verification")) type = "partner"

    return {
      id: n.id,
      title: n.title,
      description: n.description,
      time: n.time,
      type,
      read: n.read,
      actionUrl: n.actionUrl,
    }
  })

  // Fire-and-forget mark-read so a slow/failed API call never blocks the
  // navigation the user just asked for by clicking the card.
  const handleItemClick = (n: RecruiterNotification) => {
    if (!n.read) handleMarkRead(n.id)
    if (isSafeInternalPath(n.actionUrl)) navigate(n.actionUrl)
  }

  // Clear all notifications
  const handleClearAll = async () => {
    try {
      await handleMarkAllRead()
    } catch (err) {
      console.error(err)
    }
  }

  // Filter notifications based on tab
  const filtered = notifications.filter((n) => {
    if (activeTab === "unread") return !n.read
    if (activeTab === "applications") return n.type === "application"
    if (activeTab === "interviews") return n.type === "interview"
    return true
  })

  // Get icon based on category type
  const getCategoryIcon = (type: RecruiterNotification["type"]) => {
    switch (type) {
      case "application":
        return <Briefcase className="size-4 text-[#6B2C91] dark:text-pink-300" />
      case "interview":
        return <Calendar className="size-4 text-emerald-500" />
      case "partner":
        return <Award className="size-4 text-pink-500 fill-pink-500/20" />
      default:
        return <Sparkles className="size-4 text-blue-500" />
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading notifications...</div>
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
            Notifications Center
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            View logs, updates on applicant slots, and system integrations.
          </p>
        </div>

        {notifications.some((n) => !n.read) && (
          <Button
            onClick={handleMarkAllRead}
            variant="outline"
            className="h-9 font-bold text-xs gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <CheckCheck className="size-4" />
            Mark All Read
          </Button>
        )}
      </div>

      {/* Tabs list and Clear panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-1">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "unread", "applications", "interviews"] as const).map((tab) => {
            const count =
              tab === "all"
                ? notifications.length
                : tab === "unread"
                  ? notifications.filter((n) => !n.read).length
                  : tab === "applications"
                    ? notifications.filter((n) => n.type === "application").length
                    : notifications.filter((n) => n.type === "interview").length

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-2 text-xs font-black capitalize border-b-2 transition-all cursor-pointer relative",
                  activeTab === tab
                    ? "border-[#6B2C91] text-[#6B2C91] dark:border-pink-500 dark:text-pink-300"
                    : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                )}
              >
                {tab}
                {count > 0 && (
                  <span className="ml-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-extrabold px-1.5 py-0.5 text-slate-500 dark:text-slate-400">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {notifications.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-[11px] font-black text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer self-end sm:self-auto"
          >
            <Trash2 className="size-3.5" />
            Clear All Alerts
          </button>
        )}
      </div>

      {/* Notifications listings container */}
      <DashboardCard className="p-2 divide-y divide-slate-100 dark:divide-slate-850">
        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                onClick={() => handleItemClick(item)}
                className={cn(
                  "p-4 flex items-start gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors group",
                  item.actionUrl && "cursor-pointer",
                  !item.read && "bg-gradient-to-r from-violet-50/20 to-transparent dark:from-violet-500/5"
                )}
              >
                {/* Category Icon */}
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-850 shrink-0">
                  {getCategoryIcon(item.type)}
                </div>

                {/* Info Text */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className={cn(
                      "text-xs text-slate-900 dark:text-white truncate",
                      !item.read ? "font-black" : "font-extrabold"
                    )}>
                      {item.title}
                    </h4>
                    {!item.read && (
                      <span className="size-1.5 rounded-full bg-pink-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">
                    {item.description}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 pt-0.5">
                    {item.time}
                  </p>
                </div>

                {/* Option Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!item.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMarkRead(item.id)
                      }}
                      className="h-8 w-8 text-slate-400 hover:text-emerald-500"
                      title="Mark as Read"
                    >
                      <Check className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClearSingle(item.id)
                    }}
                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                    title="Dismiss"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs font-semibold"
            >
              No notifications to display in this category.
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardCard>
    </div>
  )
}
export default Notifications
