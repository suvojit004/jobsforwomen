import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { Skeleton } from "@/components/ui/skeleton"

export function CandidateCardSkeleton() {
  return (
    <DashboardCard className="p-4" aria-label="Loading candidate information">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </div>
    </DashboardCard>
  )
}

export function JobCardsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <DashboardCard key={index} className="p-4" aria-label="Loading job">
          <div className="flex gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="mt-4 h-7 w-52 rounded-full" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
        </DashboardCard>
      ))}
    </div>
  )
}

export function ApplicationsSkeleton() {
  return (
    <DashboardCard className="space-y-3 p-4" aria-label="Loading applications">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </DashboardCard>
  )
}

export function ActivityFeedSkeleton() {
  return (
    <DashboardCard className="space-y-4 p-4" aria-label="Loading activity feed">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </DashboardCard>
  )
}

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <CandidateCardSkeleton />
      <JobCardsSkeleton />
      <ApplicationsSkeleton />
    </div>
  )
}
