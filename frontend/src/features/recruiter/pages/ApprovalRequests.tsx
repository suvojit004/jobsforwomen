import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import {
  Building2,
  Clock,
  FileCheck,
  MessageSquare,
  Award,
  ArrowRight,
} from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { RecruiterApi } from "../services/recruiterApi"
import { getSocket } from "@/api/socket"

interface HistoryEntry {
  status: string
  notes: string | null
  adminEmail: string
  createdAt: string
}

interface PerkRequestRow {
  id: string
  perkName: string
  status: string
  adminComment: string | null
  submittedAt: string
  reviewedAt: string | null
}

interface Tracker {
  company: {
    name: string
    status: string
    feedback: string | null
    createdAt: string
    recruiterResubmissionComment: string | null
    resubmittedAt: string | null
  }
  history: HistoryEntry[]
  perkRequests: PerkRequestRow[]
}

// Accessible status color mapping (Part 17 of the spec) -- Pending is Blue
// (not the old ambiguous yellow), Approved Green, Rejected Red, More Info
// Purple/Indigo, shared across both Company Registration and Perk statuses
// so a recruiter reads the same color language everywhere in the dashboard.
function statusStyles(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
    case "pending":
    case "under_review":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
    case "info_requested":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
    case "rejected":
      return "bg-pink-100 text-pink-800 dark:bg-pink-950/30 dark:text-pink-300"
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "info_requested":
      return "More Information Required"
    case "under_review":
      return "Under Review"
    default:
      return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

export function ApprovalRequests() {
  const [tracker, setTracker] = useState<Tracker | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const data = await RecruiterApi.getApprovalTracker()
      setTracker(data || null)
    } catch (err) {
      console.error("Failed to load approval tracker", err)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Part 18: live refresh when an admin reviews a perk claim (the only
  // recruiter-facing realtime signal this tracker page can react to --
  // company registration outcomes are communicated by email only, per Part 3,
  // so there's no analogous dashboard notification to listen for there).
  // Silent (no loading-spinner flash) since this can fire while the
  // recruiter is actively looking at the page.
  useEffect(() => {
    const socket = getSocket("recruiter")
    const handleNotification = (data: any) => {
      if (data?.category === "Moderation" && data?.actionUrl === "/recruiter/perks") {
        load(true)
      }
    }
    socket.on("notification", handleNotification)
    return () => {
      socket.off("notification", handleNotification)
    }
  }, [])

  if (loading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading approval requests...</div>
  }

  if (!tracker) {
    return (
      <div className="p-8 text-center text-sm font-bold text-slate-400">
        Could not load your approval requests. Please try again later.
      </div>
    )
  }

  const { company, history, perkRequests } = tracker

  return (
    <div className="space-y-6 select-none animate-fadeIn max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Approval Requests
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Track your company registration status and every perk certification you've claimed.
        </p>
      </div>

      {/* Company Registration */}
      <DashboardCard className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5">
            <Building2 className="size-4 text-[#6B2C91]" />
            Company Registration
          </h3>
          <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-black uppercase", statusStyles(company.status))}>
            {statusLabel(company.status)}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Company</p>
            <p className="font-bold text-slate-800 dark:text-slate-200">{company.name}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Submitted</p>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {new Date(company.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {company.feedback && (
          <p className="text-[11px] italic font-semibold text-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-300 p-2.5 rounded border border-slate-100 dark:border-slate-800/80">
            <span className="font-bold not-italic text-[9px] uppercase tracking-wider text-slate-450 mr-1">Admin note:</span>
            "{company.feedback}"
          </p>
        )}

        {company.recruiterResubmissionComment && (
          <p className="text-[11px] italic font-semibold text-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-300 p-2.5 rounded border border-slate-100 dark:border-slate-800/80">
            <span className="font-bold not-italic text-[9px] uppercase tracking-wider text-slate-450 mr-1">Your reply:</span>
            "{company.recruiterResubmissionComment}"
            {company.resubmittedAt && (
              <span className="ml-1 text-slate-400 not-italic font-bold">
                ({new Date(company.resubmittedAt).toLocaleDateString()})
              </span>
            )}
          </p>
        )}

        {history.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <Clock className="size-3" />
              Timeline
            </p>
            <ul className="space-y-2">
              {history.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px]">
                  <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase", statusStyles(h.status))}>
                    {statusLabel(h.status)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-slate-600 dark:text-slate-300 font-semibold">
                      {h.notes || `Status updated to ${statusLabel(h.status)}`}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {h.adminEmail} · {new Date(h.createdAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DashboardCard>

      {/* Perk Requests */}
      <DashboardCard className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5">
            <Award className="size-4 text-[#6B2C91]" />
            Perk Requests
          </h3>
          <Button asChild size="sm" variant="outline" className="h-7 text-[10px] font-bold border-slate-200 dark:border-slate-800">
            <Link to="/recruiter/perks">
              Manage Perks
              <ArrowRight className="size-3 ml-1" />
            </Link>
          </Button>
        </div>

        {perkRequests.length === 0 ? (
          <div className="py-4 flex items-center gap-2 text-slate-400">
            <FileCheck className="size-4" />
            <span className="text-xs font-bold">No perks claimed yet.</span>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {perkRequests.map((p) => (
              <li key={p.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{p.perkName}</p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase", statusStyles(p.status))}>
                    {statusLabel(p.status)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Submitted {new Date(p.submittedAt).toLocaleDateString()}
                  {p.reviewedAt && ` · Reviewed ${new Date(p.reviewedAt).toLocaleDateString()}`}
                </p>
                {p.adminComment && (
                  <p className="text-[11px] italic font-semibold text-slate-600 dark:text-slate-300 flex items-start gap-1">
                    <MessageSquare className="size-3 mt-0.5 shrink-0 text-slate-400" />
                    "{p.adminComment}"
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </div>
  )
}
export default ApprovalRequests
