import React from "react"

interface FormSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <div className={`space-y-4 border-b border-slate-100 pb-5 dark:border-slate-800 last:border-0 last:pb-0 ${className || ""}`}>
      <div>
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
          {title}
        </h3>
        {description && (
          <p className="mt-0.5 text-xs text-slate-400 font-semibold dark:text-slate-500">
            {description}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {children}
      </div>
    </div>
  )
}
export default FormSection
