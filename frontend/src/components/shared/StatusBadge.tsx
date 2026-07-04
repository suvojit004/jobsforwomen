import type { ApplicationStatus } from "@/types/dashboard"
import { cn } from "@/lib/utils"

const statusClasses: Record<ApplicationStatus, string> = {
  Applied:
    "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20",
  "Under Review":
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/20",
  "Interview Scheduled":
    "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-200 dark:ring-orange-400/20",
  Selected:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/20",
  Rejected:
    "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-600",
}

type StatusBadgeProps = {
  status: ApplicationStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-[11px] font-semibold ring-1",
        statusClasses[status],
        className
      )}
    >
      {status}
    </span>
  )
}
