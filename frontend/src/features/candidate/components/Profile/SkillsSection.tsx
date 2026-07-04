import { useState } from "react"
import { Award, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"

type SkillsSectionProps = {
  skills: string[]
  isEditing: boolean
  onAddSkill: (skill: string) => void
  onRemoveSkill: (skill: string) => void
}

export function SkillsSection({
  skills,
  isEditing,
  onAddSkill,
  onRemoveSkill,
}: SkillsSectionProps) {
  const [newSkill, setNewSkill] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newSkill.trim()) {
      onAddSkill(newSkill.trim())
      setNewSkill("")
    }
  }

  return (
    <DashboardCard className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
          <Award className="size-4 text-[#6B2C91] dark:text-pink-300" />
          Skills
        </h2>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3.5 py-1 text-[11px] font-bold text-[#6B2C91] ring-1 ring-violet-100 dark:bg-violet-500/20 dark:text-pink-100 dark:ring-violet-400/20"
            >
              {skill}
              {isEditing && (
                <button
                  type="button"
                  onClick={() => onRemoveSkill(skill)}
                  className="ml-1 rounded-full p-0.5 hover:bg-violet-100 dark:hover:bg-violet-500/35"
                  aria-label={`Remove skill ${skill}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>

        {isEditing && (
          <form onSubmit={handleSubmit} className="flex max-w-xs gap-2 pt-2">
            <input
              type="text"
              placeholder="e.g. TypeScript, GraphQL..."
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
            />
            <Button
              type="submit"
              size="sm"
              className="bg-[#6B2C91] text-white hover:bg-[#5a237b]"
            >
              <Plus className="size-3.5" />
              Add Skill
            </Button>
          </form>
        )}
      </div>
    </DashboardCard>
  )
}
