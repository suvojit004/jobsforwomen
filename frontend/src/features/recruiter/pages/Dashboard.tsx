import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Link, useNavigate } from "react-router-dom"
import { RecruiterApi } from "../services/recruiterApi"
import {
  Briefcase,
  Users,
  Award,
  Calendar,
  ArrowUpRight,
  Plus,
  Edit2,
  CheckCircle,
  TrendingUp,
  Heart,
  Globe,
  PlusCircle,
  ClipboardCheck,
  Bell,
  Building2,
} from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { DataTable, type ColumnDef } from "@/components/shared/DataTable"
import { cn } from "@/lib/utils"

// Job postings data interface
interface JobPosting {
  id: string
  title: string
  workMode: "Remote" | "Hybrid" | "On-site"
  applicants: number
  status: "Active" | "Paused" | "Closed"
  postedOn: string
}

// Recent applicant data interface
interface RecentApplicant {
  id: string
  name: string
  role: string
  appliedOn: string
  avatarLetters: string
}

// Accessible status colors -- consistent with the palette used on
// the Perks and Approval Requests pages: Pending Blue, Approved Green,
// Rejected Red/Pink, More Info Purple/Indigo.
function verificationStatusStyle(status?: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
    case "info_requested":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
    case "rejected":
      return "bg-pink-100 text-pink-800 dark:bg-pink-950/30 dark:text-pink-300"
    default:
      return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
  }
}

