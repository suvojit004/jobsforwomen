import { Ribbon } from "lucide-react"

type LogoProps = {
  compact?: boolean
}

export function Logo({ compact = false }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-9 items-center justify-center rounded-xl bg-pink-50 text-pink-500 shadow-sm dark:bg-pink-500/10">
        <Ribbon className="size-6 fill-pink-500/20" aria-hidden="true" />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-extrabold text-slate-950 dark:text-white">
            JobsForWomen.info
          </p>
          <p className="truncate text-[10px] font-semibold text-pink-500">
            Empowering Women. Building Careers.
          </p>
        </div>
      )}
    </div>
  )
}
