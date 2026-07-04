import { Edit3, Mail, MapPin, Phone } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { candidate } from "@/data/candidate"

const stats = [
  { label: "Experience", value: candidate.experience },
  { label: "Current CTC", value: candidate.currentCtc },
  { label: "Expected CTC", value: candidate.expectedCtc },
  { label: "Availability", value: candidate.availability },
  { label: "Notice Period", value: candidate.noticePeriod },
]

export function CandidateInformationCard() {
  return (
    <DashboardCard className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
          Candidate Information
        </h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-extrabold text-[#6B2C91] ring-1 ring-violet-100 dark:bg-violet-500/20 dark:text-pink-100 dark:ring-violet-400/20">
            Profile Completion
            <strong>{candidate.profileCompletion}%</strong>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[#6B2C91] dark:text-pink-200"
            aria-label="Edit candidate profile"
          >
            <Edit3 className="size-3.5" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="flex gap-4">
          <Avatar className="size-20 sm:size-24">
            <AvatarFallback className="bg-gradient-to-br from-pink-100 via-white to-violet-200 text-xl font-bold text-[#6B2C91] dark:from-pink-500/20 dark:via-slate-900 dark:to-violet-500/25 dark:text-pink-100">
              PS
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-base font-extrabold text-slate-950 dark:text-white">
              {candidate.fullName}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
              {candidate.role}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="size-3.5" />
              {candidate.location}
            </p>

            <div className="mt-4 space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <p className="flex items-center gap-2">
                <Mail className="size-3.5 text-pink-500" />
                {candidate.email}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-3.5 text-pink-500" />
                {candidate.phone}
              </p>
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/55">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {stat.label}
              </dt>
              <dd className="mt-1 text-xs font-extrabold text-slate-950 dark:text-white">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-extrabold text-slate-950 dark:text-white">
          Key Skills
        </span>
        {candidate.skills.map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-[#6B2C91] ring-1 ring-violet-100 dark:bg-violet-500/20 dark:text-pink-100 dark:ring-violet-400/20"
          >
            {skill}
          </span>
        ))}
      </div>
    </DashboardCard>
  )
}
