import type { LucideIcon } from "lucide-react"
import { BriefcaseBusiness } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  title: string
  description: string
  actionLabel?: string
  icon?: LucideIcon
  className?: string
  onActionClick?: () => void
}

export function EmptyState({
  title,
  description,
  actionLabel,
  icon: Icon = BriefcaseBusiness,
  className,
  onActionClick,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-violet-200 bg-gradient-to-br from-white to-violet-50/70 p-8 text-center dark:border-violet-400/20 dark:from-slate-900 dark:to-violet-500/10",
        className
      )}
    >
      <div className="relative mb-4 flex size-16 items-center justify-center rounded-full bg-violet-100 text-[#6B2C91] shadow-inner dark:bg-violet-500/20 dark:text-pink-100">
        <span className="absolute -right-1 -top-1 size-5 rounded-full bg-pink-200 dark:bg-pink-500/40" />
        <Icon className="relative size-7" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {actionLabel && (
        <Button onClick={onActionClick} className="mt-4 bg-[#6B2C91] hover:bg-[#5a237b]">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
