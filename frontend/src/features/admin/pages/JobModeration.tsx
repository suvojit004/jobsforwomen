import { useState, useEffect } from "react"
import {
  Search,
  AlertTriangle,
  Check,
  Trash2,
  Eye,
  EyeOff,
  X,
  Ban,
} from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import type { ColumnDef } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { AdminApi } from "../services/adminApi"
// Issue 5 fix: reuse the exact same Job Details layout the candidate side
// uses (JobDetailContent, in "admin" variant) instead of duplicating it --
// this page previously had no way to open a job at all, just the summary
// table columns below.
import { JobDetailContent, type JobModerationHistoryEntry } from "@/features/candidate/components/Jobs/JobDetailContent"
import { mapApiJobToExtendedJob } from "@/features/candidate/services/jobsApi"
import type { ExtendedJob } from "@/types/job"

interface AdminJob {
  id: string
  title: string
  company: string
  location: string
  salary: string
  applicantsCount: number
  status: string
  reported: boolean
  visibility: "visible" | "hidden"
  // Full raw job record from AdminApi.getJobs() (admin.service.ts's
  // listJobs now includes recruiter/skills/history/description/etc. -- see
  // Issue 5) -- kept alongside the trimmed table-row fields above so the
  // detail modal can be built from data already in memory, no second
  // request needed.
  raw: any
  moderationHistory: JobModerationHistoryEntry[]
}

