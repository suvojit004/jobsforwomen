import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Users,
  BriefcaseBusiness,
  Building,
  ShieldCheck,
  Calendar,
  MoreHorizontal,
} from "lucide-react"
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { cn } from "@/lib/utils"
import { AdminApi } from "../services/adminApi"

const APPLICATIONS_COLORS = ["#6B2C91", "#EC4899", "#3B82F6", "#10B981"]

// Defends the dashboard's loading state against any single request that
// hangs indefinitely (rather than cleanly rejecting). Promise.all/allSettled
// only resolve once every input promise *settles* -- if one of them never
// resolves or rejects (e.g. a backend call blocked on a slow/unreachable
// external service), the whole page is stuck on "Loading..." forever,
// because `finally` can't run until the awaited Promise.all() itself
// settles. Racing each call against a timeout guarantees it always settles
// one way or another within a bounded time.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

export function Dashboard() {
  const navigate = useNavigate()
  const [companyTab, setCompanyTab] = useState<"pending" | "approved" | "rejected">("pending")
  const [jobTab, setJobTab] = useState<"all" | "reported" | "removed">("all")

  const [metrics, setMetrics] = useState<any>(null)
  const [companies, setCompanies] = useState<any[]>([])
  const [candidates, setCandidates] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [audits, setAudits] = useState<any[]>([])
  // Real platform-wide counts, computed from the *full* lists before they get
  // sliced down to a 5-row preview below. The tab badges and KPI tiles
  // previously showed hardcoded numbers (e.g. "Pending (10)", "24,685
  // Candidates") completely disconnected from any real data.
  const [companyStatusCounts, setCompanyStatusCounts] = useState({ pending: 0, approved: 0, rejected: 0 })
  const [jobStatusCounts, setJobStatusCounts] = useState({ all: 0, reported: 0, removed: 0 })
  const [candidateStats, setCandidateStats] = useState({ total: 0, newThisWeek: 0, active: 0, inactive: 0 })
  const [applicationFunnel, setApplicationFunnel] = useState<{ name: string; value: number; percent: string }[]>([])
  const [departmentDistribution, setDepartmentDistribution] = useState<{ name: string; value: number; color: string; max: number }[]>([])
  const [userGrowth, setUserGrowth] = useState<{ day: string; Users: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadErrors, setLoadErrors] = useState<string[]>([])

  useEffect(() => {
    async function loadData() {
      // Promise.allSettled + a per-call timeout means: (a) one failing or
      // hanging widget can never block the rest of the dashboard from
      // rendering, and (b) `finally` below is guaranteed to run within
      // ~15s no matter what any individual backend call does.
      const [dashResult, userResult, companyResult, jobsResult, auditResult] = await Promise.allSettled([
        withTimeout(AdminApi.getDashboard(), 15000, "Dashboard metrics"),
        withTimeout(AdminApi.getUsers(), 15000, "User list"),
        withTimeout(AdminApi.getCompanies(), 15000, "Company list"),
        withTimeout(AdminApi.getJobs(), 15000, "Job list"),
        withTimeout(AdminApi.getAudits(), 15000, "Audit log"),
      ])

      try {
        const failures: string[] = []

        const dash = dashResult.status === "fulfilled" ? dashResult.value : null
        if (dashResult.status === "rejected") {
          console.error("Failed to load dashboard metrics", dashResult.reason)
          failures.push("Dashboard metrics")
        }

        const userList = userResult.status === "fulfilled" ? (userResult.value || []) : []
        if (userResult.status === "rejected") {
          console.error("Failed to load users", userResult.reason)
          failures.push("Users")
        }

        const companyList = companyResult.status === "fulfilled" ? (companyResult.value || []) : []
        if (companyResult.status === "rejected") {
          console.error("Failed to load companies", companyResult.reason)
          failures.push("Companies")
        }

        const jobsList = jobsResult.status === "fulfilled" ? (jobsResult.value || []) : []
        if (jobsResult.status === "rejected") {
          console.error("Failed to load jobs", jobsResult.reason)
          failures.push("Jobs")
        }

        const auditList = auditResult.status === "fulfilled" ? (auditResult.value || []) : []
        if (auditResult.status === "rejected") {
          console.error("Failed to load audit log", auditResult.reason)
          failures.push("Activity log")
        }

        setLoadErrors(failures)

        const candidateUsers = (userList || []).filter((u: any) =>
          u.roles?.some((r: any) => r.role?.name === "Candidate")
        )

        // Real counts only -- this previously fell back to large hardcoded
        // numbers (2458 companies, 5784 jobs, 24685 candidates, and an
        // unconditional fake 12392 applications) whenever the real count was
        // 0, which is exactly the case for a fresh/empty platform: a brand
        // new install would show fabricated activity instead of true zeros.
        const analytics = dash?.analytics || {}
        setMetrics({
          companies: companyList.length,
          jobs: jobsList.length,
          candidates: candidateUsers.length,
          applications: analytics.applicationVolume ?? 0,
        })
        setApplicationFunnel(analytics.applicationFunnel || [])
        setDepartmentDistribution(analytics.departmentDistribution || [])
        setUserGrowth(analytics.userGrowth || [])

        // Real per-status counts computed from the full (unsliced) lists --
        // the tab badges below previously showed fixed numbers regardless of
        // what was actually in the database.
        const pendingStatuses = new Set(["pending", "pending_verification", "submitted", "under_review", "draft", "info_requested"])
        setCompanyStatusCounts({
          pending: (companyList || []).filter((c: any) => pendingStatuses.has(c.status)).length,
          approved: (companyList || []).filter((c: any) => c.status === "approved").length,
          rejected: (companyList || []).filter((c: any) => c.status === "rejected").length,
        })
        setJobStatusCounts({
          all: (jobsList || []).length,
          reported: (jobsList || []).filter((j: any) => !!j.reported).length,
          removed: (jobsList || []).filter((j: any) => j.status === "archived").length,
        })

        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        setCandidateStats({
          total: candidateUsers.length,
          newThisWeek: candidateUsers.filter((u: any) => u.createdAt && new Date(u.createdAt).getTime() >= oneWeekAgo).length,
          active: candidateUsers.filter((u: any) => u.status === "Active").length,
          inactive: candidateUsers.filter((u: any) => u.status !== "Active").length,
        })

        setCompanies((companyList || []).slice(0, 5).map((c: any) => ({
          id: c.id,
          name: c.name,
          contact: c.recruiterProfile?.fullName || "Recruiter",
          date: c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Today",
          badge: c.status === "approved" ? "Approved" : c.status === "rejected" ? "Rejected" : "Pending Review",
          status: c.status,
        })))

        setCandidates(candidateUsers.slice(0, 5).map((u: any) => ({
          name: u.fullName || u.email.split("@")[0],
          email: u.email,
          date: u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Today",
          status: u.status === "Active" ? "Active" : "Inactive"
        })))

        setJobs((jobsList || []).slice(0, 5).map((j: any) => ({
          id: j.id,
          title: j.title,
          company: j.company?.name || "Unknown Company",
          // Job has real `reported` (boolean) and `status` (archived, etc.)
          // fields -- previously this collapsed every non-"approved" status
          // into "Reported" and never produced "Removed" at all, so the
          // Removed tab below could never show anything even when jobs had
          // actually been archived.
          status: j.status === "archived" ? "Removed" : j.reported ? "Reported" : j.status === "approved" ? "Active" : "Other"
        })))

        setAudits((auditList || []).slice(0, 4).map((a: any) => ({
          // AuditLog has no `actorId` field -- it's `operatorEmail`/`operatorId`.
          // The previous code always rendered "by User undefined" for every
          // single real audit row.
          title: `${a.action.replace(/_/g, " ")} on ${a.entity || "record"}`,
          actor: a.operatorEmail ? `by ${a.operatorEmail}` : "by System"
        })))

      } catch (err) {
        console.error("Failed to render admin dashboard", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const handleApproveCompany = async (id: string) => {
    try {
      await AdminApi.verifyCompany(id, "approved")
      setCompanies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, badge: "Approved", status: "approved" } : c))
      )
    } catch (err) {
      console.error("Failed to approve company", err)
    }
  }

  const handleRejectCompany = async (id: string) => {
    try {
      await AdminApi.verifyCompany(id, "rejected")
      setCompanies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, badge: "Rejected", status: "rejected" } : c))
      )
    } catch (err) {
      console.error("Failed to reject company", err)
    }
  }

  // Filtered Company Approvals based on selected tab
  const displayCompanies = companies.filter((c) => {
    if (companyTab === "pending") return c.status === "pending" || c.status === "draft" || c.status === "submitted"
    if (companyTab === "approved") return c.status === "approved"
    return c.status === "rejected"
  })

  // Filtered Job Moderation based on selected tab
  const displayJobs = jobs.filter((j) => {
    if (jobTab === "reported") return j.status === "Reported"
    if (jobTab === "removed") return j.status === "Removed"
    return true
  })

  // Real "last 7 days" range instead of a hardcoded, permanently stale date
  // string (previously always showed "12 May 2025 - 18 May 2025" no matter
  // what today's actual date was).
  const last7DaysLabel = (() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 6)
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    return `${fmt(start)} - ${fmt(end)}`
  })()

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading admin console...</div>
  }

  return (
    <div className="space-y-6 select-none animate-fadeIn">

      {loadErrors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          Some dashboard data couldn't be loaded right now ({loadErrors.join(", ")}). The rest of the
          dashboard below is showing normally -- try refreshing the page to retry the missing sections.
        </div>
      )}

      {/* Date and Dashboard Overview Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Dashboard Overview
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            Welcome back, Admin! Here's what's happening on the platform.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Calendar className="size-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-350 border border-slate-200 bg-white px-3 py-1.5 rounded-lg dark:border-slate-800 dark:bg-slate-900">
            {last7DaysLabel}
          </span>
        </div>
      </div>

      {/* Top Statistics Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Companies */}
        <DashboardCard className="p-4 flex items-center gap-4 hover:border-purple-300 dark:hover:border-purple-900 hover:-translate-y-0.5 transition-all">
          <div className="p-3 rounded-xl bg-purple-550/10 text-[#6B2C91] dark:bg-purple-950/30 dark:text-pink-300">
            <Building className="size-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {metrics?.companies ?? 0}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
              Total Companies
            </p>
          </div>
        </DashboardCard>

        {/* Card 2: Total Jobs */}
        <DashboardCard className="p-4 flex items-center gap-4 hover:border-pink-300 dark:hover:border-pink-900 hover:-translate-y-0.5 transition-all">
          <div className="p-3 rounded-xl bg-pink-500/10 text-pink-600 dark:bg-pink-950/30 dark:text-pink-300">
            <BriefcaseBusiness className="size-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {metrics?.jobs ?? 0}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
              Total Jobs
            </p>
          </div>
        </DashboardCard>

        {/* Card 3: Total Candidates */}
        <DashboardCard className="p-4 flex items-center gap-4 hover:border-blue-300 dark:hover:border-blue-900 hover:-translate-y-0.5 transition-all">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
            <Users className="size-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {metrics?.candidates ?? 0}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
              Total Candidates
            </p>
          </div>
        </DashboardCard>

        {/* Card 4: Total Applications */}
        <DashboardCard className="p-4 flex items-center gap-4 hover:border-emerald-300 dark:hover:border-emerald-900 hover:-translate-y-0.5 transition-all">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {metrics?.applications ?? 0}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
              Total Applications
            </p>
          </div>
        </DashboardCard>
      </div>

      {/* Row 1 Grid: Company Approvals, Candidate Info, Job Moderation */}
      <div className="grid gap-6 xl:grid-cols-3">
        
        {/* Column 1: Company Approvals Table */}
        <DashboardCard className="p-5 flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white">
              Company Approvals
            </h4>
            <Link to="/admin/company-approvals" className="text-[10px] font-black text-[#6B2C91] dark:text-pink-300 hover:underline">
              View all
            </Link>
          </div>

          {/* Interactive filter tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 text-[10px] font-black">
            <button
              onClick={() => setCompanyTab("pending")}
              className={cn(
                "pb-2 pr-4 border-b-2 transition-all",
                companyTab === "pending"
                  ? "border-[#6B2C91] text-[#6B2C91] dark:border-pink-500 dark:text-pink-300"
                  : "border-transparent text-slate-405 dark:text-slate-500"
              )}
            >
              Pending ({companyStatusCounts.pending})
            </button>
            <button
              onClick={() => setCompanyTab("approved")}
              className={cn(
                "pb-2 px-4 border-b-2 transition-all",
                companyTab === "approved"
                  ? "border-[#6B2C91] text-[#6B2C91] dark:border-pink-500 dark:text-pink-300"
                  : "border-transparent text-slate-405 dark:text-slate-500"
              )}
            >
              Approved ({companyStatusCounts.approved})
            </button>
            <button
              onClick={() => setCompanyTab("rejected")}
              className={cn(
                "pb-2 pl-4 border-b-2 transition-all",
                companyTab === "rejected"
                  ? "border-[#6B2C91] text-[#6B2C91] dark:border-pink-500 dark:text-pink-300"
                  : "border-transparent text-slate-405 dark:text-slate-500"
              )}
            >
              Rejected ({companyStatusCounts.rejected})
            </button>
          </div>

          {/* Mini DataTable */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse font-semibold">
              <thead>
                <tr className="border-b border-slate-50 dark:border-slate-850 text-slate-400">
                  <th className="py-2 pr-2 font-black">Company</th>
                  <th className="py-2 px-2 font-black">Contact Person</th>
                  <th className="py-2 px-2 font-black">Applied On</th>
                  <th className="py-2 px-2 font-black">Premium Badge</th>
                  <th className="py-2 pl-2 font-black text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
                {displayCompanies.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                    <td className="py-2.5 pr-2 font-bold text-slate-900 dark:text-white">
                      {row.name}
                    </td>
                    <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400">
                      {row.contact}
                    </td>
                    <td className="py-2.5 px-2 text-slate-500 font-mono">
                      {row.date}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={cn(
                        "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                        row.badge === "Pending Review"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400"
                          : row.badge === "Not Claimed"
                          ? "bg-slate-100 text-slate-655 dark:bg-slate-800 dark:text-slate-400"
                          : "bg-pink-100 text-pink-700 dark:bg-pink-950/20 dark:text-pink-300"
                      )}>
                        {row.badge}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      {row.status === "pending" ? (
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleApproveCompany(row.id)}
                            className="text-emerald-600 hover:underline font-black text-[10px]"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectCompany(row.id)}
                            className="text-red-500 hover:underline font-black text-[10px]"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Link to="/admin/company-approvals" className="text-[10px] font-black text-[#6B2C91] dark:text-pink-300 flex items-center gap-1 mt-2 hover:underline">
            View all pending companies →
          </Link>
        </DashboardCard>

        {/* Column 2: Candidate Information */}
        <DashboardCard className="p-5 flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white">
              Candidate Information
            </h4>
            <Link to="/admin/candidate-management" className="text-[10px] font-black text-[#6B2C91] dark:text-pink-300 hover:underline">
              View all
            </Link>
          </div>

          {/* KPI Mini-Tiles -- real counts computed from the full candidate
              list (see candidateStats above), not fixed placeholder numbers. */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-purple-50/50 p-2 rounded-xl dark:bg-slate-950/20 text-center space-y-1">
              <span className="text-xs font-black text-[#6B2C91] dark:text-pink-300">{candidateStats.total.toLocaleString()}</span>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Candidates</p>
            </div>
            <div className="bg-emerald-50/50 p-2 rounded-xl dark:bg-slate-950/20 text-center space-y-1">
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{candidateStats.newThisWeek.toLocaleString()}</span>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">New</p>
            </div>
            <div className="bg-blue-50/50 p-2 rounded-xl dark:bg-slate-950/20 text-center space-y-1">
              <span className="text-xs font-black text-blue-600 dark:text-blue-300">{candidateStats.active.toLocaleString()}</span>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Active</p>
            </div>
            <div className="bg-pink-50/50 p-2 rounded-xl dark:bg-slate-950/20 text-center space-y-1">
              <span className="text-xs font-black text-pink-600 dark:text-pink-300">{candidateStats.inactive.toLocaleString()}</span>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Inactive</p>
            </div>
          </div>

          {/* Recent registered heading */}
          <div>
            <h5 className="text-[10px] font-black text-slate-405 uppercase tracking-widest">
              Recent Registered Candidates
            </h5>
          </div>

          {/* Candidates table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse font-semibold">
              <thead>
                <tr className="border-b border-slate-50 dark:border-slate-850 text-slate-400">
                  <th className="py-2 pr-2 font-black">Candidate</th>
                  <th className="py-2 px-2 font-black">Email</th>
                  <th className="py-2 px-2 font-black">Registered On</th>
                  <th className="py-2 px-2 font-black">Status</th>
                  <th className="py-2 pl-2 font-black text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
                {candidates.map((cand, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                    <td className="py-2.5 pr-2 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <div className="size-6 rounded-full bg-violet-100 text-[#6B2C91] dark:bg-pink-900/20 dark:text-pink-300 flex items-center justify-center font-black text-[9px] shrink-0">
                        {cand.name.charAt(0)}
                      </div>
                      {cand.name}
                    </td>
                    <td className="py-2.5 px-2 text-slate-650 dark:text-slate-400 font-medium">
                      {cand.email}
                    </td>
                    <td className="py-2.5 px-2 text-slate-500 font-mono">
                      {cand.date}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={cn(
                        "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                        cand.status === "Active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-450"
                          : "bg-slate-100 text-slate-655 dark:bg-slate-800 dark:text-slate-400"
                      )}>
                        {cand.status}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      <Link to="/admin/candidate-management" className="text-[#6B2C91] dark:text-pink-300 font-black text-[10px] hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Link to="/admin/candidate-management" className="text-[10px] font-black text-[#6B2C91] dark:text-pink-300 flex items-center gap-1 mt-2 hover:underline">
            View all candidates →
          </Link>
        </DashboardCard>

        {/* Column 3: Job Moderation */}
        <DashboardCard className="p-5 flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white">
              Job Moderation
            </h4>
            <Link to="/admin/job-moderation" className="text-[10px] font-black text-[#6B2C91] dark:text-pink-300 hover:underline">
              View all
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 text-[10px] font-black">
            <button
              onClick={() => setJobTab("all")}
              className={cn(
                "pb-2 pr-4 border-b-2 transition-all",
                jobTab === "all"
                  ? "border-[#6B2C91] text-[#6B2C91] dark:border-pink-500 dark:text-pink-300"
                  : "border-transparent text-slate-405 dark:text-slate-500"
              )}
            >
              All Jobs ({jobStatusCounts.all.toLocaleString()})
            </button>
            <button
              onClick={() => setJobTab("reported")}
              className={cn(
                "pb-2 px-4 border-b-2 transition-all",
                jobTab === "reported"
                  ? "border-[#6B2C91] text-[#6B2C91] dark:border-pink-500 dark:text-pink-300"
                  : "border-transparent text-slate-405 dark:text-slate-500"
              )}
            >
              Reported ({jobStatusCounts.reported})
            </button>
            <button
              onClick={() => setJobTab("removed")}
              className={cn(
                "pb-2 pl-4 border-b-2 transition-all",
                jobTab === "removed"
                  ? "border-[#6B2C91] text-[#6B2C91] dark:border-pink-500 dark:text-pink-300"
                  : "border-transparent text-slate-405 dark:text-slate-500"
              )}
            >
              Removed ({jobStatusCounts.removed})
            </button>
          </div>

          {/* Job listings table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse font-semibold">
              <thead>
                <tr className="border-b border-slate-50 dark:border-slate-850 text-slate-400">
                  <th className="py-2 pr-2 font-black">Job Title</th>
                  <th className="py-2 px-2 font-black">Company</th>
                  <th className="py-2 px-2 font-black">Status</th>
                  <th className="py-2 pl-2 font-black text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
                {displayJobs.map((job, idx) => (
                  <tr
                    key={idx}
                    className={cn(
                      "hover:bg-slate-50/40 dark:hover:bg-slate-900/10",
                      job.status === "Reported" && "bg-amber-500/5 dark:bg-amber-950/10"
                    )}
                  >
                    <td className="py-2.5 pr-2 font-bold text-slate-900 dark:text-white">
                      {job.title}
                    </td>
                    <td className="py-2.5 px-2 text-slate-500 font-medium">
                      {job.company}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={cn(
                        "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                        job.status === "Active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400"
                      )}>
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      <button
                        onClick={() => navigate("/admin/job-moderation")}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                        aria-label="Manage this job in Job Moderation"
                        title="Manage this job in Job Moderation"
                      >
                        <MoreHorizontal className="size-4 ml-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Link to="/admin/job-moderation" className="text-[10px] font-black text-[#6B2C91] dark:text-pink-300 flex items-center gap-1 mt-2 hover:underline">
            View all jobs →
          </Link>
        </DashboardCard>

      </div>

      {/* Row 2 Grid: 5 Column Layout (Desktop side-by-side widgets) */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
        
        {/* Widget 1: Applications by Status (Donut Chart) */}
        <DashboardCard className="p-4 flex flex-col justify-between space-y-3 h-full">
          <h5 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Applications by Status
          </h5>
          {applicationFunnel.length === 0 ? (
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 py-6 text-center">No applications yet.</p>
          ) : (
          <>
          <div className="h-32 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={applicationFunnel}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={45}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {applicationFunnel.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={APPLICATIONS_COLORS[index % APPLICATIONS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-[9px] font-black text-slate-500">
            {applicationFunnel.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: APPLICATIONS_COLORS[idx] }} />
                  <span>{item.name}</span>
                </div>
                <span>{item.value.toLocaleString()} ({item.percent})</span>
              </div>
            ))}
          </div>
          </>
          )}
        </DashboardCard>

        {/* Widget 2: Top Job Categories (Progress Indicators) */}
        <DashboardCard className="p-4 flex flex-col justify-between space-y-3 h-full">
          <h5 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Top Job Categories
          </h5>
          <div className="space-y-3.5">
            {departmentDistribution.length === 0 ? (
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">No jobs posted yet.</p>
            ) : (
              departmentDistribution.map((cat, idx) => {
                const widthPercent = Math.min(100, (cat.value / cat.max) * 100)
                return (
                  <div key={idx} className="space-y-1 font-bold text-[10px]">
                    <div className="flex justify-between text-slate-700 dark:text-slate-350">
                      <span>{cat.name}</span>
                      <span className="font-black text-slate-900 dark:text-white">{cat.value.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full dark:bg-slate-800 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", cat.color)}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </DashboardCard>

        {/* Widget 3: Recent Activities Feed */}
        <DashboardCard className="p-4 flex flex-col justify-between space-y-3 h-full">
          <h5 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Recent Activities
          </h5>
          <div className="space-y-3">
            {audits.length === 0 ? (
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">No recent activity recorded yet.</p>
            ) : (
              audits.map((item, idx) => (
                <div key={idx} className="text-[10px] leading-relaxed border-l-2 border-slate-150 pl-2 dark:border-slate-800">
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">
                    {item.title}
                  </p>
                  <span className="text-[9px] font-bold text-slate-450 dark:text-slate-500">
                    {item.actor}
                  </span>
                </div>
              ))
            )}
          </div>
          <Link to="/admin/activity-logs" className="text-[9px] font-black text-[#6B2C91] dark:text-pink-300 hover:underline">
            View all activities →
          </Link>
        </DashboardCard>

        {/* Widget 4: Company Details Overview */}
        <DashboardCard className="p-4 flex flex-col justify-between space-y-3 h-full">
          <h5 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Company Details Overview
          </h5>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[9px] border-collapse font-bold">
              <thead>
                <tr className="border-b border-slate-50 dark:border-slate-850 text-slate-450">
                  <th className="py-1 font-black">Company</th>
                  <th className="py-1 px-1 font-black">Premium Partner Status</th>
                  <th className="py-1 font-black text-right">Updated On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-3 text-center text-slate-400 font-bold">No companies registered yet.</td>
                  </tr>
                ) : (
                  companies.map((item, idx) => {
                    const style =
                      item.badge === "Approved"
                        ? "bg-pink-100 text-pink-700 dark:bg-pink-950/20 dark:text-pink-300"
                        : item.badge === "Rejected"
                        ? "bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400"
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10">
                        <td className="py-1.5 font-extrabold text-slate-900 dark:text-white max-w-[80px] truncate">{item.name}</td>
                        <td className="py-1.5 px-1">
                          <span className={cn("text-[8px] font-black uppercase px-1 py-0.5 rounded", style)}>
                            {item.badge}
                          </span>
                        </td>
                        <td className="py-1.5 text-right font-mono text-slate-400">{item.date}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <Link to="/admin/company-details" className="text-[9px] font-black text-[#6B2C91] dark:text-pink-300 hover:underline">
            View all companies →
          </Link>
        </DashboardCard>

        {/* Widget 5: User Growth Line Area Chart */}
        <DashboardCard className="p-4 flex flex-col justify-between space-y-3 h-full">
          <div>
            <h5 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">
              User Growth <span className="text-[8px] font-bold text-slate-450 uppercase">(This Week)</span>
            </h5>
            <div className="mt-1">
              <span className="text-lg font-black text-slate-900 dark:text-white">
                {(userGrowth[userGrowth.length - 1]?.Users ?? 0).toLocaleString()}
              </span>
              {(() => {
                const first = userGrowth[0]?.Users ?? 0
                const last = userGrowth[userGrowth.length - 1]?.Users ?? 0
                const changePercent = first > 0 ? (((last - first) / first) * 100).toFixed(1) : null
                return changePercent !== null ? (
                  <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-450 flex items-center gap-0.5 mt-0.5">
                    ↑ {changePercent}% <span className="font-semibold text-slate-405 dark:text-slate-500">from last week</span>
                  </p>
                ) : null
              })()}
            </div>
          </div>
          <div className="h-24 text-[8px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userGrowth} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="growthLineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6B2C91" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6B2C91" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-50 dark:stroke-slate-850" />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={7} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="Users" stroke="#6B2C91" fillOpacity={1} fill="url(#growthLineGradient)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>

      </div>
    </div>
  )
}
export default Dashboard
