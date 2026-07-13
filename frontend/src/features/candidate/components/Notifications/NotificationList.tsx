import { Bell, Briefcase, Calendar, Check, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import type { NotificationItemType } from "@/types/notification"
import { cn } from "@/lib/utils"

type NotificationListProps = {
  notifications: NotificationItemType[]
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
  // Optional: called when the card itself (not the mark-read/dismiss
  // buttons) is clicked. The parent page owns navigation since it has
  // access to useNavigate().
  onItemClick?: (n: NotificationItemType) => void
}

export function NotificationList({
  notifications,
  onMarkRead,
  onDelete,
  onItemClick,
}: NotificationListProps) {
  // Category helper to render correct icons and colors
  const getCategoryConfig = (category: NotificationItemType["category"]) => {
    switch (category) {
      case "Jobs":
        return {
          icon: Briefcase,
          bgClass: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
        }
      case "Interviews":
        return {
          icon: Calendar,
          bgClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
        }
      case "General":
      default:
        return {
          icon: Bell,
          bgClass: "bg-violet-50 text-[#6B2C91] dark:bg-violet-500/10 dark:text-pink-200",
        }
    }
  }

  // Group notifications by date group (Today, Yesterday, Earlier)
  const groups: { [key: string]: NotificationItemType[] } = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  }

  notifications.forEach((n) => {
    if (groups[n.dateGroup]) {
      groups[n.dateGroup].push(n)
    } else {
      groups.Earlier.push(n)
    }
  })

  const groupKeys = ["Today", "Yesterday", "Earlier"].filter(
    (key) => groups[key] && groups[key].length > 0
  )

  return (
    <div className="space-y-6">
      {groupKeys.map((groupKey) => (
        <div key={groupKey} className="space-y-3">
          <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase dark:text-slate-500">
            {groupKey}
          </h3>
          <div className="space-y-3">
            {groups[groupKey].map((n) => {
              const config = getCategoryConfig(n.category)
              const Icon = config.icon

              return (
                <DashboardCard
                  key={n.id}
                  onClick={onItemClick ? () => onItemClick(n) : undefined}
                  className={cn(
                    "p-4 border transition-all relative overflow-hidden",
                    onItemClick && "cursor-pointer hover:border-[#6B2C91]/30 dark:hover:border-pink-400/40",
                    n.read
                      ? "border-slate-200/60 dark:border-slate-800"
                      : "border-violet-100 bg-violet-50/10 dark:border-violet-400/20 dark:bg-violet-500/5 shadow-sm"
                  )}
                >
                  <div className="flex items-start gap-3.5 pr-14">
                    {/* Unread purple indicator dot */}
                    {!n.read && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 size-2 rounded-full bg-[#6B2C91] dark:bg-pink-400" />
                    )}

                    {/* Icon container */}
                    <div
                      className={cn(
                        "size-9 rounded-lg flex items-center justify-center shrink-0",
                        config.bgClass
                      )}
                    >
                      <Icon className="size-4.5" />
                    </div>

                    {/* Content */}
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold shrink-0">
                          {n.time}
                        </span>
                      </div>
                      <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                        {n.description}
                      </p>
                    </div>
                  </div>

                  {/* Actions (Floating right side) */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {!n.read && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          onMarkRead(n.id)
                        }}
                        className="size-7 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                        title="Mark as read"
                      >
                        <Check className="size-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(n.id)
                      }}
                      className="size-7 text-slate-400 hover:text-red-500"
                      title="Dismiss alert"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </DashboardCard>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
