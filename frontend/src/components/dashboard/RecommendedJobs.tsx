import { Button } from "@/components/ui/button"
import { JobCard } from "@/components/dashboard/JobCard"
import { SectionHeader } from "@/components/dashboard/SectionHeader"
import { NoRecommendedJobsState } from "@/components/shared/EmptyStates"
import { recommendedJobs } from "@/data/jobs"

export function RecommendedJobs() {
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
      {recommendedJobs.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {recommendedJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <NoRecommendedJobsState />
      )}
    </section>
  )
}
