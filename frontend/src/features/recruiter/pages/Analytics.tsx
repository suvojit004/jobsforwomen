import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Legend,
} from "recharts"
import {
  TrendingUp,
  Users,
  Briefcase,
  FileCheck2,
  CalendarCheck2,
  PieChartIcon,
  Building2,
} from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { RecruiterApi } from "../services/recruiterApi"

const WORK_MODE_LABELS: Record<string, string> = {
  Remote: "Remote",
  Hybrid: "Hybrid",
  On_site: "On-site",
}

const WORK_MODE_COLORS: Record<string, string> = {
  Remote: "#8b5cf6",
  Hybrid: "#ec4899",
  On_site: "#10b981",
}

export function Analytics() {
  const [isLoading, setIsLoading] = useState(true)
  const [kpiStats, setKpiStats] = useState<
    { label: string; value: string; icon: any; color: string; bg: string }[]
  >([])
  const [conversionData, setConversionData] = useState<{ stage: string; Candidates: number }[]>([])
  const [trendData, setTrendData] = useState<{ month: string; Applications: number; Shortlisted: number }[]>([])
  const [workModeData, setWorkModeData] = useState<{ name: string; value: number; color: string }[]>([])
  const [departmentDistribution, setDepartmentDistribution] = useState<{ department: string; jobCount: number }[]>([])

  useEffect(() => {
    // Previously this entire page was a static mock -- every recruiter saw
    // the same "12 active postings / 48 applicants / 18 interviews" numbers
    // and a fabricated Jan-May 2025 trend, regardless of their real company's
    // data, even though a fully working /recruiters/analytics endpoint
    // already existed and was never called from here.
    async function loadAnalytics() {
      try {
        const [analytics, dashboard] = await Promise.all([
          RecruiterApi.getAnalytics(),
          RecruiterApi.getDashboard(),
        ])

        const jobsPerformance: any[] = analytics?.jobsPerformance || []
        const funnel: { stage: string; count: number }[] = analytics?.applicationFunnel || []
        const workModeDistribution: { workMode: string; count: number }[] = analytics?.workModeDistribution || []
        const applicationTrend: any[] = dashboard?.applicationTrend || []

        const funnelMap: Record<string, number> = {}
        funnel.forEach((f) => {
          funnelMap[f.stage] = f.count
        })
        const countOf = (...stages: string[]) => stages.reduce((sum, s) => sum + (funnelMap[s] || 0), 0)

        const totalApplicants = Object.values(funnelMap).reduce((a, b) => a + b, 0)
        const activePostings = jobsPerformance.filter((j) => j.status === "approved").length
        const interviewsScheduled = countOf("InterviewScheduled", "OfferReleased", "Hired")
        const offersExtended = countOf("OfferReleased", "Hired")

        setKpiStats([
          {
            label: "Active Postings",
            value: String(activePostings),
            icon: Briefcase,
            color: "text-purple-600 dark:text-pink-300",
            bg: "bg-purple-50 dark:bg-purple-950/30",
          },
          {
            label: "Total Applicants",
            value: String(totalApplicants),
            icon: Users,
            color: "text-pink-600 dark:text-pink-400",
            bg: "bg-pink-50 dark:bg-pink-950/30",
          },
          {
            label: "Interviews Scheduled",
            value: String(interviewsScheduled),
            icon: CalendarCheck2,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-950/30",
          },
          {
            label: "Offers Extended",
            value: String(offersExtended),
            icon: FileCheck2,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-50 dark:bg-amber-950/30",
          },
        ])

        // Cumulative funnel view (each stage includes everyone who has
        // reached at least that far), matching the same cumulative logic
        // the dashboard's applicationTrend already uses server-side.
        setConversionData([
          { stage: "Applied", Candidates: totalApplicants },
          { stage: "Shortlisted", Candidates: countOf("Shortlisted", "InterviewScheduled", "OfferReleased", "Hired") },
          { stage: "Interviews", Candidates: countOf("InterviewScheduled", "OfferReleased", "Hired") },
          { stage: "Offers", Candidates: countOf("OfferReleased", "Hired") },
        ])

        setTrendData(
          applicationTrend.map((d: any) => ({
            month: d.name,
            Applications: d.Applied || 0,
            Shortlisted: d.Shortlisted || 0,
          }))
        )

        setWorkModeData(
          workModeDistribution.map((w) => ({
            name: WORK_MODE_LABELS[w.workMode] || w.workMode,
            value: w.count,
            color: WORK_MODE_COLORS[w.workMode] || "#94a3b8",
          }))
        )

        setDepartmentDistribution(analytics?.departmentDistribution || [])
      } catch (err: any) {
        console.error("Failed to load recruiter analytics", err)
        toast.error(err?.message || "Failed to load analytics.")
      } finally {
        setIsLoading(false)
      }
    }
    loadAnalytics()
  }, [])

  const workModeTotal = workModeData.reduce((sum, w) => sum + w.value, 0)

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading analytics...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Recruiting Analytics
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Monitor application funnels, candidate sourcing models, and recruitment metrics.
        </p>
      </div>

      {/* Top row: KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiStats.map((stat, idx) => {
          const Icon = stat.icon
          return (
            <DashboardCard key={idx} className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                  {stat.label}
                </p>
                <p className="text-2xl font-black text-slate-950 dark:text-white">
                  {stat.value}
                </p>
              </div>
              <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color} shrink-0`}>
                <Icon className="size-5" />
              </div>
            </DashboardCard>
          )
        })}
      </div>

      {/* Middle row: Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Applications Trend Area Chart */}
        <DashboardCard className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="size-4 text-[#6B2C91]" />
              Application Sourcing Trend
            </h3>
            <span className="text-[10px] font-bold text-slate-400">Last 7 days</span>
          </div>

          <div className="h-64 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: -15, right: 10, top: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6B2C91" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6B2C91" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorShortlisted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EC4899" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#EC4899" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="month" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #E2E8F0",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "11px" }} />
                  <Area
                    type="monotone"
                    dataKey="Applications"
                    stroke="#6B2C91"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorApplications)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Shortlisted"
                    stroke="#EC4899"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorShortlisted)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-semibold text-slate-400">
                No application activity in the last 7 days.
              </div>
            )}
          </div>
        </DashboardCard>

        {/* Application Conversion Funnel BarChart */}
        <DashboardCard className="p-5 space-y-4">
          <div>
            <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Users className="size-4 text-pink-500" />
              Recruitment Conversion Funnel
            </h3>
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
              Track conversion ratios at each recruiting stage.
            </p>
          </div>

          <div className="h-64 w-full">
            {conversionData.some((c) => c.Candidates > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionData} margin={{ left: -15, right: 10, top: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="stage" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #E2E8F0",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                    cursor={{ fill: "rgba(107, 44, 145, 0.05)" }}
                  />
                  <Bar dataKey="Candidates" radius={[4, 4, 0, 0]} barSize={28}>
                    {conversionData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? "#6B2C91" : index === 1 ? "#EC4899" : index === 2 ? "#10B981" : "#F59E0B"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-semibold text-slate-400">
                No applications received yet.
              </div>
            )}
          </div>
        </DashboardCard>
      </div>

      {/* Bottom Row: Sourcing split */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Work Mode distribution PieChart */}
        <DashboardCard className="p-5 space-y-4 md:col-span-1">
          <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <PieChartIcon className="size-4 text-emerald-500" />
            Work Mode Split
          </h3>

          {workModeData.length > 0 ? (
            <>
              <div className="h-44 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={workModeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {workModeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5">
                {workModeData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="text-slate-900 dark:text-white font-bold">
                      {item.value} ({workModeTotal > 0 ? Math.round((item.value / workModeTotal) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-xs font-semibold text-slate-400">
              Post a job to see your work-mode split.
            </div>
          )}
        </DashboardCard>

        {/* Department Distribution Card (real data) */}
        <DashboardCard className="p-5 space-y-4 md:col-span-2">
          <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="size-4 text-pink-500" />
            Postings by Department
          </h3>

          {departmentDistribution.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {departmentDistribution.map((dept, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-xl p-4 flex items-center justify-between"
                >
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200">{dept.department}</p>
                  <p className="text-lg font-black text-[#6B2C91] dark:text-pink-300">{dept.jobCount}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-xs font-semibold text-slate-400">
              No job postings yet to break down by department.
            </div>
          )}
        </DashboardCard>
      </div>
    </div>
  )
}
export default Analytics
