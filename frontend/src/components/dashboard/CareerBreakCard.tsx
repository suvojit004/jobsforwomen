import { Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"

type CareerBreakCardProps = {
  careerBreak?: {
    hasBreak: boolean
    reason: string
    duration: string
    summary: string
  }
}

export function CareerBreakCard({ careerBreak }: CareerBreakCardProps) {
  if (!careerBreak || !careerBreak.hasBreak) return null

  return (
    <DashboardCard className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
          Career Break
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-[#6B2C91] dark:text-pink-200"
        >
          <Edit3 className="size-3.5" />
          Edit
        </Button>
      </div>
      <p className="text-sm font-extrabold text-slate-950 dark:text-white">
        {careerBreak.duration}
      </p>
      <p className="mt-1 text-xs font-semibold text-[#6B2C91] dark:text-pink-200">
        Reason: {careerBreak.reason}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {careerBreak.summary}
      </p>
    </DashboardCard>
  )
}
