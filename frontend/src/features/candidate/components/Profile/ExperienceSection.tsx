import { useState } from "react"
import { Briefcase, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import type { WorkExperience } from "../../types/candidate"

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
  const [newDuration, setNewDuration] = useState("")
  const [newDescription, setNewDescription] = useState("")

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (newTitle.trim() && newCompany.trim() && newDuration.trim()) {
      onAddExperience({
        jobTitle: newTitle.trim(),
        company: newCompany.trim(),
        duration: newDuration.trim(),
        description: newDescription.trim(),
      })
      setNewTitle("")
      setNewCompany("")
      setNewDuration("")
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
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500">Duration (e.g. Mar 2023 - Present)</label>
                    <input
                      type="text"
                      value={exp.duration}
                      onChange={(e) => onUpdateExperience(exp.id, { duration: e.target.value })}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900"
                    />
                  </div>
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
              <div className="flex flex-col gap-1 sm:col-span-2">
                <input
                  type="text"
                  placeholder="Duration (e.g. Jun 2021 - Present) *"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900"
                  required
                />
              </div>
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
