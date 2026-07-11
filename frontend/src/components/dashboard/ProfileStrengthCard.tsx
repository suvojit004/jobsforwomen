import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"

type ProfileStrengthCardProps = {
  completion?: number
}

export function ProfileStrengthCard({ completion = 0 }: ProfileStrengthCardProps) {
  const percentage = completion
  const remaining = 100 - percentage

  return (
    <DashboardCard className="flex h-full flex-col items-center p-4 text-center">
      <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
        Profile Strength
      </h2>

      <div className="relative mt-4 size-32">
        <svg className="size-full -rotate-90" viewBox="0 0 120 120" role="img">
          <title>{percentage}% profile completion</title>
          <circle
            cx="60"
            cy="60"
            r="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="11"
            className="text-violet-100 dark:text-violet-500/20"
          />
          <circle
            cx="60"
            cy="60"
            r="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="11"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${percentage} ${100 - percentage}`}
            className="text-[#6B2C91] dark:text-violet-400"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-[#6B2C91] dark:text-pink-100">
            {percentage}%
          </span>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Complete
          </span>
        </div>
      </div>

      <p className="mt-3 max-w-44 text-xs leading-5 text-slate-600 dark:text-slate-300">
        Only {remaining}% left to unlock Premium Job Recommendations.
      </p>
      <Button className="mt-4 w-full bg-[#6B2C91] hover:bg-[#5a237b]">
        Complete Profile
      </Button>
      <p className="mt-3 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        Complete profile to receive better job matches.
      </p>
    </DashboardCard>
  )
}
