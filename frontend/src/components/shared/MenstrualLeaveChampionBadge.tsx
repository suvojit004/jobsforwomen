import { Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

type MenstrualLeaveChampionBadgeProps = {
  className?: string
  compact?: boolean
}

export function MenstrualLeaveChampionBadge({
  className,
  compact = false,
}: MenstrualLeaveChampionBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#F3E5F5] via-pink-50 to-violet-100 px-3 py-1.5 text-[11px] font-extrabold text-[#6B2C91] shadow-[0_6px_16px_rgba(107,44,145,0.14)] ring-1 ring-violet-200/70 dark:from-violet-500/25 dark:via-pink-500/15 dark:to-violet-500/20 dark:text-pink-100 dark:ring-violet-400/20",
        className
      )}
    >
      <Trophy className="size-3.5 text-amber-500" aria-hidden="true" />
      <span className="leading-tight">
        <span className="block">Menstrual Leave Champion</span>
        {!compact && (
          <span className="block text-[10px] font-bold opacity-80">
            Premium Partner
          </span>
        )}
      </span>
    </span>
  )
}
