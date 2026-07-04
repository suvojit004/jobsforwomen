import { Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { candidate } from "@/data/candidate"

export function CareerBreakCard() {
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
        {candidate.careerBreak.duration}
      </p>
      <p className="mt-1 text-xs font-semibold text-[#6B2C91] dark:text-pink-200">
        Reason: {candidate.careerBreak.reason}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {candidate.careerBreak.summary}
      </p>
    </DashboardCard>
  )
}
