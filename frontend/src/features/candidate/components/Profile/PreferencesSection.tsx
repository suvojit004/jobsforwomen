import { useState } from "react"
import { Compass, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import type { JobPreferences } from "../../types/candidate"

type PreferencesSectionProps = {
  preferences: JobPreferences
  isEditing: boolean
  onChange: (fields: Partial<JobPreferences>) => void
}

export function PreferencesSection({
  preferences,
  isEditing,
  onChange,
}: PreferencesSectionProps) {
  const [newLocation, setNewLocation] = useState("")

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault()
    if (newLocation.trim() && !preferences.preferredLocation.includes(newLocation.trim())) {
      onChange({
        preferredLocation: [...preferences.preferredLocation, newLocation.trim()],
      })
      setNewLocation("")
    }
  }

  const handleRemoveLocation = (loc: string) => {
    onChange({
      preferredLocation: preferences.preferredLocation.filter((l) => l !== loc),
    })
  }

  return (
    <DashboardCard className="p-5">
      <h2 className="mb-4 text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
        <Compass className="size-4 text-[#6B2C91] dark:text-pink-300" />
        Job Preferences
      </h2>

      {!isEditing ? (
        // Capped at 2 columns regardless of viewport: this card renders inside a
        // narrow sidebar column (lg:col-span-4 of 12) once the page layout goes
        // multi-column, so a wider grid (e.g. 4 columns) looks fine at first
        // glance but clips/overflows as soon as that sidebar constraint kicks
        // in. min-w-0 + break-words let long values (salary ranges, city
        // names) wrap safely instead of forcing the grid wider than its parent.
        <dl className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/40">
            <dt className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Expected Salary</dt>
            <dd className="mt-1 break-words text-sm font-extrabold text-slate-950 dark:text-white">
              {preferences.expectedSalary || "Not specified"}
            </dd>
          </div>
          <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/40">
            <dt className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Availability</dt>
            <dd className="mt-1 break-words text-sm font-extrabold text-slate-950 dark:text-white">
              {preferences.availability || "Not specified"}
            </dd>
          </div>
          <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/40">
            <dt className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Notice Period</dt>
            <dd className="mt-1 break-words text-sm font-extrabold text-slate-950 dark:text-white">
              {preferences.noticePeriod || "Not specified"}
            </dd>
          </div>
          <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/40">
            <dt className="mb-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">Preferred Locations</dt>
            <dd className="flex min-w-0 flex-wrap gap-1">
              {preferences.preferredLocation.length === 0 ? (
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">None specified</span>
              ) : (
                preferences.preferredLocation.map((loc) => (
                  <span
                    key={loc}
                    className="max-w-full break-words rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-extrabold text-[#6B2C91] ring-1 ring-violet-100 dark:bg-violet-500/20 dark:text-pink-100"
                  >
                    {loc}
                  </span>
                ))
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="space-y-4">
          {/* Same narrow-sidebar reasoning as the view-mode grid above --
              capped at 2 columns so inputs never get squeezed. */}
          <div className="grid gap-4 min-[400px]:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="expectedSalary" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
                Expected Salary
              </label>
              <input
                id="expectedSalary"
                type="text"
                value={preferences.expectedSalary}
                onChange={(e) => onChange({ expectedSalary: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="availability" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
                Availability
              </label>
              <select
                id="availability"
                value={preferences.availability}
                onChange={(e) => onChange({ availability: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900"
              >
                <option value="Immediate">Immediate</option>
                <option value="15 Days">15 Days</option>
                <option value="30 Days">30 Days</option>
                <option value="60 Days">60 Days</option>
                <option value="90 Days">90 Days</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="noticePeriod" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
                Notice Period
              </label>
              <input
                id="noticePeriod"
                type="text"
                value={preferences.noticePeriod}
                onChange={(e) => onChange({ noticePeriod: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
              />
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          <div>
            <label className="text-xs font-extrabold text-slate-600 dark:text-slate-400 block mb-2">
              Preferred Locations
            </label>
            <div className="flex min-w-0 flex-wrap gap-1.5 mb-3">
              {preferences.preferredLocation.map((loc) => (
                <span
                  key={loc}
                  className="inline-flex max-w-full items-center gap-1 break-words rounded bg-violet-50 px-2 py-0.5 text-xs font-extrabold text-[#6B2C91] ring-1 ring-violet-100 dark:bg-violet-500/20 dark:text-pink-100"
                >
                  {loc}
                  <button
                    type="button"
                    onClick={() => handleRemoveLocation(loc)}
                    className="text-[#6B2C91] hover:text-[#5a237b] dark:text-pink-200 dark:hover:text-white"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <form onSubmit={handleAddLocation} className="flex max-w-xs gap-2">
              <input
                type="text"
                placeholder="e.g. Remote, Delhi..."
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
              />
              <Button type="submit" size="sm" className="bg-[#6B2C91] text-white hover:bg-[#5a237b]">
                <Plus className="size-3.5" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
