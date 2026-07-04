import { forwardRef } from "react"
import { TextInput } from "./TextInput"

interface LocationInputProps {
  label?: string
  error?: string
  value?: string
  onChange?: (val: string) => void
  placeholder?: string
}

export const LocationInput = forwardRef<HTMLInputElement, LocationInputProps>(
  ({ label, error, value, onChange, placeholder = "e.g. Bengaluru, Remote" }, ref) => {
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
LocationInput.displayName = "LocationInput"
export default LocationInput
