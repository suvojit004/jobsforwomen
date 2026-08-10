// Shared skeleton building blocks for the pages that previously just showed
// plain "Loading..." text while their initial data fetched -- these render
// placeholders shaped like the real eventual layout instead, so the page
// doesn't look broken/blank for the second or two a fetch takes.
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardCard } from "@/components/dashboard/DashboardCard"

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <DashboardCard className="p-4 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-16" />
    </DashboardCard>
  )
}

export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Mimics a job/candidate/applicant card -- avatar/logo block + a couple
// lines of text + a pill -- used for BrowseJobs/card-grid style pages.
export function CardSkeleton() {
  return (
    <DashboardCard className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </DashboardCard>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

// Mimics a table row -- avatar + a few column-shaped bars.
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <Skeleton className="size-8 rounded-full shrink-0" />
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className={i === 0 ? "h-3 w-32" : "h-3 w-16"} />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <DashboardCard className="overflow-hidden p-0">
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </DashboardCard>
  )
}

// Mimics a conversation/notification list row -- avatar + two lines.
export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <Skeleton className="size-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <DashboardCard className="overflow-hidden p-0">
      {Array.from({ length: rows }).map((_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </DashboardCard>
  )
}

// Full-page composite: header + stat row + a two-column content/sidebar
// split -- a generic shape for dashboards that don't have a purpose-built
// skeleton of their own (recruiter/admin). Named distinctly from
// @/components/dashboard/DashboardSkeletons's DashboardPageSkeleton, which
// is shaped specifically for the candidate dashboard and predates this file.
export function GenericDashboardSkeleton() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <StatRowSkeleton />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <CardGridSkeleton count={4} />
        </div>
        <div className="space-y-3">
          <ListSkeleton rows={4} />
        </div>
      </div>
    </div>
  )
}

// Full-page composite for a browse/search grid page (e.g. Browse Jobs).
export function BrowsePageSkeleton() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <Skeleton className="h-11 w-full rounded-xl" />
      <CardGridSkeleton count={9} />
    </div>
  )
}

// Full-page composite for a table-list page (e.g. Applications, Applicants,
// Manage Jobs).
export function TablePageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <TableSkeleton rows={rows} />
    </div>
  )
}
