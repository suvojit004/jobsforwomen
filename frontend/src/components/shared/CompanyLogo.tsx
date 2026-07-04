import { cn } from "@/lib/utils"

const toneClasses = {
  purple: "bg-violet-600 text-white",
  green: "bg-emerald-600 text-white",
  blue: "bg-blue-600 text-white",
  pink: "bg-pink-500 text-white",
}

type CompanyLogoProps = {
  code: string
  tone?: keyof typeof toneClasses
  className?: string
}

export function CompanyLogo({
  code,
  tone = "purple",
  className,
}: CompanyLogoProps) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold shadow-sm",
        toneClasses[tone],
        className
      )}
      aria-hidden="true"
    >
      {code}
    </span>
  )
}
