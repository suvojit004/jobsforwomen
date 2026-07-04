import { useState, useEffect } from "react"
import {
  Users,
  BriefcaseBusiness,
  Building,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
} from "lucide-react"
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import { AdminService } from "@/services/admin.service"

// Harmonized colors for the pie chart
const COLORS = ["#6B2C91", "#EC4899", "#3B82F6", "#10B981"]

const growthData = [
  { month: "Jan", Candidates: 400, Recruiters: 24 },
  { month: "Feb", Candidates: 600, Recruiters: 35 },
  { month: "Mar", Candidates: 800, Recruiters: 48 },
  { month: "Apr", Candidates: 1100, Recruiters: 62 },
  { month: "May", Candidates: 1250, Recruiters: 74 },
  { month: "Jun", Candidates: 1420, Recruiters: 85 },
]

const distributionData = [
  { name: "Candidates", value: 1420 },
  { name: "Recruiters", value: 85 },
  { name: "Administrators", value: 5 },
]

export function Dashboard() {
  const [metrics, setMetrics] = useState({
    totalCandidates: 0,
    totalRecruiters: 0,
    pendingVerifications: 0,
    reportedJobs: 0,
    activeListings: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const stats = await AdminService.getMetrics()
        setMetrics(stats)
      } catch (err) {
        console.error("Failed to load metrics:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const statCards = [
    {
      title: "Total Candidates",
      value: loading ? "..." : metrics.totalCandidates.toLocaleString(),
      change: "+15% this month",
      icon: Users,
      color: "text-purple-600 dark:text-pink-300",
      bg: "bg-purple-50 dark:bg-purple-950/20",
    },
    {
      title: "Registered Recruiters",
      value: loading ? "..." : metrics.totalRecruiters.toLocaleString(),
      change: "+8% this month",
      icon: Building,
      color: "text-pink-600 dark:text-pink-300",
      bg: "bg-pink-50 dark:bg-pink-950/20",
    },
    {
      title: "Active Job Opportunities",
      value: loading ? "..." : metrics.activeListings.toLocaleString(),
      change: "+22 new today",
      icon: BriefcaseBusiness,
      color: "text-blue-600 dark:text-blue-300",
      bg: "bg-blue-50 dark:bg-blue-950/20",
    },
    {
      title: "Pending Verifications",
      value: loading ? "..." : metrics.pendingVerifications.toLocaleString(),
      change: "Requires review",
      icon: ShieldCheck,
      color: "text-emerald-600 dark:text-emerald-300",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      alert: true,
    },
    {
      title: "Reported Postings",
      value: loading ? "..." : metrics.reportedJobs.toLocaleString(),
      change: "Urgent check",
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-300",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      alert: metrics.reportedJobs > 0,
    },
  ]

  const activities = [
    {
      id: "a-1",
      title: "Company Registered",
      desc: "InnoTech Corp submitted partner equality verification checklist.",
      time: "24 mins ago",
      type: "info",
    },
    {
      id: "a-2",
      title: "Job Flagged",
      desc: "Technical Writer posting at WriteAway was reported for incorrect tags.",
      time: "1 hour ago",
      type: "warning",
    },
    {
      id: "a-3",
      title: "Candidate Verified",
      desc: "Priya Sharma uploaded credentials successfully cleared auto-check.",
      time: "2 hours ago",
      type: "success",
    },
    {
      id: "a-4",
      title: "Settings Policy Updated",
      desc: "Admin modified WebSockets flag state to Disabled.",
      time: "1 day ago",
      type: "system",
    },
  ]

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Platform Operations Dashboard
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Platform-wide health metrics, user statistics, partnerships approvals, and reported posts queue.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card, idx) => (
          <DashboardCard key={idx} className="p-4 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-lg ${card.bg} ${card.color}`}>
                <card.icon className="size-4" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-950 dark:text-white">
                {card.value}
              </h3>
              <p className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                {card.alert && <span className="size-1.5 rounded-full bg-pink-500 shrink-0" />}
                {card.change}
              </p>
            </div>
          </DashboardCard>
        ))}
      </div>

      {/* Chart Panels */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Growth Area Chart */}
        <DashboardCard className="p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white flex items-center gap-1.5">
              <TrendingUp className="size-4 text-[#6B2C91] dark:text-pink-300" />
              Platform Growth Trends
            </h4>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">6 Month Interval</span>
          </div>
          <div className="h-64 text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCandidates" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6B2C91" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6B2C91" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRecruiters" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EC4899" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#EC4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-850" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Candidates"
                  stroke="#6B2C91"
                  fillOpacity={1}
                  fill="url(#colorCandidates)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Recruiters"
                  stroke="#EC4899"
                  fillOpacity={1}
                  fill="url(#colorRecruiters)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>

        {/* User Types Pie Chart */}
        <DashboardCard className="p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white">
              User Type Distribution
            </h4>
          </div>
          <div className="h-64 flex flex-col justify-center items-center relative">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {distributionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} users`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[10px] font-bold text-slate-500">
              {distributionData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <span className="size-2 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                  <span>{item.name} ({item.value})</span>
                </div>
              ))}
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* Bottom split: recents + action links */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Platform activity */}
        <DashboardCard className="p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white">
              Recent Platform Operations Logs
            </h4>
            <Button variant="link" className="text-[10px] text-[#6B2C91] dark:text-pink-300 p-0 h-auto font-bold">
              View All Logs
            </Button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-850">
            {activities.map((item) => (
              <div key={item.id} className="py-3 flex items-start justify-between gap-4 first:pt-0 last:pb-0">
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-slate-850 dark:text-white">
                    {item.title}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {item.desc}
                  </p>
                </div>
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 shrink-0">
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Verification cues */}
        <DashboardCard className="p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white">
              Pending Partnerships Queue
            </h4>
          </div>
          <div className="space-y-3">
            <div className="p-3 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-950 dark:text-white">TechNova solutions</span>
                <span className="text-[9px] font-extrabold bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded dark:bg-pink-900/35 dark:text-pink-300">
                  Champion Badge
                </span>
              </div>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">
                Partner claims verification of Paid Menstrual Leave rest policy.
              </p>
              <div className="flex gap-2 justify-end pt-1">
                <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold">
                  Inspect
                </Button>
                <Button size="sm" className="h-7 text-[10px] font-bold bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-600 dark:hover:bg-pink-700">
                  Verify
                </Button>
              </div>
            </div>
            <div className="p-3 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-950 dark:text-white">Creative Minds</span>
                <span className="text-[9px] font-extrabold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded dark:bg-blue-900/35 dark:text-blue-300">
                  Returnship Partner
                </span>
              </div>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">
                Submitting onboarding mentorship checklist for returnees.
              </p>
              <div className="flex gap-2 justify-end pt-1">
                <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold">
                  Inspect
                </Button>
                <Button size="sm" className="h-7 text-[10px] font-bold bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-600 dark:hover:bg-pink-700">
                  Verify
                </Button>
              </div>
            </div>
          </div>
        </DashboardCard>
      </div>
    </div>
  )
}
export default Dashboard
