import { useState, useEffect } from "react"
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

const applicationsData = [
  { name: "Applied", value: 7452, percent: "40.2%" },
  { name: "Shortlisted", value: 2512, percent: "20.3%" },
  { name: "Interviewing", value: 1523, percent: "12.3%" },
  { name: "Offered", value: 905, percent: "7.2%" },
]

const categoriesData = [
  { name: "IT & Software", value: 2458, color: "bg-[#6B2C91]", max: 2500 },
  { name: "Marketing", value: 1245, color: "bg-blue-500", max: 2500 },
  { name: "Design", value: 890, color: "bg-cyan-500", max: 2500 },
  { name: "HR", value: 654, color: "bg-emerald-500", max: 2500 },
  { name: "Others", value: 539, color: "bg-amber-500", max: 2500 },
]

const growthData = [
  { day: "12 May", Users: 18000 },
  { day: "13 May", Users: 19500 },
  { day: "14 May", Users: 21000 },
  { day: "15 May", Users: 22200 },
  { day: "16 May", Users: 23500 },
  { day: "17 May", Users: 24000 },
  { day: "18 May", Users: 24685 },
]

export function Dashboard() {
  const [companyTab, setCompanyTab] = useState<"pending" | "approved" | "rejected">("pending")
  const [jobTab, setJobTab] = useState<"all" | "reported" | "removed">("all")

  const [metrics, setMetrics] = useState<any>(null)
  const [companies, setCompanies] = useState<any[]>([])
  const [candidates, setCandidates] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [audits, setAudits] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [_dash, _health, userList, companyList, jobsList, auditList] = await Promise.all([
          AdminApi.getDashboard(),
          AdminApi.getHealth(),
          AdminApi.getUsers(),
          AdminApi.getCompanies(),
          AdminApi.getJobs(),
          AdminApi.getAudits(),
        ])

        const candidateUsers = (userList || []).filter((u: any) =>
          u.roles?.some((r: any) => r.role?.name === "Candidate")
        )

        setMetrics({
          companies: companyList.length || 2458,
          jobs: jobsList.length || 5784,
          candidates: candidateUsers.length || 24685,
          applications: 12392,
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
          title: j.title,
          company: j.company?.name || "TechNova Solutions",
          status: j.status === "approved" ? "Active" : "Reported"
        })))

        setAudits((auditList || []).slice(0, 4).map((a: any) => ({
          title: `${a.action.replace(/_/g, " ")} on ${a.entity}`,
          actor: `by User ${a.actorId}`
        })))

      } catch (err) {
        console.error("Failed to load admin dashboard", err)
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

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading admin console...</div>
  }

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      
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
            12 May 2025 - 18 May 2025
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
              {metrics?.companies || 2458}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
              Total Companies
            </p>
            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-0.5">
              ↑ 12.3% <span className="font-semibold text-slate-405 dark:text-slate-500">from last week</span>
            </span>
          </div>
        </DashboardCard>

        {/* Card 2: Total Jobs */}
        <DashboardCard className="p-4 flex items-center gap-4 hover:border-pink-300 dark:hover:border-pink-900 hover:-translate-y-0.5 transition-all">
          <div className="p-3 rounded-xl bg-pink-500/10 text-pink-600 dark:bg-pink-950/30 dark:text-pink-300">
            <BriefcaseBusiness className="size-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {metrics?.jobs || 5784}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
              Total Jobs
            </p>
            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-0.5">
              ↑ 18.7% <span className="font-semibold text-slate-405 dark:text-slate-500">from last week</span>
            </span>
          </div>
        </DashboardCard>

        {/* Card 3: Total Candidates */}
        <DashboardCard className="p-4 flex items-center gap-4 hover:border-blue-300 dark:hover:border-blue-900 hover:-translate-y-0.5 transition-all">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
            <Users className="size-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {metrics?.candidates || 24685}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
              Total Candidates
            </p>
            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-0.5">
              ↑ 15.2% <span className="font-semibold text-slate-405 dark:text-slate-500">from last week</span>
            </span>
          </div>
        </DashboardCard>

        {/* Card 4: Total Applications */}
        <DashboardCard className="p-4 flex items-center gap-4 hover:border-emerald-300 dark:hover:border-emerald-900 hover:-translate-y-0.5 transition-all">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {metrics?.applications || 12392}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
              Total Applications
            </p>
            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-0.5">
              ↑ 20.1% <span className="font-semibold text-slate-405 dark:text-slate-500">from last week</span>
            </span>
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
            <a href="/admin/company-approvals" className="text-[10px] font-black text-[#6B2C91] dark:text-pink-300 hover:underline">
              View all
            </a>
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
              Pending (10)
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
              Approved (120)
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
              Rejected (15)
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

          <a href="/admin/company-approvals" className="text-[10px] font-black text-[#6B2C91] dark:text-pink-300 flex items-center gap-1 mt-2 hover:underline">
            View all pending companies →
          </a>
        </DashboardCard>

        {/* Column 2: Candidate Information */}
        <DashboardCard className="p-5 flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white">
              Candidate Information
            </h4>
            <a href="/admin/candidate-management" className="text-[10px] font-black text-[#6B2C91] dark:text-pink-300 hover:underline">
              View all
            </a>
          </div>

          {/* KPI Mini-Tiles */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-purple-50/50 p-2 rounded-xl dark:bg-slate-950/20 text-center space-y-1">
              <span className="text-xs font-black text-[#6B2C91] dark:text-pink-300">24,685</span>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Candidates</p>
            </div>
            <div className="bg-emerald-50/50 p-2 rounded-xl dark:bg-slate-950/20 text-center space-y-1">
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">3,120</span>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">New</p>
            </div>
            <div className="bg-blue-50/50 p-2 rounded-xl dark:bg-slate-950/20 text-center space-y-1">
              <span className="text-xs font-black text-blue-600 dark:text-blue-300">18,564</span>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Active</p>
            </div>
            <div className="bg-pink-50/50 p-2 rounded-xl dark:bg-slate-950/20 text-center space-y-1">
              <span className="text-xs font-black text-pink-600 dark:text-pink-300">2,121</span>
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
                      <a href="/admin/candidate-management" className="text-[#6B2C91] dark:text-pink-300 font-black text-[10px] hover:underline">
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <a href="/admin/candidate-management" className="text-[10px] font-black text-[#6B2C91] dark:text-pink-300 flex items-center gap-1 mt-2 hover:underline">
            View all candidates →
          </a>
        </DashboardCard>

        {/* Column 3: Job Moderation */}
        <DashboardCard className="p-5 flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white">
              Job Moderation
            </h4>
            <a href="/admin/job-moderation" className="text-[10px] font-black text-[#6B2C91] dark:text-pink-300 hover:underline">
              View all
            </a>
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
              All Jobs (1,248)
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
              Reported (12)
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
              Removed (45)
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
                        onClick={() => alert(`Opening action menu for ${job.title}...`)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                        aria-label="More actions"
                      >
                        <MoreHorizontal className="size-4 ml-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <a href="/admin/job-moderation" className="text-[10px] font-black text-[#6B2C91] dark:text-pink-300 flex items-center gap-1 mt-2 hover:underline">
            View all jobs →
          </a>
        </DashboardCard>

      </div>

      {/* Row 2 Grid: 5 Column Layout (Desktop side-by-side widgets) */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
        
        {/* Widget 1: Applications by Status (Donut Chart) */}
        <DashboardCard className="p-4 flex flex-col justify-between space-y-3 h-full">
          <h5 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Applications by Status
          </h5>
          <div className="h-32 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={applicationsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={45}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {applicationsData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={APPLICATIONS_COLORS[index % APPLICATIONS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-[9px] font-black text-slate-500">
            {applicationsData.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: APPLICATIONS_COLORS[idx] }} />
                  <span>{item.name}</span>
                </div>
                <span>{item.value.toLocaleString()} ({item.percent})</span>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Widget 2: Top Job Categories (Progress Indicators) */}
        <DashboardCard className="p-4 flex flex-col justify-between space-y-3 h-full">
          <h5 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Top Job Categories
          </h5>
          <div className="space-y-3.5">
            {categoriesData.map((cat, idx) => {
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
            })}
          </div>
        </DashboardCard>

        {/* Widget 3: Recent Activities Feed */}
        <DashboardCard className="p-4 flex flex-col justify-between space-y-3 h-full">
          <h5 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Recent Activities
          </h5>
          <div className="space-y-3">
            {(audits.length > 0 ? audits : [
              { title: "TechNova Solutions badge marked as Pending Review", actor: "by Admin User" },
              { title: "Bright Future Tech company approved", actor: "by Admin User" },
              { title: "Marketing Executive job reported", actor: "by System" },
              { title: "New user Anjali Verma registered", actor: "by System" },
            ]).map((item, idx) => (
              <div key={idx} className="text-[10px] leading-relaxed border-l-2 border-slate-150 pl-2 dark:border-slate-800">
                <p className="font-extrabold text-slate-800 dark:text-slate-200">
                  {item.title}
                </p>
                <span className="text-[9px] font-bold text-slate-450 dark:text-slate-500">
                  {item.actor}
                </span>
              </div>
            ))}
          </div>
          <a href="/admin/activity-logs" className="text-[9px] font-black text-[#6B2C91] dark:text-pink-300 hover:underline">
            View all activities →
          </a>
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
                {[
                  { name: "TechNova Solutions", status: "Pending Review", style: "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400", date: "10 May 2025" },
                  { name: "Bright Future Tech", status: "Pending Review", style: "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400", date: "09 May 2025" },
                  { name: "Digital Minds", status: "Not Claimed", style: "bg-slate-100 text-slate-655 dark:bg-slate-800 dark:text-slate-400", date: "09 May 2025" },
                  { name: "CodeCraft Solutions", status: "Approved", style: "bg-pink-100 text-pink-700 dark:bg-pink-950/20 dark:text-pink-300", date: "08 May 2025" },
                  { name: "InnovateX Pvt. Ltd.", status: "Approved", style: "bg-pink-100 text-pink-700 dark:bg-pink-950/20 dark:text-pink-300", date: "07 May 2025" },
                ].map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10">
                    <td className="py-1.5 font-extrabold text-slate-900 dark:text-white max-w-[80px] truncate">{item.name}</td>
                    <td className="py-1.5 px-1">
                      <span className={cn("text-[8px] font-black uppercase px-1 py-0.5 rounded", item.style)}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono text-slate-400">{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a href="/admin/company-details" className="text-[9px] font-black text-[#6B2C91] dark:text-pink-300 hover:underline">
            View all companies →
          </a>
        </DashboardCard>

        {/* Widget 5: User Growth Line Area Chart */}
        <DashboardCard className="p-4 flex flex-col justify-between space-y-3 h-full">
          <div>
            <h5 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">
              User Growth <span className="text-[8px] font-bold text-slate-450 uppercase">(This Week)</span>
            </h5>
            <div className="mt-1">
              <span className="text-lg font-black text-slate-900 dark:text-white">24,685</span>
              <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-450 flex items-center gap-0.5 mt-0.5">
                ↑ 15.2% <span className="font-semibold text-slate-405 dark:text-slate-500">from last week</span>
              </p>
            </div>
          </div>
          <div className="h-24 text-[8px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
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
