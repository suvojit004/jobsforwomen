import { useState } from "react"
import { GraduationCap, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { toTitleCase } from "@/utils/validators"
import type { Education } from "../../types/candidate"

// Common Indian qualification names -- covers the large majority of
// candidates so most people never have to type their own. "Other" reveals a
// free-text input instead of forcing an exact match against this list.
const COMMON_DEGREES = [
  "10th / SSC",
  "12th / HSC",
  "Diploma",
  "B.Tech / B.E.",
  "B.Sc",
  "B.A.",
  "B.Com",
  "BBA",
  "BCA",
  "M.Tech / M.E.",
  "M.Sc",
  "M.A.",
  "M.Com",
  "MBA",
  "MCA",
  "PhD",
  "Certification",
]
const OTHER_DEGREE = "Other"

function isKnownDegree(value: string): boolean {
  return COMMON_DEGREES.includes(value)
}

const CURRENT_YEAR = new Date().getFullYear()
const MAX_YEAR = CURRENT_YEAR + 10

// Same rationale as Work Experience's Duration fields: `duration` stays a
// single freeform string (no schema change), these two helpers are just the
// bridge to/from a pair of structured year fields. Education duration is
// tracked to the year here (not the month, unlike work experience), so
// these are plain numeric year inputs rather than <input type="month">.
function parseEduDuration(duration: string): { start: string; end: string; current: boolean } {
  const [startLabel = "", endLabel = ""] = duration.split("-").map((s) => s.trim())
  const start = /^\d{4}$/.test(startLabel) ? startLabel : ""
  if (!start) return { start: "", end: "", current: false }
  const current = /present/i.test(endLabel) || !endLabel
  const end = !current && /^\d{4}$/.test(endLabel) ? endLabel : ""
  return { start, end, current }
}

function formatEduDuration(start: string, end: string, current: boolean): string {
  if (!start) return ""
  if (current) return `${start} - Present`
  return end ? `${start} - ${end}` : start
}

type EduDurationFieldsProps = {
  start: string
  end: string
  current: boolean
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  onCurrentChange: (value: boolean) => void
  idPrefix: string
}

function EduDurationFields({ start, end, current, onStartChange, onEndChange, onCurrentChange, idPrefix }: EduDurationFieldsProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${idPrefix}-start`} className="text-[10px] font-bold text-slate-500">
        Duration *
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`${idPrefix}-start`}
          type="number"
          inputMode="numeric"
          placeholder="Start year"
          value={start}
          min={1950}
          max={MAX_YEAR}
          onChange={(e) => onStartChange(e.target.value)}
          className="w-24 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          required
        />
        <span className="text-xs font-semibold text-slate-400">to</span>
        <input
          id={`${idPrefix}-end`}
          type="number"
          inputMode="numeric"
          placeholder="End year"
          value={end}
          min={start || 1950}
          max={MAX_YEAR}
          disabled={current}
          onChange={(e) => onEndChange(e.target.value)}
          className="w-24 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-900/40"
          required={!current}
        />
        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            checked={current}
            onChange={(e) => onCurrentChange(e.target.checked)}
            className="size-3.5 rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91]/30"
          />
          Currently pursuing
        </label>
      </div>
    </div>
  )
}

type DegreeFieldProps = {
  value: string
  isOther: boolean
  onSelect: (value: string) => void
  onCustomChange: (value: string) => void
  onCustomBlur: (value: string) => void
  idPrefix: string
}

// A <select> of common degrees/certifications, falling back to a free-text
// input (auto title-cased on blur) for anything not on the list -- rather
// than a single always-free-text field where "btech", "B.TECH", and "Btech"
// could all be sitting in different candidates' profiles at once.
function DegreeField({ value, isOther, onSelect, onCustomChange, onCustomBlur, idPrefix }: DegreeFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${idPrefix}-degree`} className="text-[10px] font-bold text-slate-500">
        Degree / Certification
      </label>
      <select
        id={`${idPrefix}-degree`}
        value={isOther ? OTHER_DEGREE : value}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-white"
      >
        <option value="" disabled>
          Select degree / certification
        </option>
        {COMMON_DEGREES.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
        <option value={OTHER_DEGREE}>Other (type your own)</option>
      </select>
      {isOther && (
        <input
          type="text"
          placeholder="Enter your degree / certification"
          value={value}
          onChange={(e) => onCustomChange(e.target.value)}
          onBlur={(e) => onCustomBlur(e.target.value)}
          className="mt-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        />
      )}
    </div>
  )
}

type EducationSectionProps = {
  education: Education[]
  isEditing: boolean
  onAddEducation: (edu: Omit<Education, "id">) => void
  onUpdateEducation: (id: string, fields: Partial<Education>) => void
  onRemoveEducation: (id: string) => void
}

