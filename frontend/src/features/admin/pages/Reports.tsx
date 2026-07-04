import { useState } from "react"
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

const monthlyReportsData = [
  { month: "Jan", Applications: 120, Hired: 18 },
  { month: "Feb", Applications: 190, Hired: 32 },
  { month: "Mar", Applications: 320, Hired: 45 },
  { month: "Apr", Applications: 480, Hired: 78 },
  { month: "May", Applications: 610, Hired: 92 },
  { month: "Jun", Applications: 780, Hired: 130 },
]

export function Reports() {
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleExport = (fileName: string) => {
    setDownloading(fileName)
    setTimeout(() => {
      // Simulate file download trigger
      setDownloading(null)
      alert(`Export completed! "${fileName}" has been downloaded.`)
    }, 1500)
  }

  const exportCards = [
    {
      title: "Candidates Directory",
      desc: "All registered candidate accounts, career breaks, profiles completion percentage, and skills.",
      fileName: "Candidates_Directory_Report.csv",
      icon: FileSpreadsheet,
      format: "CSV File",
    },
    {
      title: "Employers & Recruiters",
      desc: "Recruiter profiles, associated companies, and equality perks validation statuses.",
      fileName: "Recruiters_Partner_Report.csv",
      icon: FileSpreadsheet,
      format: "CSV File",
    },
    {
      title: "Job Listings Audit",
      desc: "Active jobs postings, salaries, applications count, and reported status tags.",
      fileName: "JobListings_Platform_Report.csv",
      icon: FileSpreadsheet,
      format: "CSV File",
    },
    {
      title: "Operational Analytics",
      desc: "Monthly application traffic, sourcing success indices, and system operation metrics summaries.",
      fileName: "JobsForWomen_System_Analytics.pdf",
      icon: FileText,
      format: "PDF Document",
    },
  ]

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
          <LineChart className="size-6 text-[#6B2C91] dark:text-pink-300" />
          Analytics & Exports
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Generate system performance summaries, download spreadsheets, and view sourcing analytics datasets.
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyReportsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                <Bar dataKey="Applications" fill="#6B2C91" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Hired" fill="#EC4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
              <span className="text-xs text-slate-500 font-semibold">Average Application to Interview</span>
              <span className="text-sm font-black text-slate-900 dark:text-white">24.5%</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-2 dark:border-slate-850">
              <span className="text-xs text-slate-500 font-semibold">Average Resume Verification Duration</span>
              <span className="text-sm font-black text-slate-900 dark:text-white">4.2 Hours</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-2 dark:border-slate-850">
              <span className="text-xs text-slate-500 font-semibold">Menstrual Leave Perks Checked</span>
              <span className="text-sm font-black text-slate-900 dark:text-white">82 Companies</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-semibold">Returnee Mentorship Ratio</span>
              <span className="text-sm font-black text-slate-900 dark:text-white">3.8:1</span>
            </div>
          </div>
          <div className="pt-2">
            <Button className="w-full text-xs font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-600 dark:hover:bg-pink-700">
              Generate Custom Audit Report
            </Button>
          </div>
        </DashboardCard>
      </div>

      {/* Export Cards Section */}
      <div>
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2.5 dark:border-slate-800">
          Data Export Directory
        </h4>
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
                    onClick={() => handleExport(card.fileName)}
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
export default Reports
