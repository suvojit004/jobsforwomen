import { forwardRef } from "react"
import { TextInput } from "./TextInput"

interface ExperienceInputProps {
  label?: string
  error?: string
  value?: string
  onChange?: (val: string) => void
  placeholder?: string
}

export const ExperienceInput = forwardRef<HTMLInputElement, ExperienceInputProps>(
  ({ label, error, value, onChange, placeholder = "e.g. 2+ Years" }, ref) => {
    return (
      <TextInput
        ref={ref}
        label={label}
        error={error}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    )
  }
)
ExperienceInput.displayName = "ExperienceInput"
export default ExperienceInput
