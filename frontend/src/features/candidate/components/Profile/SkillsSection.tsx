import { useState } from "react"
import { Award, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"

// A curated, canonically-cased catalog to pick from -- covers the skills
// most candidates actually have, in the casing they should display in
// (e.g. "JavaScript", not "javascript"). "Other" still exists for anything
// not on the list, since no fixed list can cover every real skill; it isn't
// auto-reformatted the way Degree's "Other" is, because unlike degree names,
// correct skill casing isn't a simple title-case rule (e.g. "AWS", "Node.js").
const SKILL_GROUPS: { label: string; skills: string[] }[] = [
  {
    label: "Programming & Web",
    skills: [
      "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "PHP", "Ruby", "Go",
      "HTML", "CSS", "React", "Angular", "Vue.js", "Node.js", "Express.js", "Next.js",
      "REST APIs", "GraphQL",
    ],
  },
  {
    label: "Data & Cloud",
    skills: [
      "SQL", "MongoDB", "PostgreSQL", "AWS", "Azure", "Google Cloud", "Docker",
      "Kubernetes", "Git", "Data Analysis", "Excel", "Power BI", "Tableau",
    ],
  },
  {
    label: "Design & Product",
    skills: ["Figma", "Adobe XD", "Photoshop", "UI/UX Design", "Product Management"],
  },
  {
    label: "Business & Soft Skills",
    skills: [
      "Communication", "Leadership", "Project Management", "Content Writing",
      "Digital Marketing", "Sales", "Customer Service", "Team Management",
    ],
  },
]
const OTHER_SKILL = "__other__"

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
  const [pickerMode, setPickerMode] = useState<"select" | "custom">("select")
  const [customSkill, setCustomSkill] = useState("")

  const handlePresetSelect = (value: string) => {
    if (value === OTHER_SKILL) {
      setPickerMode("custom")
      return
    }
    if (value && !skills.includes(value)) {
      onAddSkill(value)
    }
  }

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = customSkill.trim()
    if (trimmed && !skills.includes(trimmed)) {
      onAddSkill(trimmed)
      setCustomSkill("")
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
        {skills.length === 0 && !isEditing ? (
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
            No skills added yet. Use "Edit Profile" above to showcase what you're great at.
          </p>
        ) : (
        <div className="flex min-w-0 flex-wrap gap-2">
          {skills.length === 0 && isEditing && (
            <p className="w-full text-xs font-medium text-slate-400 dark:text-slate-500">
              No skills added yet -- add your first one below.
            </p>
          )}
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
        )}

        {isEditing && (
          <div className="max-w-xs pt-2">
            {pickerMode === "select" ? (
              <select
                value=""
                onChange={(e) => handlePresetSelect(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              >
                <option value="" disabled>
                  Select a skill to add...
                </option>
                {SKILL_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.skills.map((skill) => (
                      <option key={skill} value={skill} disabled={skills.includes(skill)}>
                        {skill}
                        {skills.includes(skill) ? " (added)" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value={OTHER_SKILL}>Other (type your own)...</option>
              </select>
            ) : (
              <form onSubmit={handleAddCustom} className="space-y-1.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. TypeScript, GraphQL..."
                    value={customSkill}
                    onChange={(e) => setCustomSkill(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
                  />
                  <Button type="submit" size="sm" className="bg-[#6B2C91] text-white hover:bg-[#5a237b]">
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPickerMode("select")
                    setCustomSkill("")
                  }}
                  className="text-[10px] font-bold text-[#6B2C91] hover:underline dark:text-pink-200"
                >
                  Choose from list instead
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </DashboardCard>
  )
}
