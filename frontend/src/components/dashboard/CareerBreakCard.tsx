import { Briefcase } from "lucide-react"
import { DashboardCard } from "@/components/dashboard/DashboardCard"

export type CareerBreak = {
  hasBreak: boolean
  reason: string
  duration: string
  summary: string
}

type CareerBreakCardProps = {
  careerBreak?: CareerBreak
  isEditing?: boolean
  onChange?: (fields: Partial<CareerBreak>) => void
}

export function CareerBreakCard({ careerBreak, isEditing, onChange }: CareerBreakCardProps) {
  if (!careerBreak) return null

  if (!isEditing) {
    return (
      <DashboardCard className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
            <Briefcase className="size-4 text-[#6B2C91] dark:text-pink-300" />
            Career Break
          </h2>
        </div>

        {!careerBreak.hasBreak ? (
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
            No career break recorded. Use "Edit Profile" above to add one if applicable.
          </p>
        ) : (
          <>
            <p className="text-sm font-extrabold text-slate-950 dark:text-white break-words">
              {careerBreak.duration || "Duration not specified"}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#6B2C91] dark:text-pink-200 break-words">
              Reason: {careerBreak.reason || "Not specified"}
            </p>
            {careerBreak.summary && (
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300 break-words">
                {careerBreak.summary}
              </p>
            )}
          </>
        )}
      </DashboardCard>
    )
  }

  // Editing mode -- ties into the page's shared Edit Profile / Save Changes toggle
  return (
    <DashboardCard className="p-4">
      <h2 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
        <Briefcase className="size-4 text-[#6B2C91] dark:text-pink-300" />
        Career Break
      </h2>

      <label className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={careerBreak.hasBreak}
          onChange={(e) => onChange?.({ hasBreak: e.target.checked })}
          className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950"
        />
        I have taken a career break
      </label>

      {careerBreak.hasBreak && (
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="careerBreakReason" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
              Reason
            </label>
            <input
              id="careerBreakReason"
              type="text"
              placeholder="e.g. Maternity Leave, Higher Studies..."
              value={careerBreak.reason}
              onChange={(e) => onChange?.({ reason: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="careerBreakDuration" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
              Duration
            </label>
            <input
              id="careerBreakDuration"
              type="text"
              placeholder="e.g. 1 Year, 6 Months..."
              value={careerBreak.duration}
              onChange={(e) => onChange?.({ duration: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="careerBreakSummary" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
              Summary
            </label>
            <textarea
              id="careerBreakSummary"
              rows={3}
              placeholder="Briefly describe what this time was spent on..."
              value={careerBreak.summary}
              onChange={(e) => onChange?.({ summary: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