function verificationStatusLabel(status?: string) {
  if (!status) return "Unknown"
  if (status === "info_requested") return "More Info Required"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function Dashboard() {
  const navigate = useNavigate()

  const [company, setCompany] = useState<any>(null)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([])
  const [recentApplicants, setRecentApplicants] = useState<RecentApplicant[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [dash, jobsList, appsList] = await Promise.all([
          RecruiterApi.getDashboard(),
          RecruiterApi.getJobs(),
          RecruiterApi.getApplicants(),
        ])

        setDashboardData(dash)

        setJobPostings((jobsList || []).map((j: any) => ({
          id: j.id,
          title: j.title,
          workMode: j.workMode,
          applicants: j.applicants || 0,
          status: j.status === "approved" ? "Active" : j.status === "paused" ? "Paused" : "Closed",
          postedOn: j.postedOn || "Today"
        })))

        setRecentApplicants((appsList || []).slice(0, 5).map((a: any) => ({
          id: a.id,
          name: a.name,
          role: a.job,
          appliedOn: a.appliedDate,
          avatarLetters: a.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
        })))

        const comp = dash?.company
        if (comp) {
          // Perks now live in CompanyPerkRequest (Parts 6/7 of the spec),
          // reviewed independently per-perk by an admin -- the old
          // CompanyBenefit boolean list is superseded and no longer written
          // to. "Menstrual Leave Champion" is derived from the matching
          // perk request's real status rather than a field that was never
          // actually set ("Menstrual Leave Champion" was never the string
          // written by the claim UI, which wrote "Menstrual Leave Support" --
          // so this card was permanently stuck showing "Inactive" before).
          const perkRequests = (comp.perkRequests || []) as Array<{ perkName: string; status: string }>
          const championRequest = perkRequests.find((p) => p.perkName === "Menstrual Leave Champion")
          setCompany({
            name: comp.name || "Unnamed Company",
            website: comp.website || "Not specified",
            description: comp.description || "No description set yet.",
            menstrualLeaveChampion: championRequest?.status === "approved",
            perkRequests,
          })
        } else {
          // Honest empty state -- no company record found for this recruiter
          // profile. Previously this branch fabricated a fake "TechNova
          // Solutions" company and displayed it as if it were real, on every
          // single dashboard load (the backend never actually sent a
          // `company` field before this fix, so this branch always ran).
          setCompany(null)
        }
      } catch (err: any) {
        console.error("Failed to load recruiter dashboard", err)
        toast.error(err?.message || "Failed to load dashboard data.")
      } finally {
        setIsLoading(false)
      }
    }
    loadDashboard()
  }, [])

  const stats = [
    {
      label: "Active Jobs",
      value: String(dashboardData?.jobStatistics?.approved || 0),
      change: "+20%",
      subtext: "from last week",
      icon: Briefcase,
      color: "text-purple-600 dark:text-pink-300",
      bg: "bg-purple-50 dark:bg-purple-950/30",
    },
    {
      label: "Total Applicants",
      value: String(dashboardData?.applicantStatistics?.total || 0),
      change: "+18%",
      subtext: "from last week",
      icon: Users,
      color: "text-pink-600 dark:text-pink-400",
      bg: "bg-pink-50 dark:bg-pink-950/30",
    },
    {
      label: "Shortlisted",
      value: String(dashboardData?.applicantStatistics?.shortlisted || 0),
      change: "+12%",
      subtext: "from last week",
      icon: Award,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "Interviews",
      value: String(dashboardData?.applicantStatistics?.interviewScheduled || 0),
      change: "+25%",
      subtext: "from last week",
      icon: Calendar,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
  ]



  // Real 7-day application trend from the backend (Application rows grouped
  // by day, computed in RecruiterService.getDashboard). Empty until the
  // company has real application activity -- never backfilled with fake numbers.
  const chartData = dashboardData?.applicationTrend || []

  // Reusable columns definition for My Job Postings DataTable
  const columns: ColumnDef<JobPosting>[] = [
    {
      header: "Job Title",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="font-extrabold text-slate-900 dark:text-white hover:text-[#6B2C91] transition-colors">
            <Link to={`/recruiter/jobs/${row.id}`}>{row.title}</Link>
          </p>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
            {row.workMode}
          </span>
        </div>
      ),
    },
    {
      header: "Applicants",
      cell: (row) => (
        <span className="font-extrabold text-slate-700 dark:text-slate-300">
          {String(row.applicants).padStart(2, "0")}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (row) => {
        // Reuse status tag styles or render inline styles to match approved design
        const statusMap = {
          Active: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
          Paused: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300",
          Closed: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400",
        }
        return (
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-md px-2 text-[10px] font-bold ring-1 ring-inset",
              statusMap[row.status]
            )}
          >
            {row.status}
          </span>
        )
      },
    },
    {
      header: "Posted On",
      accessorKey: "postedOn",
      className: "hidden sm:table-cell",
    },
  ]

  const handleRowClick = (row: JobPosting) => {
    navigate(`/recruiter/jobs/${row.id}`)
  }

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      {/* Greet & Header */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Welcome back{company?.name ? `, ${company.name}` : ""}! 👋
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Here's what's happening with your jobs today.
        </p>
      </div>

      {/* Approval & Profile Status Card -- surfaces data the
          backend has always computed (profileCompletion, verificationStatus,
          perkSummary, unread notifications count) but which the dashboard
          never actually rendered anywhere. */}
      <DashboardCard className="p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
          <button
            type="button"
            onClick={() => navigate("/recruiter/approvals")}
            className="flex items-center justify-between gap-2 pb-3 sm:pb-0 sm:pr-4 text-left cursor-pointer"
          >
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Company Registration</p>
              <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase", verificationStatusStyle(dashboardData?.verificationStatus))}>
                {verificationStatusLabel(dashboardData?.verificationStatus)}
              </span>
            </div>
            <ClipboardCheck className="size-5 text-[#6B2C91] dark:text-pink-300 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => navigate("/recruiter/company")}
            className="flex items-center justify-between gap-2 py-3 sm:py-0 sm:px-4 text-left cursor-pointer"
          >
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Profile Completion</p>
              <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                {dashboardData?.profileCompletion ?? 0}%
              </p>
            </div>
            <Building2 className="size-5 text-[#6B2C91] dark:text-pink-300 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => navigate("/recruiter/perks")}
            className="flex items-center justify-between gap-2 py-3 sm:py-0 sm:px-4 text-left cursor-pointer"
          >
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Perks Verified</p>
              <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                {dashboardData?.perkSummary?.approved ?? 0}
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500"> / {dashboardData?.perkSummary?.total ?? 0}</span>
              </p>
            </div>
            <Award className="size-5 text-[#6B2C91] dark:text-pink-300 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => navigate("/recruiter/notifications")}
            className="flex items-center justify-between gap-2 pt-3 sm:pt-0 sm:pl-4 text-left cursor-pointer"
          >
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Unread Notifications</p>
              <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                {dashboardData?.notificationsSummary?.unreadCount ?? 0}
              </p>
            </div>
            <Bell className="size-5 text-[#6B2C91] dark:text-pink-300 shrink-0" />
          </button>
        </div>
      </DashboardCard>

      {/* Stats Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <DashboardCard key={stat.label} className="p-4 flex items-center justify-between select-none">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                  {stat.label}
                </span>
                <p className="text-2xl font-black text-slate-950 dark:text-white">
                  {stat.value}
                </p>
                <div className="flex items-center gap-1 text-[10px] font-bold">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center">
                    <TrendingUp className="size-3 mr-0.5" />
                    {stat.change}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">
                    {stat.subtext}
                  </span>
                </div>
              </div>
              <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", stat.bg)}>
                <Icon className={cn("size-5.5", stat.color)} />
              </div>
            </DashboardCard>
          )
        })}
      </div>

      {/* Main Workspace Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Job Postings & Stats Line Graph */}
        <div className="lg:col-span-8 space-y-6">
          {/* My Job Postings */}
          <DashboardCard className="p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
              <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
                My Job Postings
              </h2>
              <Link
                to="/recruiter/manage-jobs"
                className="inline-flex items-center gap-0.5 text-xs font-bold text-[#6B2C91] hover:underline dark:text-pink-200"
              >
                View all jobs
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>

            <DataTable
              columns={columns}
              data={jobPostings}
              onRowClick={handleRowClick}
              emptyMessage="No job postings created yet."
            />

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                onClick={() => navigate("/recruiter/post-job")}
                className="w-full sm:w-auto bg-[#6B2C91] text-white hover:bg-[#5a237b] h-9 px-4 font-extrabold text-xs gap-1.5 cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700"
              >
                <Plus className="size-4" />
                Post a New Job
              </Button>
            </div>
          </DashboardCard>

          {/* Applicants Overview Chart */}
          <DashboardCard className="p-5">
            <div className="mb-4">
              <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
                Applicants Overview
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Overview of recruitment funnel conversions (6 May - 12 May).
              </p>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #E2E8F0",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={7} wrapperStyle={{ fontSize: "11px" }} />
                  <Line type="monotone" dataKey="Applied" stroke="#6B2C91" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Shortlisted" stroke="#EC4899" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="Interviewing" stroke="#10B981" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="Offered" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>
        </div>

        {/* Right Column: Company Perks, Recruiter Profile & Recent Logs */}
        <div className="lg:col-span-4 space-y-6">
          {!company ? (
            <DashboardCard className="p-5 space-y-3 text-center">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                No company profile found for your account yet.
              </p>
              <Button
                onClick={() => navigate("/recruiter/company")}
                className="bg-[#6B2C91] hover:bg-[#5a237b] text-white font-extrabold text-xs h-9 dark:bg-pink-600 dark:hover:bg-pink-700"
              >
                Complete Company Profile
              </Button>
            </DashboardCard>
          ) : (
          <>
          {/* Company Profile Widget */}
          <DashboardCard className="p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-full bg-violet-100 text-[#6B2C91] flex items-center justify-center font-black text-sm shrink-0 dark:bg-violet-900/30 dark:text-pink-100">
                  {company.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-950 dark:text-white">
                    {company.name}
                  </h3>
                  <a
                    href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-semibold text-slate-400 hover:text-[#6B2C91] dark:text-slate-500 dark:hover:text-pink-300 flex items-center gap-1"
                  >
                    <Globe className="size-3" />
                    {company.website}
                  </a>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => navigate("/recruiter/company")}
                className="h-7 w-7 text-slate-400 hover:text-[#6B2C91] dark:hover:text-white"
                size="icon"
                aria-label="Edit Profile"
              >
                <Edit2 className="size-3.5" />
              </Button>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              {company.description}
            </p>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Menstrual Leave Champion status card -- read-only. Verification
                is an admin-gated action on CompanyPerkRequest, so this can
                no longer be flipped client-side with no persistence; it just
                reflects real status and links to the Perks page where it's
                actually claimed and tracked. */}
            <div className="bg-gradient-to-br from-violet-50/50 to-pink-50/50 p-3.5 rounded-xl border border-violet-100 dark:from-violet-500/10 dark:to-pink-500/5 dark:border-violet-400/20">
              <div className="flex items-start justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Heart className="size-3.5 text-pink-500 fill-pink-500" />
                    <p className="text-xs font-black text-slate-900 dark:text-white">
                      Menstrual Leave Champion
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal dark:text-slate-400">
                    {company.menstrualLeaveChampion
                      ? "Verified Menstrual Leave Champion. Shown to candidates on your job listings."
                      : "Claim this perk and submit proof for admin verification on the Perks page."}
                  </p>
                </div>
                {company.menstrualLeaveChampion ? (
                  <span className="rounded-md px-2 py-1 text-[9px] font-black uppercase shrink-0 bg-emerald-500 text-white">
                    Active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate("/recruiter/perks")}
                    className="rounded-md px-2 py-1 text-[9px] font-black uppercase shrink-0 cursor-pointer bg-slate-200 text-slate-500 hover:bg-slate-350 dark:bg-slate-800 dark:text-slate-400"
                  >
                    Inactive
                  </button>
                )}
              </div>
            </div>
          </DashboardCard>

          {/* Company Perks */}
          <DashboardCard className="p-5 space-y-3.5">
            <h3 className="text-xs font-black text-slate-950 dark:text-white">
              Company Perks & Certifications
            </h3>
            {company.perkRequests.length === 0 ? (
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                No perks claimed yet.
              </p>
            ) : (
            <ul className="space-y-2.5">
              {company.perkRequests.map((perk: { perkName: string; status: string }, idx: number) => (
                <li key={idx} className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 animate-fadeIn">
                  <span className="flex items-center gap-2 min-w-0">
                    <CheckCircle className={cn("size-4 shrink-0", perk.status === "approved" ? "text-emerald-500" : "text-slate-300 dark:text-slate-600")} />
                    <span className="truncate">{perk.perkName}</span>
                  </span>
                  <span className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase",
                    perk.status === "approved" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
                    perk.status === "pending" && "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
                    perk.status === "info_requested" && "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300",
                    perk.status === "rejected" && "bg-pink-100 text-pink-800 dark:bg-pink-950/30 dark:text-pink-300",
                  )}>
                    {perk.status === "info_requested" ? "More Info" : perk.status}
                  </span>
                </li>
              ))}
            </ul>
            )}
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => navigate("/recruiter/perks")}
                className="w-full h-8 text-[11px] font-bold border-slate-200 dark:border-slate-800 gap-1"
              >
                <PlusCircle className="size-3.5" />
                Manage Perks
              </Button>
            </div>
          </DashboardCard>
          </>
          )}

          {/* Recent Applicants */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-950 dark:text-white">
                Recent Applicants
              </h3>
              <Link
                to="/recruiter/applicants"
                className="text-[11px] font-bold text-[#6B2C91] hover:underline dark:text-pink-200"
              >
                View all
              </Link>
            </div>

            <div className="space-y-3">
              {recentApplicants.map((app) => (
                <DashboardCard key={app.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-xs shrink-0 dark:bg-pink-900/20 dark:text-pink-200">
                      {app.avatarLetters}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-950 truncate dark:text-white">
                        {app.name}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400 truncate dark:text-slate-500">
                        {app.role} · Applied {app.appliedOn}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate(`/recruiter/applicants/${app.id}`)}
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] font-extrabold text-[#6B2C91] dark:text-pink-200 px-2.5 shrink-0"
                  >
                    View Profile
                  </Button>
                </DashboardCard>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Menstrual Leave Champion Banner -- previously rendered
          unconditionally claiming "Your company IS listed as a Menstrual
          Leave Champion" for every recruiter regardless of actual
          verification status. Now honestly reflects company.menstrualLeaveChampion
          (derived from the real, admin-reviewed CompanyPerkRequest status)
          and prompts recruiters who haven't claimed/been approved yet to do
          so via the Perks page, instead of asserting a false badge state. */}
      {company && (
        <DashboardCard className="p-5 border-[#6B2C91]/30 bg-gradient-to-r from-violet-50/50 via-white to-pink-50/50 dark:from-violet-950/20 dark:via-slate-900 dark:to-pink-950/15 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
          <div className="flex items-start gap-4">
            <div className="size-11 rounded-full bg-violet-100 text-[#6B2C91] flex items-center justify-center shrink-0 dark:bg-violet-900/30 dark:text-pink-100">
              <Heart className="size-5 text-pink-500 fill-pink-500" />
            </div>
            <div className="space-y-1 max-w-xl">
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                Menstrual Leave Champion — Premium Partner
                <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[9px] font-black text-pink-700 dark:bg-pink-950/40 dark:text-pink-200">
                  Premium
                </span>
              </h4>
              <p className="text-xs leading-5 text-slate-600 dark:text-slate-350">
                {company.menstrualLeaveChampion
                  ? "Your company is a verified Menstrual Leave Champion. This badge is displayed on your recruiter posts, search indexes, and company cards to attract top progressive talent."
                  : "Claim the Menstrual Leave Champion badge and submit proof for admin verification to display it on your job listings and attract top progressive talent."}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <Button
              onClick={() => navigate("/recruiter/perks")}
              className="bg-[#6B2C91] text-white hover:bg-[#5a237b] h-9 px-5 font-extrabold text-xs cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700"
            >
              {company.menstrualLeaveChampion ? "View Badge" : "Claim Badge"}
            </Button>
          </div>
        </DashboardCard>
      )}
    </div>
  )
}
