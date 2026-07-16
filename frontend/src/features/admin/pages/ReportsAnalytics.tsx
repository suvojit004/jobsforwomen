import { useState, useEffect } from "react"
import {
  Download,
  LineChart,
  FileSpreadsheet,
  FileText,
  TrendingUp,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import apiClient from "@/api/client"
import { AdminApi } from "../services/adminApi"

export function ReportsAnalytics() {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [exportError, setExportError] = useState("")

  // CONFIRMED BUG (fixed here): this chart used to render a hardcoded
  // 6-entry array (Jan-Jun with fixed numbers, never changing regardless of
  // real platform activity). It now loads GET /api/v1/admins/reports,
  // which computes a real last-6-months Applications-vs-Hired trend from
  // actual Application rows (see admin.service.ts's getReports).
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; applications: number; hired: number }[]>([])
  const [interviewRate, setInterviewRate] = useState<number | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  useEffect(() => {
    async function loadMetrics() {
      try {
        const data = await AdminApi.getReports()
        setMonthlyTrend(data?.monthlyTrend || [])
        setInterviewRate(typeof data?.applicationToInterviewRate === "number" ? data.applicationToInterviewRate : null)
      } catch (err) {
        console.error("Failed to load report metrics", err)
      } finally {
        setMetricsLoading(false)
      }
    }
    loadMetrics()
  }, [])

  // Calls the real GET /api/v1/admins/reports?type=...&export=csv endpoint,
  // which streams a CSV built from live database counts, and triggers an
  // actual browser download of the response bytes. Previously this just
  // faked a delay and popped an alert claiming a file had been "downloaded"
  // -- nothing was ever generated, fetched, or saved.
  const handleExport = async (type: string, fileName: string) => {
    setDownloading(fileName)
    setExportError("")
    try {
      const token = localStorage.getItem("jwt_token")
      const res = await fetch(
        `${apiClient.defaults.baseURL}/api/v1/admins/reports?type=${encodeURIComponent(type)}&export=csv`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: "include",
        }
      )
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`)
      }
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") || ""
      const match = disposition.match(/filename=([^;]+)/)
      const downloadName = match ? match[1].trim() : fileName

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = downloadName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Failed to generate report", err)
      setExportError(`Failed to generate "${fileName}". Please try again.`)
    } finally {
      setDownloading(null)
    }
  }

  const exportCards = [
    {
      title: "Candidates Directory",
      desc: "All registered candidate accounts, career breaks, profiles completion percentage, and skills.",
      fileName: "Candidates_Directory_Report.csv",
      type: "candidates",
      icon: FileSpreadsheet,
      format: "CSV File",
    },
    {
      title: "Employers & Recruiters",
      desc: "Recruiter profiles, associated companies, and equality perks validation statuses.",
      fileName: "Recruiters_Partner_Report.csv",
      type: "recruiters",
      icon: FileSpreadsheet,
      format: "CSV File",
    },
    {
      title: "Job Listings Audit",
      desc: "Active jobs postings, salaries, applications count, and reported status tags.",
      fileName: "JobListings_Platform_Report.csv",
      type: "jobs",
      icon: FileSpreadsheet,
      format: "CSV File",
    },
    {
      title: "Operational Analytics",
      desc: "Monthly application traffic, sourcing success indices, and system operation metrics summaries.",
      fileName: "JobsForWomen_System_Analytics.csv",
      type: "analytics",
      icon: FileText,
      format: "CSV File",
    },
  ]

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
          <LineChart className="size-6 text-[#6B2C91] dark:text-pink-300" />
          Reports & Sourcing Analytics
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Generate platform-wide activity logs, download candidate spreadsheet directories, and inspect metrics summaries.
        </p>
      </div>

      {/* Reports Stats & Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recharts applications/hires panel */}
        <DashboardCard className="p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white flex items-center gap-1.5">
              <TrendingUp className="size-4 text-[#6B2C91] dark:text-pink-300" />
              Sourcing & Hires Trends
            </h4>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">6 Month Window</span>
          </div>
          <div className="h-64 text-xs">
            {metricsLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading trend...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <Bar dataKey="applications" name="Applications" fill="#6B2C91" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="hired" name="Hired" fill="#EC4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </DashboardCard>

        {/* Mini stats breakdown */}
        <DashboardCard className="p-5 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white">
              Sourcing Index Metrics
            </h4>
          </div>
          <div className="space-y-4 py-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2 dark:border-slate-850">
              <span className="text-xs text-slate-500 font-semibold">Application to Interview Rate</span>
              <span className="text-sm font-black text-slate-900 dark:text-white">
                {interviewRate === null ? "—" : `${interviewRate}%`}
              </span>
            </div>
            {/* CONFIRMED BUG (fixed here): "Average Resume Verification
                Duration", "Menstrual Leave Perks Checked", and "Returnee
                Mentorship Ratio" used to be hardcoded literals
                ("4.2 Hours", "82 Companies", "3.8:1") that never changed --
                there is no timestamped resume-verification-duration field,
                company perk-checklist field, or returnee-mentorship field
                anywhere in the schema to compute them from. Rather than
                keep showing fabricated numbers, they're removed until
                there's real data to back them. */}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
              Additional sourcing metrics (resume verification duration, employer perk tracking, returnee mentorship
              ratio) require new data fields that don't exist in the platform yet and are not shown here rather than
              being fabricated.
            </p>
          </div>
          <div className="pt-2">
            <Button
              disabled
              title="Not yet implemented"
              className="w-full text-xs font-black bg-slate-200 text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500"
            >
              Generate Custom Audit Report (Coming Soon)
            </Button>
          </div>
        </DashboardCard>
      </div>

      {/* Export Cards Section */}
      <div>
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2.5 dark:border-slate-800">
          Data Export Directory
        </h4>
        {exportError && (
          <p className="mt-3 text-xs font-bold text-red-600 dark:text-red-400">{exportError}</p>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
          {exportCards.map((card) => {
            const isDownloading = downloading === card.fileName
            return (
              <DashboardCard
                key={card.fileName}
                className="p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase bg-slate-150 text-slate-700 dark:bg-slate-800 dark:text-slate-350 px-1.5 py-0.5 rounded">
                      {card.format}
                    </span>
                    <card.icon className="size-4 text-slate-400" />
                  </div>
                  <h5 className="text-xs font-black text-slate-900 dark:text-white">
                    {card.title}
                  </h5>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">
                    {card.desc}
                  </p>
                </div>
                <div>
                  <Button
                    onClick={() => handleExport(card.type, card.fileName)}
                    disabled={isDownloading}
                    className="w-full text-[10px] font-black flex items-center justify-center gap-1.5 h-8 bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-250/20 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-white dark:border-slate-800"
                  >
                    {isDownloading ? (
                      <>
                        <span className="size-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="size-3" />
                        Download Report
                      </>
                    )}
                  </Button>
                </div>
              </DashboardCard>
            )
          })}
        </div>
      </div>
    </div>
  )
}
export default ReportsAnalytics
