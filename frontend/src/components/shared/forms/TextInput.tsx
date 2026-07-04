import React, { forwardRef } from "react"

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={id} className="text-xs font-black text-slate-800 dark:text-slate-200">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white ${
            error ? "border-red-500 dark:border-red-500" : ""
          } ${className || ""}`}
          {...props}
        />
        {error && <span className="text-[10px] font-bold text-red-500">{error}</span>}
      </div>
    )
  }
)
TextInput.displayName = "TextInput"
export default TextInput
