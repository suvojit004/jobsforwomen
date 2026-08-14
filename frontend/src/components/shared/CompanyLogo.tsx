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
  // Real company logo (Company.logoUrl), when the recruiter has uploaded
  // one -- previously this component had no way to show it at all, so
  // every job card / application row / job detail header showed the
  // colored-initials placeholder unconditionally, even for a company with
  // a real logo on file.
  logoUrl?: string | null
  alt?: string
}

export function CompanyLogo({
  code,
  tone = "purple",
  className,
  logoUrl,
  alt,
}: CompanyLogoProps) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={alt || code}
        className={cn(
          "size-9 shrink-0 rounded-lg object-cover shadow-sm",
          className
        )}
      />
    )
  }

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
