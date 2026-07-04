import type { ReactNode } from "react"

type SectionHeaderProps = {
  title: string
  action?: ReactNode
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
        {title}
      </h2>
      {action}
    </div>
  )
}
