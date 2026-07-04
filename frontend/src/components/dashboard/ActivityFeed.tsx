import {
  Bell,
  CalendarCheck,
  FileDown,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { SectionHeader } from "@/components/dashboard/SectionHeader"
import { NoNotificationsState } from "@/components/shared/EmptyStates"
import { activityFeed } from "@/data/candidate"
import type { Activity } from "@/types/dashboard"

const activityStyles: Record<
  Activity["type"],
  { icon: LucideIcon; className: string }
> = {
  submitted: {
    icon: Send,
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  profile: {
    icon: Bell,
    className:
      "bg-violet-50 text-[#6B2C91] dark:bg-violet-500/20 dark:text-pink-100",
  },
  resume: {
    icon: FileDown,
    className:
      "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  },
  interview: {
    icon: CalendarCheck,
    className:
      "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200",
  },
  rejected: {
    icon: XCircle,
    className: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200",
  },
}

export function ActivityFeed() {
  return (
    <section>
      <SectionHeader
        title="Activity & Notifications"
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-[#6B2C91] dark:text-pink-200"
          >
            View all
          </Button>
        }
      />
      <DashboardCard className="p-4">
        {activityFeed.length > 0 ? (
          <ol className="space-y-4">
            {activityFeed.map((activity, index) => {
              const { icon: Icon, className } = activityStyles[activity.type]

              return (
                <li key={activity.id} className="relative flex gap-3">
                  {index < activityFeed.length - 1 && (
                    <span className="absolute left-4 top-8 h-[calc(100%+0.25rem)] w-px bg-slate-200 dark:bg-slate-800" />
                  )}
                  <span
                    className={`z-10 flex size-8 shrink-0 items-center justify-center rounded-lg ${className}`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-extrabold text-slate-950 dark:text-white">
                        {activity.title}
                      </p>
                      <time className="shrink-0 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {activity.time}
                      </time>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {activity.description}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <NoNotificationsState />
        )}
      </DashboardCard>
    </section>
  )
}