export function EducationSection({
  education,
  isEditing,
  onAddEducation,
  onUpdateEducation,
  onRemoveEducation,
}: EducationSectionProps) {
  const [newDegree, setNewDegree] = useState("")
  const [newDegreeIsOther, setNewDegreeIsOther] = useState(false)
  const [newInstitution, setNewInstitution] = useState("")
  const [newStart, setNewStart] = useState("")
  const [newEnd, setNewEnd] = useState("")
  const [newCurrent, setNewCurrent] = useState(false)
  const [newGrade, setNewGrade] = useState("")
  // Existing entries derive "other mode" from their saved degree value not
  // matching a known preset -- this set only tracks the one edge case that
  // can't be derived: the user just picked "Other" from the dropdown but
  // hasn't typed anything into the custom field yet (an empty degree value
  // is otherwise indistinguishable from "no preset selected").
  const [otherModeIds, setOtherModeIds] = useState<Set<string>>(new Set())

  const newDuration = formatEduDuration(newStart, newEnd, newCurrent)

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const degree = newDegreeIsOther ? toTitleCase(newDegree) : newDegree
    if (degree.trim() && newInstitution.trim() && newDuration) {
      onAddEducation({
        degree: degree.trim(),
        institution: newInstitution.trim(),
        duration: newDuration,
        grade: newGrade.trim() || undefined,
      })
      setNewDegree("")
      setNewDegreeIsOther(false)
      setNewInstitution("")
      setNewStart("")
      setNewEnd("")
      setNewCurrent(false)
      setNewGrade("")
    }
  }

  return (
    <DashboardCard className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
          <GraduationCap className="size-4 text-[#6B2C91] dark:text-pink-300" />
          Education
        </h2>
      </div>

      <div className="space-y-6">
        {education.map((edu) => {
          const durationParsed = parseEduDuration(edu.duration)
          const inOtherMode = otherModeIds.has(edu.id) || (edu.degree !== "" && !isKnownDegree(edu.degree))

          return (
            <div
              key={edu.id}
              className="group relative border-l-2 border-pink-100 pl-4 py-1 dark:border-slate-800"
            >
              {/* Timeline Dot */}
              <span className="absolute -left-[6px] top-2.5 size-2.5 rounded-full bg-pink-500 dark:bg-pink-400" />

              {!isEditing ? (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
                      {edu.degree}
                    </h3>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {edu.duration}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {edu.institution}
                  </p>
                  {edu.grade && (
                    <p className="text-xs font-semibold text-[#6B2C91] dark:text-pink-200">
                      Result: {edu.grade}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-950/40">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DegreeField
                      idPrefix={`edu-${edu.id}`}
                      value={edu.degree}
                      isOther={inOtherMode}
                      onSelect={(v) => {
                        if (v === OTHER_DEGREE) {
                          setOtherModeIds((prev) => new Set(prev).add(edu.id))
                          if (isKnownDegree(edu.degree)) onUpdateEducation(edu.id, { degree: "" })
                        } else {
                          setOtherModeIds((prev) => {
                            const next = new Set(prev)
                            next.delete(edu.id)
                            return next
                          })
                          onUpdateEducation(edu.id, { degree: v })
                        }
                      }}
                      onCustomChange={(v) => onUpdateEducation(edu.id, { degree: v })}
                      onCustomBlur={(v) => onUpdateEducation(edu.id, { degree: toTitleCase(v) })}
                    />
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">Institution Name</label>
                      <input
                        type="text"
                        value={edu.institution}
                        onChange={(e) => onUpdateEducation(edu.id, { institution: e.target.value })}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900"
                      />
                    </div>
                    <EduDurationFields
                      idPrefix={`edu-${edu.id}`}
                      start={durationParsed.start}
                      end={durationParsed.end}
                      current={durationParsed.current}
                      onStartChange={(v) =>
                        onUpdateEducation(edu.id, { duration: formatEduDuration(v, durationParsed.end, durationParsed.current) })
                      }
                      onEndChange={(v) =>
                        onUpdateEducation(edu.id, { duration: formatEduDuration(durationParsed.start, v, durationParsed.current) })
                      }
                      onCurrentChange={(v) =>
                        onUpdateEducation(edu.id, { duration: formatEduDuration(durationParsed.start, durationParsed.end, v) })
                      }
                    />
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">Grade / Percentage / CGPA</label>
                      <input
                        type="text"
                        value={edu.grade ?? ""}
                        onChange={(e) => onUpdateEducation(edu.id, { grade: e.target.value })}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveEducation(edu.id)}
                      className="h-7 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="mr-1 size-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {isEditing && (
          <form
            onSubmit={handleAdd}
            className="mt-6 rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-800"
          >
            <h3 className="mb-3 text-xs font-extrabold text-slate-950 dark:text-white">
              Add Education
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <DegreeField
                idPrefix="new-edu"
                value={newDegree}
                isOther={newDegreeIsOther}
                onSelect={(v) => {
                  if (v === OTHER_DEGREE) {
                    setNewDegreeIsOther(true)
                    setNewDegree("")
                  } else {
                    setNewDegreeIsOther(false)
                    setNewDegree(v)
                  }
                }}
                onCustomChange={setNewDegree}
                onCustomBlur={(v) => setNewDegree(toTitleCase(v))}
              />
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  placeholder="School / College / University *"
                  value={newInstitution}
                  onChange={(e) => setNewInstitution(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900"
                  required
                />
              </div>
              <EduDurationFields
                idPrefix="new-edu"
                start={newStart}
                end={newEnd}
                current={newCurrent}
                onStartChange={setNewStart}
                onEndChange={setNewEnd}
                onCurrentChange={setNewCurrent}
              />
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  placeholder="Grade / CGPA (optional)"
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value)}
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
              Add Education
            </Button>
          </form>
        )}
      </div>
    </DashboardCard>
  )
}
