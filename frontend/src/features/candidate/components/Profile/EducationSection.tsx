import { useState } from "react"
import { GraduationCap, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import type { Education } from "../../types/candidate"

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
  const [newInstitution, setNewInstitution] = useState("")
  const [newDuration, setNewDuration] = useState("")
  const [newGrade, setNewGrade] = useState("")

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (newDegree.trim() && newInstitution.trim() && newDuration.trim()) {
      onAddEducation({
        degree: newDegree.trim(),
        institution: newInstitution.trim(),
        duration: newDuration.trim(),
        grade: newGrade.trim() || undefined,
      })
      setNewDegree("")
      setNewInstitution("")
      setNewDuration("")
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
        {education.map((edu) => (
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
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500">Degree / Certification</label>
                    <input
                      type="text"
                      value={edu.degree}
                      onChange={(e) => onUpdateEducation(edu.id, { degree: e.target.value })}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500">Institution Name</label>
                    <input
                      type="text"
                      value={edu.institution}
                      onChange={(e) => onUpdateEducation(edu.id, { institution: e.target.value })}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500">Duration (e.g. 2018 - 2022)</label>
                    <input
                      type="text"
                      value={edu.duration}
                      onChange={(e) => onUpdateEducation(edu.id, { duration: e.target.value })}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900"
                    />
                  </div>
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
        ))}

        {isEditing && (
          <form
            onSubmit={handleAdd}
            className="mt-6 rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-800"
          >
            <h3 className="mb-3 text-xs font-extrabold text-slate-950 dark:text-white">
              Add Education
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  placeholder="Degree / Course *"
                  value={newDegree}
                  onChange={(e) => setNewDegree(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900"
                  required
                />
              </div>
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
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  placeholder="Duration (e.g. 2018 - 2022) *"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900"
                  required
                />
              </div>
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
