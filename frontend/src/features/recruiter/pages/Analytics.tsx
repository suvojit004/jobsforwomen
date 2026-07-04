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
} from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"

// KPI Data Mock
const kpiStats = [
  {
    label: "Active Postings",
    value: "12",
    icon: Briefcase,
    color: "text-purple-600 dark:text-pink-300",
    bg: "bg-purple-50 dark:bg-purple-950/30",
  },
  {
    label: "Total Applicants",
    value: "48",
    icon: Users,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-950/30",
  },
  {
    label: "Interviews Scheduled",
    value: "18",
    icon: CalendarCheck2,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    label: "Offers Extended",
    value: "06",
    icon: FileCheck2,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
]

// Conversions data (Applied -> Shortlisted -> Interview -> Selected)
const conversionData = [
  { stage: "Applied", Candidates: 48, fill: "#8884d8" },
  { stage: "Shortlisted", Candidates: 28, fill: "#83a6ed" },
  { stage: "Interviews", Candidates: 18, fill: "#8dd1e1" },
  { stage: "Offers", Candidates: 6, fill: "#82ca9d" },
]

// Trend Data (Jan to May 2025)
const trendData = [
  { month: "Jan", Applications: 12, Shortlisted: 6 },
  { month: "Feb", Applications: 18, Shortlisted: 10 },
  { month: "Mar", Applications: 25, Shortlisted: 14 },
  { month: "Apr", Applications: 38, Shortlisted: 22 },
  { month: "May", Applications: 48, Shortlisted: 28 },
]

// Work Mode Split
const workModeData = [
  { name: "Remote", value: 24, color: "#8b5cf6" }, // Purple
  { name: "Hybrid", value: 16, color: "#ec4899" }, // Pink
  { name: "On-site", value: 8, color: "#10b981" }, // Emerald
]

export function Analytics() {
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
              Monthly Sourcing Trend
            </h3>
            <span className="text-[10px] font-bold text-slate-400">Jan - May 2025</span>
          </div>

          <div className="h-64 w-full">
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
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conversionData} margin={{ left: -15, right: 10, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                <XAxis dataKey="stage" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
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
                  {item.value} ({Math.round((item.value / 48) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* DEI & Returnship Metrics Card */}
        <DashboardCard className="p-5 space-y-4 md:col-span-2">
          <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="size-4 text-pink-500" />
            DEI & Returnee Pipelines Highlights
          </h3>

          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <div className="bg-[#6B2C91]/5 dark:bg-purple-950/10 border border-[#6B2C91]/10 rounded-xl p-4 space-y-1">
              <p className="text-[10px] font-black uppercase text-[#6B2C91] dark:text-pink-300">Diversity Index</p>
              <p className="text-3xl font-black text-slate-950 dark:text-white">100%</p>
              <p className="text-[10px] text-slate-400">All candidate records represent women specialists</p>
            </div>

            <div className="bg-pink-500/5 border border-pink-500/10 rounded-xl p-4 space-y-1">
              <p className="text-[10px] font-black uppercase text-pink-500 dark:text-pink-400">Returnee Resume Intake</p>
              <p className="text-3xl font-black text-slate-950 dark:text-white">64%</p>
              <p className="text-[10px] text-slate-400">Candidates with active returnship career breaks</p>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 space-y-1">
              <p className="text-[10px] font-black uppercase text-emerald-500 dark:text-emerald-400">Average Sabbatical Interval</p>
              <p className="text-3xl font-black text-slate-950 dark:text-white">1.2 Yrs</p>
              <p className="text-[10px] text-slate-400">Average career gap duration for applicant returnees</p>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 space-y-1">
              <p className="text-[10px] font-black uppercase text-amber-500 dark:text-amber-400">Time-To-Hire Average</p>
              <p className="text-3xl font-black text-slate-950 dark:text-white">18 Days</p>
              <p className="text-[10px] text-slate-400">12% faster than default industrial average rates</p>
            </div>
          </div>
        </DashboardCard>
      </div>
    </div>
  )
}
export default Analytics
