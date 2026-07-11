import { useMemo } from "react"
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

type MyApplicationsProps = {
  applications?: any[]
}

export function MyApplications({ applications = [] }: MyApplicationsProps) {
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
          >
            View all
          </Button>
        }
      />
      <DashboardCard className="overflow-hidden">
        {applications.length > 0 ? (
          <>
            <div className="flex gap-5 border-b border-slate-200 px-4 py-3 text-xs font-extrabold text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span className="text-[#6B2C91] dark:text-pink-200">All ({counts.all})</span>
              <span>Applied ({counts.applied})</span>
              <span>Interviewing ({counts.interviewing})</span>
              <span>Closed ({counts.closed})</span>
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
                {applications.map((application) => (
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
                        {application.recruiter ?? "-"}
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
                      >
                        View Details
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <div className="m-4">
            <NoApplicationsState />
          </div>
        )}
      </DashboardCard>
    </section>
  )
}
