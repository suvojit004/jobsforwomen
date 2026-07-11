import { useState, useEffect } from "react"
import { Search, FileText } from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import type { ColumnDef } from "@/components/shared/DataTable"
import { Input } from "@/components/ui/input"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import { AdminApi } from "../services/adminApi"

interface AdminAuditLog {
  id: string
  timestamp: string
  operator: string
  category: string
  action: string
  ipAddress: string
}

export function ActivityLogs() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("All")
  const [loading, setLoading] = useState(true)

  const loadLogs = async () => {
    try {
      setLoading(true)
      const data = await AdminApi.getAudits()
      
      const formattedLogs: AdminAuditLog[] = (data || []).map((a: any) => ({
        id: a.id,
        timestamp: a.createdAt ? new Date(a.createdAt).toLocaleString() : "Just now",
        operator: `Admin (${a.actorId || "System"})`,
        category: a.category === "RECRUITER" ? "Corporate Perks" : a.category === "JOB" ? "Job Moderation" : "User Management",
        action: `${a.action.replace(/_/g, " ")} on ${a.entity}`,
        ipAddress: a.ipAddress || "127.0.0.1"
      }))

      setLogs(formattedLogs)
    } catch (err) {
      console.error("Failed to fetch audit trails:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const categories = [
    "All",
    "User Management",
    "Job Moderation",
    "Corporate Perks",
    "Feature Flags",
    "Security Settings",
  ]

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.ipAddress.includes(searchQuery)

    const matchesCategory =
      activeCategory === "All" || log.category === activeCategory

    return matchesSearch && matchesCategory
  })

  const columns: ColumnDef<AdminAuditLog>[] = [
    {
      header: "Timestamp",
      cell: (row) => (
        <span className="text-[11px] font-mono font-bold text-slate-500">
          {row.timestamp}
        </span>
      ),
    },
    {
      header: "Operator",
      accessorKey: "operator",
    },
    {
      header: "Event Category",
      cell: (row) => {
        let tagColor = ""
        switch (row.category) {
          case "User Management":
            tagColor = "bg-purple-100/60 text-purple-800 dark:bg-purple-950/20 dark:text-purple-300 border border-purple-200/20"
            break
          case "Job Moderation":
            tagColor = "bg-amber-100/60 text-amber-800 dark:bg-amber-955/20 dark:text-amber-300 border border-amber-200/20"
            break
          case "Corporate Perks":
            tagColor = "bg-pink-100/60 text-pink-800 dark:bg-pink-955/20 dark:text-pink-300 border border-pink-200/20"
            break
          case "Feature Flags":
            tagColor = "bg-blue-100/60 text-blue-800 dark:bg-blue-955/20 dark:text-blue-300 border border-blue-200/20"
            break
          case "Security Settings":
            tagColor = "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-955/20 dark:text-emerald-300 border border-emerald-200/20"
            break
        }
        return (
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${tagColor}`}>
            {row.category}
          </span>
        )
      },
    },
    {
      header: "Action Taken",
      cell: (row) => (
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-normal block max-w-lg">
          {row.action}
        </span>
      ),
    },
    {
      header: "IP Address",
      cell: (row) => (
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-semibold">
          {row.ipAddress}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
          <FileText className="size-6 text-[#6B2C91] dark:text-pink-300" />
          Platform Activity Logs
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Traceable, audit logs of moderator operations, user blocks, corporate certifications, and flags changes.
        </p>
      </div>

      {/* Filter Options & Search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              className="h-8 text-[10px] font-bold uppercase tracking-wider"
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        <div className="relative w-full max-w-xs shrink-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search by action, operator or IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9 rounded-lg border-slate-200 bg-white focus-visible:ring-[#6B2C91]/25 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
      </div>

      {/* Logs Table */}
      <DashboardCard className="p-4 overflow-hidden">
        {loading ? (
          <div className="py-12 flex flex-col justify-center items-center gap-2">
            <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Fetching activity logs...
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredLogs}
            emptyMessage="No matching activity log records found."
          />
        )}
      </DashboardCard>
    </div>
  )
}
export default ActivityLogs