export function JobModeration() {
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMode, setFilterMode] = useState<"all" | "reported" | "hidden">("all")
  const [loading, setLoading] = useState(true)

  // Reject-with-reason modal state. Previously this page had no Reject
  // control at all -- Approve was the only moderation action, and it was
  // only shown for `reported` jobs, not for jobs actually awaiting their
  // first review (`status === "pending_approval"`). A recruiter's freshly
  // submitted job had no way to be approved OR rejected from this screen.
  const [rejectTarget, setRejectTarget] = useState<AdminJob | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectSubmitting, setRejectSubmitting] = useState(false)
  const [viewingJob, setViewingJob] = useState<AdminJob | null>(null)

  const loadJobs = async () => {
    try {
      setLoading(true)
      const data = await AdminApi.getJobs()
      setJobs((data || []).map((j: any) => ({
        id: j.id,
        title: j.title,
        company: j.company?.name || "Unknown Company",
        location: j.location,
        salary: j.salaryDisplay || "N/A",
        // Job has no `applicants` field -- the admin listJobs() endpoint
        // includes a real `_count.applications` instead. This previously
        // always read `undefined`, showing "0 candidates" for every job.
        applicantsCount: j._count?.applications ?? 0,
        status: j.status,
        // `reported`/`visibility` are their own real fields on Job (booleans/
        // enum), separate from `status`. Previously this compared `status`
        // against the strings "reported"/"hidden", which are not valid
        // JobStatus values -- so `reported` was always false (the Reported
        // Only tab and badge never worked) and `visibility` was always
        // "visible" (so a hidden job could never be shown as hidden, and the
        // toggle below could never actually unhide anything).
        reported: !!j.reported,
        visibility: j.visibility === "hidden" ? "hidden" : "visible",
        raw: j,
        moderationHistory: (j.history || []).map((h: any) => ({
          status: h.status,
          notes: h.notes,
          changedBy: h.changedBy,
          createdAt: h.createdAt,
        })),
      })))
    } catch (err) {
      console.error("Failed to load jobs list:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
  }, [])

  const handleToggleVisibility = async (jobId: string) => {
    try {
      const jobObj = jobs.find((j) => j.id === jobId)
      // "unhide" only restores visibility; it deliberately does not touch
      // moderation status the way "approve" does on the backend (approve
      // would also silently flip a paused/closed/flagged job to "approved").
      const nextAction = jobObj?.visibility === "visible" ? "hide" : "unhide"
      await AdminApi.moderateJob(jobId, nextAction)
      loadJobs()
    } catch (err) {
      console.error("Failed to toggle job visibility", err)
    }
  }

  const handleApprove = async (jobId: string) => {
    try {
      await AdminApi.moderateJob(jobId, "approve")
      loadJobs()
    } catch (err) {
      console.error("Failed to approve job", err)
    }
  }

  const openRejectModal = (job: AdminJob) => {
    setRejectTarget(job)
    setRejectReason("")
  }

  const handleConfirmReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return
    try {
      setRejectSubmitting(true)
      await AdminApi.moderateJob(rejectTarget.id, "reject", rejectReason.trim())
      setRejectTarget(null)
      loadJobs()
    } catch (err) {
      console.error("Failed to reject job", err)
    } finally {
      setRejectSubmitting(false)
    }
  }

  const handleDelete = async (jobId: string) => {
    if (confirm("Are you sure you want to permanently delete this job listing?")) {
      try {
        // "reject" only flags + hides the job on the backend -- it does not
        // delete anything. The real delete action is literally "delete",
        // which the backend uses to hard-remove the row. Previously this
        // button claimed to "permanently delete" the listing but silently
        // left it fully intact in the database, just flagged and hidden.
        await AdminApi.moderateJob(jobId, "delete", "Administrative deletion")
        loadJobs()
      } catch (err) {
        console.error("Failed to delete job", err)
      }
    }
  }

  // Filter & Search Logic
  const filteredJobs = jobs.filter((j) => {
    const matchesSearch =
      j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.company.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (filterMode === "reported") return j.reported
    if (filterMode === "hidden") return j.visibility === "hidden"
    return true
  })

  const columns: ColumnDef<AdminJob>[] = [
    {
      header: "Opportunity Details",
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-900 dark:text-white text-xs">{row.title}</span>
            {row.reported && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-pink-700 bg-pink-100 dark:bg-pink-950/40 dark:text-pink-300 px-1.5 py-0.25 rounded">
                <AlertTriangle className="size-2.5" />
                Reported
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{row.company}</p>
        </div>
      ),
    },
    {
      header: "Salary & Location",
      cell: (row) => (
        <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          <p>{row.location}</p>
          <p className="text-[10px] text-slate-400">{row.salary}</p>
        </div>
      ),
    },
    {
      header: "Applicants",
      cell: (row) => (
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          {row.applicantsCount} candidates
        </span>
      ),
    },
    {
      header: "Platform Status",
      cell: (row) => (
        <span
          className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${
            row.status === "approved"
              ? "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-350"
              : row.status === "flagged"
              ? "bg-pink-100/60 text-pink-850 dark:bg-pink-950/45 dark:text-pink-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {row.status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
        </span>
      ),
    },
    {
      header: "Visibility",
      cell: (row) => (
        <span
          className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${
            row.visibility === "visible"
              ? "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {row.visibility === "visible" ? "Visible" : "Hidden"}
        </span>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        // Part 15: flex-wrap keeps up to 4 action buttons from forcing this
        // table into horizontal-scroll mode on mobile.
        <div className="flex flex-wrap justify-end gap-1.5">
          {/* Issue 5: the only way to review a posting before it existed at
              all -- clicking a row now also opens this (see onRowClick
              below), this button is just an explicit, discoverable
              affordance for the same action. */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-bold border-slate-200 hover:bg-slate-100"
            onClick={(e) => {
              e.stopPropagation()
              setViewingJob(row)
            }}
          >
            <Eye className="size-3 mr-0.5" />
            View Details
          </Button>
          {/* Approve/Reject must be available for any job actually awaiting
              or previously failing moderation (pending_approval, flagged),
              not just reported ones -- gating Approve on `reported` alone
              meant a freshly-submitted job had no visible way to be
              approved from this screen at all. */}
          {(row.status === "pending_approval" || row.status === "flagged" || row.reported) && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 border-emerald-250 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900 dark:hover:bg-emerald-950/20"
              onClick={(e) => {
                e.stopPropagation()
                handleApprove(row.id)
              }}
            >
              <Check className="size-3 mr-0.5" />
              Approve
            </Button>
          )}
          {(row.status === "pending_approval" || row.reported) && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] font-bold text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950/20"
              onClick={(e) => {
                e.stopPropagation()
                openRejectModal(row)
              }}
            >
              <Ban className="size-3 mr-0.5" />
              Reject
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-bold border-slate-200 hover:bg-slate-100"
            onClick={(e) => {
              e.stopPropagation()
              handleToggleVisibility(row.id)
            }}
          >
            {row.visibility === "visible" ? (
              <>
                <EyeOff className="size-3 mr-0.5" />
                Hide
              </>
            ) : (
              <>
                <Eye className="size-3 mr-0.5" />
                Show
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-[10px] font-bold flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(row.id)
            }}
          >
            <Trash2 className="size-3" />
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Job Opportunity Moderation
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Flag, review reported job postings, toggle listing visibility, or purge fraudulent recruiter job logs.
        </p>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterMode === "all" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("all")}
          >
            All Listings
          </Button>
          <Button
            variant={filterMode === "reported" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold flex items-center gap-1"
            onClick={() => setFilterMode("reported")}
          >
            <AlertTriangle className="size-3 text-pink-500" />
            Reported Only
            <span className="ml-1 bg-pink-100 text-pink-700 dark:bg-pink-900/35 dark:text-pink-300 text-[9px] px-1 rounded-full">
              {jobs.filter((j) => j.reported).length}
            </span>
          </Button>
          <Button
            variant={filterMode === "hidden" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("hidden")}
          >
            Hidden Only
          </Button>
        </div>

        <div className="relative w-full max-w-xs shrink-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search by job title or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9 rounded-lg border-slate-200 bg-white focus-visible:ring-[#6B2C91]/25 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
      </div>

      {/* Jobs table */}
      <DashboardCard className="p-4 overflow-hidden">
        {loading ? (
          <div className="py-12 flex flex-col justify-center items-center gap-2">
            <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Fetching opportunity logs...
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredJobs}
            emptyMessage="No matching job listings found."
            onRowClick={(row) => setViewingJob(row)}
          />
        )}
      </DashboardCard>

      {/* Reject reason modal -- reason is required, matches the backend's
          JobRejected event which surfaces this text to the recruiter. */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Ban className="size-4 text-red-600" />
                Reject "{rejectTarget.title}"
              </h3>
              <button onClick={() => setRejectTarget(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-4">
              <label className="text-[10px] font-black uppercase text-slate-400">Rejection Reason (required)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="e.g. Job description contains discriminatory language, salary range missing, duplicate posting..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
              {!rejectReason.trim() && (
                <p className="mt-1 text-[10px] font-bold text-red-500">A reason is required so the recruiter knows what to fix.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setRejectTarget(null)} className="text-xs font-bold">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmReject}
                disabled={rejectSubmitting || !rejectReason.trim()}
                className="text-xs font-black bg-red-600 hover:bg-red-700 text-white"
              >
                {rejectSubmitting ? "Rejecting..." : "Reject & Notify Recruiter"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Issue 5: full job detail modal, reusing JobDetailContent (variant
          "admin") instead of a duplicate admin-only layout. Built entirely
          from `viewingJob.raw`, already fetched by loadJobs() -- no second
          network request needed to open this. */}
      {viewingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Eye className="size-4 text-[#6B2C91]" />
                Reviewing "{viewingJob.title}"
              </h3>
              <button
                onClick={() => setViewingJob(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-4">
              <JobDetailContent
                job={mapApiJobToExtendedJob(viewingJob.raw) as ExtendedJob}
                variant="admin"
                applicantsCount={viewingJob.applicantsCount}
                moderationHistory={viewingJob.moderationHistory}
              />
            </div>

            <div className="sticky bottom-0 flex flex-wrap justify-end gap-1.5 p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              {(viewingJob.status === "pending_approval" || viewingJob.status === "flagged" || viewingJob.reported) && (
                <Button
                  size="sm"
                  className="h-8 text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    handleApprove(viewingJob.id)
                    setViewingJob(null)
                  }}
                >
                  <Check className="size-3.5 mr-1" />
                  Approve
                </Button>
              )}
              {(viewingJob.status === "pending_approval" || viewingJob.reported) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px] font-bold text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950/20"
                  onClick={() => {
                    openRejectModal(viewingJob)
                    setViewingJob(null)
                  }}
                >
                  <Ban className="size-3.5 mr-1" />
                  Reject
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[11px] font-bold border-slate-200 hover:bg-slate-100"
                onClick={() => {
                  handleToggleVisibility(viewingJob.id)
                  setViewingJob(null)
                }}
              >
                {viewingJob.visibility === "visible" ? (
                  <>
                    <EyeOff className="size-3.5 mr-1" />
                    Hide Listing
                  </>
                ) : (
                  <>
                    <Eye className="size-3.5 mr-1" />
                    Show Listing
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 text-[11px] font-bold"
                onClick={() => {
                  handleDelete(viewingJob.id)
                  setViewingJob(null)
                }}
              >
                <Trash2 className="size-3.5 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default JobModeration
