import { useState, useEffect, useRef } from "react"
import { Search, FileText, ChevronLeft, ChevronRight } from "lucide-react"
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

const CATEGORIES = [
  "All",
  "User Management",
  "Job Moderation",
  "Corporate Perks",
  "Feature Flags",
  "Security Settings",
]

const PAGE_SIZE = 20
// A short, deliberate delay before the search box triggers a real backend
// request. Without this, every keystroke would fire its own paginated
// Prisma query -- this is a minimal, local debounce (a plain setTimeout in
// an effect), not a new state-management dependency.
const SEARCH_DEBOUNCE_MS = 400

export function ActivityLogs() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("All")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(true)
  const requestIdRef = useRef(0)

  // Debounce the search box: only commit to `debouncedSearch` (which
  // actually triggers a fetch) after the admin stops typing for a moment.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  // Any filter change resets back to page 1 -- staying on, say, page 4 of
  // an old filter while switching categories would otherwise silently show
  // "no results" even when the new filter has plenty of matches.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, activeCategory])

  useEffect(() => {
    // CONFIRMED BUG (fixed here, Final Implementation Pass Part 2): every
    // filter here -- category tab, search box, and page number -- now
    // becomes a real GET /admins/audits request with real query parameters,
    // answered by a real Prisma `where`/`skip`/`take` query (see
    // admin.service.ts's getAuditLogs and AdminApi.getAudits). Previously
    // this fetched one fixed page of up to 500 rows once, and every filter
    // change only re-filtered that same in-memory array in React.
    const thisRequestId = ++requestIdRef.current
    async function loadLogs() {
      try {
        setLoading(true)
        const { auditLogs, pagination } = await AdminApi.getAudits({
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          uiCategory: activeCategory,
        })
        // Guard against a slower, stale request resolving after a newer one
        // (e.g. rapidly clicking between category tabs) and clobbering the
        // page with out-of-date results.
        if (thisRequestId !== requestIdRef.current) return

        const formattedLogs: AdminAuditLog[] = (auditLogs || []).map((a: any) => {
          let category = "User Management"
          if (a.entity === "Job") category = "Job Moderation"
          else if (a.entity === "Company") category = "Corporate Perks"
          else if (a.entity === "FeatureFlag") category = "Feature Flags"
          else if (a.entity === "Role" || a.category === "RBAC") category = "Security Settings"

          return {
            id: a.id,
            timestamp: a.timestamp ? new Date(a.timestamp).toLocaleString() : "Just now",
            operator: a.operatorEmail || `System (${a.operatorId || "automated"})`,
            category,
            action: `${a.action.replace(/_/g, " ")}${a.entity ? ` on ${a.entity}` : ""}`,
            ipAddress: a.ipAddress || "Not recorded",
          }
        })

        setLogs(formattedLogs)
        setTotalPages(pagination?.totalPages || 1)
        setTotalItems(pagination?.totalItems || 0)
      } catch (err) {
        console.error("Failed to fetch audit trails:", err)
      } finally {
        if (thisRequestId === requestIdRef.current) setLoading(false)
      }
    }
    loadLogs()
  }, [page, debouncedSearch, activeCategory])

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
          {CATEGORIES.map((cat) => (
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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
          <>
            <DataTable
              columns={columns}
              data={logs}
              emptyMessage="No matching activity log records found."
            />
            {/* Real server-side pagination -- replaces the previous
                fetch-500-then-filter-locally approach. */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-2 pt-3">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {totalItems > 0
                  ? `Page ${page} of ${totalPages} · ${totalItems} total record${totalItems === 1 ? "" : "s"}`
                  : "No records"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-[10px] font-bold"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-3.5" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-[10px] font-bold"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DashboardCard>
    </div>
  )
}
export default ActivityLogs
