import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CompanyLogo } from "@/components/shared/CompanyLogo"
import { NoApplicationsState } from "@/components/shared/EmptyStates"
import { MenstrualLeaveChampionBadge } from "@/components/shared/MenstrualLeaveChampionBadge"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { SectionHeader } from "@/components/dashboard/SectionHeader"
import type { DisplayApplication } from "@/features/candidate/services/jobsApi"

type MyApplicationsProps = {
  // Typed as DisplayApplication[] (rather than the previous `any[]`) so a
  // future shape change to `recruiter` (now a { name, jobTitle, email }
  // RecruiterSummary object, not a plain string -- see jobsApi.ts) is a
  // compile error here instead of a silent runtime React error #31 the way
  // this exact field was until now.
  applications?: DisplayApplication[]
}

type ApplicationFilter = "all" | "applied" | "interviewing" | "closed"

export function MyApplications({ applications = [] }: MyApplicationsProps) {
  const navigate = useNavigate()
  // Previously these were plain <span>s with counts next to them --
  // rendered like tabs, but with no onClick and no cursor styling, so
  // hovering just showed the browser's default text cursor and clicking did
  // nothing. Now an actual filter, matching the same status groupings the
  // counts already used.
  const [activeFilter, setActiveFilter] = useState<ApplicationFilter>("all")

  const tableMeta = useMemo(
    () => ({
      hasInterviewDate: applications.some(
        (application) =>
          application.status === "Interview Scheduled" &&
          Boolean(application.interviewDate)
      ),
      hasRecruiter: applications.some((application) =>
        Boolean(application.recruiter)
      ),
    }),
    [applications]
  )

  const counts = useMemo(() => {
    return {
      all: applications.length,
      applied: applications.filter(a => a.status === "Applied").length,
      interviewing: applications.filter(a => a.status === "Interview Scheduled" || a.status === "Under Review").length,
      closed: applications.filter(a => a.status === "Rejected" || a.status === "Selected").length,
    }
  }, [applications])

  const filteredApplications = useMemo(() => {
    if (activeFilter === "all") return applications
    if (activeFilter === "applied") return applications.filter((a) => a.status === "Applied")
    if (activeFilter === "interviewing") {
      return applications.filter((a) => a.status === "Interview Scheduled" || a.status === "Under Review")
    }
    return applications.filter((a) => a.status === "Rejected" || a.status === "Selected")
  }, [applications, activeFilter])

  const filterTabs: { key: ApplicationFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "applied", label: "Applied", count: counts.applied },
    { key: "interviewing", label: "Interviewing", count: counts.interviewing },
    { key: "closed", label: "Closed", count: counts.closed },
  ]

  return (
    <section>
      <SectionHeader
        title="My Applications"
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-[#6B2C91] dark:text-pink-200"
            onClick={() => navigate("/candidate/applications")}
          >
            View all
          </Button>
        }
      />
      <DashboardCard className="overflow-hidden">
        {applications.length > 0 ? (
          <>
            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-500 dark:border-slate-800 dark:text-slate-400">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={`shrink-0 rounded-lg px-2 py-1 transition-colors ${
                    activeFilter === tab.key
                      ? "bg-[#6B2C91]/10 text-[#6B2C91] dark:bg-pink-500/15 dark:text-pink-200"
                      : "hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-slate-950/45">
                  <TableHead className="min-w-52">Company</TableHead>
                  <TableHead className="min-w-44">Job</TableHead>
                  <TableHead>Applied Date</TableHead>
                  {tableMeta.hasInterviewDate && (
                    <TableHead>Interview Date</TableHead>
                  )}
                  {tableMeta.hasRecruiter && <TableHead>Recruiter</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Badge</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <CompanyLogo
                          code={application.companyCode}
                          tone="purple"
                          className="size-8"
                        />
                        <span className="text-xs font-extrabold text-slate-950 dark:text-white">
                          {application.company}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      {application.job}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      {application.appliedDate}
                    </TableCell>
                    {tableMeta.hasInterviewDate && (
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                        {application.status === "Interview Scheduled"
                          ? application.interviewDate
                          : "-"}
                      </TableCell>
                    )}
                    {tableMeta.hasRecruiter && (
                      <TableCell className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {/* application.recruiter is a
                            { name, jobTitle, email } RecruiterSummary object
                            (see jobsApi.ts's mapApiApplication), not a plain
                            string -- this was rendering the whole object
                            directly into JSX. */}
                        {application.recruiter?.name ?? "-"}
                      </TableCell>
                    )}
                    <TableCell>
                      <StatusBadge status={application.status} />
                    </TableCell>
                    <TableCell>
                      <MenstrualLeaveChampionBadge compact />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-[#6B2C91] dark:text-pink-200"
                        onClick={() => navigate("/candidate/applications")}
                      >
                        View Details
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredApplications.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3 + (tableMeta.hasInterviewDate ? 1 : 0) + (tableMeta.hasRecruiter ? 1 : 0) + 3}
                      className="py-6 text-center text-xs font-semibold text-slate-400 dark:text-slate-500"
                    >
                      No applications in this category.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        ) : (
          <div className="m-4">
            <NoApplicationsState onActionClick={() => navigate("/candidate/jobs")} />
          </div>
        )}
      </DashboardCard>
    </section>
  )
}
