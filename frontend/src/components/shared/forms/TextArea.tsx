import React, { forwardRef } from "react"

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={id} className="text-xs font-black text-slate-800 dark:text-slate-200">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={`w-full min-h-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white ${
            error ? "border-red-500 dark:border-red-500" : ""
          } ${className || ""}`}
          {...props}
        />
        {error && <span className="text-[10px] font-bold text-red-500">{error}</span>}
      </div>
    )
  }
)
TextArea.displayName = "TextArea"
export default TextArea
