import React, { forwardRef } from "react"

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: Array<{ value: string; label: string }>
  error?: string
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, options, error, className, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={id} className="text-xs font-black text-slate-800 dark:text-slate-200">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white ${
            error ? "border-red-500 dark:border-red-500" : ""
          } ${className || ""}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="text-[10px] font-bold text-red-500">{error}</span>}
      </div>
    )
  }
)
SelectField.displayName = "SelectField"
export default SelectField
