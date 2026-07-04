import { forwardRef } from "react"
import { TextInput } from "./TextInput"

interface SalaryInputProps {
  label?: string
  error?: string
  value?: string
  onChange?: (val: string) => void
  placeholder?: string
}

export const SalaryInput = forwardRef<HTMLInputElement, SalaryInputProps>(
  ({ label, error, value, onChange, placeholder = "e.g. ₹8 - 12 LPA" }, ref) => {
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
SalaryInput.displayName = "SalaryInput"
export default SalaryInput
