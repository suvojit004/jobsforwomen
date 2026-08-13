import { useState } from "react"
import { Briefcase, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import type { WorkExperience } from "../../types/candidate"

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const THIS_MONTH = new Date().toISOString().slice(0, 7)

// The stored `duration` field is still a single freeform string (no schema
// change needed) -- these two helpers are the only thing bridging that
// string to/from the pair of native <input type="month"> pickers below, so
// picking dates on a calendar produces exactly the same "Mon YYYY - Mon
// YYYY" / "Mon YYYY - Present" text the field always held.
function monthValueToLabel(value: string): string {
  const [y, m] = value.split("-")
  const idx = m ? parseInt(m, 10) - 1 : -1
  if (!y || idx < 0 || idx > 11) return ""
  return `${MONTH_NAMES[idx]} ${y}`
}

function labelToMonthValue(label: string): string {
  const match = label.trim().match(/^([A-Za-z]{3,9})\s+(\d{4})$/)
  if (!match) return ""
  const idx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === match[1].slice(0, 3).toLowerCase())
  if (idx === -1) return ""
  return `${match[2]}-${String(idx + 1).padStart(2, "0")}`
}

// Parses a "Jun 2021 - Present" (or "Jun 2021 - Aug 2023") string back into
// picker-shaped values. Duration text entered before this change (or typed
// in some other format) simply won't match and comes back blank -- it's
// left exactly as-is unless the user actively edits it through the picker,
// so no existing data is silently rewritten.
function parseDurationString(duration: string): { start: string; end: string; current: boolean } {
  const [startLabel = "", endLabel = ""] = duration.split("-").map((s) => s.trim())
  const start = labelToMonthValue(startLabel)
  // Nothing that looks like "Mon YYYY" at the front -- don't guess at
  // "current"/blank fields for text we don't actually understand (e.g. a
  // legacy freeform value like "2 years"); just report it as unparsed.
  if (!start) return { start: "", end: "", current: false }
  const current = /present/i.test(endLabel) || !endLabel
  return { start, end: current ? "" : labelToMonthValue(endLabel), current }
}

function formatDurationString(start: string, end: string, current: boolean): string {
  const startLabel = monthValueToLabel(start)
  if (!startLabel) return ""
  if (current) return `${startLabel} - Present`
  const endLabel = monthValueToLabel(end)
  return endLabel ? `${startLabel} - ${endLabel}` : startLabel
}

type DurationFieldsProps = {
  start: string
  end: string
  current: boolean
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  onCurrentChange: (value: boolean) => void
  idPrefix: string
}

// Same native, browser-supplied calendar picker pattern as the Schedule
// Interview modal's datetime-local field -- here as a pair of month pickers
// (duration is tracked to the month, not the day) plus a "still working
// here" checkbox standing in for an open-ended end date.
function DurationFields({ start, end, current, onStartChange, onEndChange, onCurrentChange, idPrefix }: DurationFieldsProps) {
  return (
    <div className="flex flex-col gap-1 sm:col-span-2">
      <label htmlFor={`${idPrefix}-start`} className="text-[10px] font-bold text-slate-500">
        Duration *
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`${idPrefix}-start`}
          type="month"
          value={start}
          max={THIS_MONTH}
          onChange={(e) => onStartChange(e.target.value)}
          className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          required
        />
        <span className="text-xs font-semibold text-slate-400">to</span>
        <input
          id={`${idPrefix}-end`}
          type="month"
          value={end}
          min={start || undefined}
          max={THIS_MONTH}
          disabled={current}
          onChange={(e) => onEndChange(e.target.value)}
          className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-900/40"
          required={!current}
        />
        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            checked={current}
            onChange={(e) => onCurrentChange(e.target.checked)}
            className="size-3.5 rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91]/30"
          />
          Currently working here
        </label>
      </div>
    </div>
  )
}

type ExperienceSectionProps = {
  experiences: WorkExperience[]
  isEditing: boolean
  onAddExperience: (exp: Omit<WorkExperience, "id">) => void
  onUpdateExperience: (id: string, fields: Partial<WorkExperience>) => void
  onRemoveExperience: (id: string) => void
}

