import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { CandidateInformationCard } from "@/components/dashboard/CandidateInformationCard"
import { CareerBreakCard } from "@/components/dashboard/CareerBreakCard"
import { MyApplications } from "@/components/dashboard/MyApplications"
import { ProfileStrengthCard } from "@/components/dashboard/ProfileStrengthCard"
import { QuickFilters } from "@/components/dashboard/QuickFilters"
import { RecommendedJobs } from "@/components/dashboard/RecommendedJobs"
import { ResumeCard } from "@/components/dashboard/ResumeCard"
import { candidate } from "@/data/candidate"

export function DashboardPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Welcome back, Priya 👋
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Let's find your next opportunity today.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 2xl:col-span-7">
          <CandidateInformationCard />
        </div>
        <div className="lg:col-span-5 xl:col-span-2 2xl:col-span-2">
          <ProfileStrengthCard />
        </div>
        <div className="grid gap-4 lg:col-span-12 xl:col-span-3 2xl:col-span-3">
          <CareerBreakCard />
          <ResumeCard />
        </div>
      </section>

      <QuickFilters />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <RecommendedJobs />
          <MyApplications />
        </div>
        <aside className="space-y-5">
          <ActivityFeed />
          <div className="rounded-xl border border-violet-200 bg-gradient-to-r from-pink-50 to-violet-50 p-4 text-center shadow-[0_8px_28px_rgba(107,44,145,0.08)] dark:border-violet-400/20 dark:from-pink-500/10 dark:to-violet-500/15">
            <p className="text-sm font-black text-[#6B2C91] dark:text-pink-100">
              {candidate.profileCompletion}% profile completion
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
              Premium partner jobs are prioritized for complete profiles.
            </p>
          </div>
        </aside>
      </section>
    </div>
  )
}
