import { TagInput } from "./TagInput"

interface SkillsInputProps {
  label?: string
  placeholder?: string
  skills: string[]
  onChange: (skills: string[]) => void
  error?: string
}

export function SkillsInput({ label = "Skills Required", placeholder = "Add skill (e.g. React)...", skills, onChange, error }: SkillsInputProps) {
  return (
    <TagInput
      label={label}
      placeholder={placeholder}
      tags={skills}
      onChange={onChange}
      error={error}
    />
  )
}
export default SkillsInput
