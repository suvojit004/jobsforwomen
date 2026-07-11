import { Button } from "@/components/ui/button"
import { JobCard } from "@/components/dashboard/JobCard"
import { SectionHeader } from "@/components/dashboard/SectionHeader"
import { NoRecommendedJobsState } from "@/components/shared/EmptyStates"
import type { ExtendedJob } from "@/types/job"

type RecommendedJobsProps = {
  jobs?: ExtendedJob[]
  savedJobs?: string[]
  appliedJobs?: string[]
  onSave?: (id: string) => void
  onApply?: (id: string) => void
}

export function RecommendedJobs({
  jobs = [],
  savedJobs = [],
  appliedJobs = [],
  onSave,
  onApply,
}: RecommendedJobsProps) {
  return (
    <section>
      <SectionHeader
        title="Recommended Jobs"
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-[#6B2C91] dark:text-pink-200"
          >
            View all jobs
          </Button>
        }
      />
      {jobs.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isSaved={savedJobs.includes(job.id)}
              isApplied={appliedJobs.includes(job.id)}
              onSave={onSave}
              onApply={onApply}
            />
          ))}
        </div>
      ) : (
        <NoRecommendedJobsState />
      )}
    </section>
  )
}