export function ExperienceSection({
  experiences,
  isEditing,
  onAddExperience,
  onUpdateExperience,
  onRemoveExperience,
}: ExperienceSectionProps) {
  const [newTitle, setNewTitle] = useState("")
  const [newCompany, setNewCompany] = useState("")
  const [newStart, setNewStart] = useState("")
  const [newEnd, setNewEnd] = useState("")
  const [newCurrent, setNewCurrent] = useState(false)
  const [newDescription, setNewDescription] = useState("")

  const newDuration = formatDurationString(newStart, newEnd, newCurrent)

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (newTitle.trim() && newCompany.trim() && newDuration) {
      onAddExperience({
        jobTitle: newTitle.trim(),
        company: newCompany.trim(),
        duration: newDuration,
        description: newDescription.trim(),
      })
      setNewTitle("")
      setNewCompany("")
      setNewStart("")
      setNewEnd("")
      setNewCurrent(false)
      setNewDescription("")
    }
  }

  return (
    <DashboardCard className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
          <Briefcase className="size-4 text-[#6B2C91] dark:text-pink-300" />
          Work Experience
        </h2>
      </div>

      <div className="space-y-6">
        {experiences.map((exp) => (
          <div
            key={exp.id}
            className="group relative border-l-2 border-violet-100 pl-4 py-1 dark:border-slate-800"
          >
            {/* Timeline Dot */}
            <span className="absolute -left-[6px] top-2.5 size-2.5 rounded-full bg-[#6B2C91] dark:bg-pink-400" />

            {!isEditing ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
                    {exp.jobTitle}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {exp.duration}
                  </span>
                </div>
                <p className="text-xs font-bold text-[#6B2C91] dark:text-pink-200">
                  {exp.company}
                </p>
                {exp.description && (
                  <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                    {exp.description}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-950/40">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500">Job Title</label>
                    <input
                      type="text"
                      value={exp.jobTitle}
                      onChange={(e) => onUpdateExperience(exp.id, { jobTitle: e.target.value })}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500">Company Name</label>
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => onUpdateExperience(exp.id, { company: e.target.value })}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900"
                    />
                  </div>
                  {(() => {
                    const parsed = parseDurationString(exp.duration)
                    return (
                      <DurationFields
                        idPrefix={`exp-${exp.id}`}
                        start={parsed.start}
                        end={parsed.end}
                        current={parsed.current}
                        onStartChange={(v) =>
                          onUpdateExperience(exp.id, { duration: formatDurationString(v, parsed.end, parsed.current) })
                        }
                        onEndChange={(v) =>
                          onUpdateExperience(exp.id, { duration: formatDurationString(parsed.start, v, parsed.current) })
                        }
                        onCurrentChange={(v) =>
                          onUpdateExperience(exp.id, { duration: formatDurationString(parsed.start, parsed.end, v) })
                        }
                      />
                    )
                  })()}
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500">Description</label>
                    <textarea
                      value={exp.description}
                      onChange={(e) => onUpdateExperience(exp.id, { description: e.target.value })}
                      rows={3}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveExperience(exp.id)}
                    className="h-7 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="mr-1 size-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isEditing && (
          <form
            onSubmit={handleAdd}
            className="mt-6 rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-800"
          >
            <h3 className="mb-3 text-xs font-extrabold text-slate-950 dark:text-white">
              Add Work Experience
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  placeholder="Job Title *"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  placeholder="Company Name *"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900"
                  required
                />
              </div>
              <DurationFields
                idPrefix="new-exp"
                start={newStart}
                end={newEnd}
                current={newCurrent}
                onStartChange={setNewStart}
                onEndChange={setNewEnd}
                onCurrentChange={setNewCurrent}
              />
              <div className="flex flex-col gap-1 sm:col-span-2">
                <textarea
                  placeholder="Description of duties, key projects..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
            </div>
            <Button
              type="submit"
              size="sm"
              className="mt-3 bg-[#6B2C91] text-white hover:bg-[#5a237b]"
            >
              <Plus className="mr-1 size-3.5" />
              Add Experience
            </Button>
          </form>
        )}
      </div>
    </DashboardCard>
  )
}
