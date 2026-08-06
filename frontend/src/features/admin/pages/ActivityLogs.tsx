import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Search, FileText, ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import type { ColumnDef } from "@/components/shared/DataTable"
import { Input } from "@/components/ui/input"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import { AdminApi } from "../services/adminApi"
import { useAuth } from "@/contexts/AuthContext"
import apiClient from "@/api/client"

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
  const { user } = useAuth()
  // Matches the backend gates on GET /admins/audits/export (USER_MGMT_ROLES)
  // and DELETE /admins/audits (requireSuperAdmin) -- see admin.routes.ts.
  // Purging the audit trail is a stricter bar than exporting it: this is the
  // platform's own security record, not just PII-bearing data.
  const canExport = !!(user?.roles?.includes("Admin") || user?.roles?.includes("Super Admin"))
  const canDelete = !!user?.roles?.includes("Super Admin")

  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("All")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(true)
  const requestIdRef = useRef(0)

  // Export/Delete -- "Export" always downloads the FULL, unfiltered audit
  // trail (not just whatever page/category/search is currently on screen).
  // hasExported tracks whether that's happened at least once in this page
  // view, so "Delete All Logs" can guarantee a copy exists first without
  // making the admin export twice if they already did.
  const [exporting, setExporting] = useState(false)
  const [hasExported, setHasExported] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Bumped after a successful delete to force the fetch effect below to
  // re-run even when `page` is already 1 (setting state to its current
  // value doesn't trigger a re-render/effect on its own).
  const [refreshKey, setRefreshKey] = useState(0)

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
    // every
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
      } catch (err: any) {
        console.error("Failed to fetch audit trails:", err)
        toast.error(err?.message || "Failed to load audit trail data.")
      } finally {
        if (thisRequestId === requestIdRef.current) setLoading(false)
      }
    }
    loadLogs()
  }, [page, debouncedSearch, activeCategory, refreshKey])

  // Downloads the ENTIRE audit trail as CSV -- deliberately ignores the
  // current search/category/page filters, same "Export" always means "the
  // whole table" behavior as the Reports & Analytics CSV exports. Returns
  // whether it actually succeeded, so handleDeleteAll can know whether it's
  // safe to proceed.
  const handleExport = async (): Promise<boolean> => {
    setExporting(true)
    try {
      const token = localStorage.getItem("jwt_token")
      const res = await fetch(`${apiClient.defaults.baseURL}/api/v1/admins/audits/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      })
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`)
      }
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") || ""
      const match = disposition.match(/filename=([^;]+)/)
      const downloadName = match ? match[1].trim() : "activity-logs.csv"

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = downloadName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setHasExported(true)
      toast.success("Activity log exported.")
      return true
    } catch (err: any) {
      console.error("Failed to export activity logs", err)
      toast.error(err?.message || "Failed to export activity logs.")
      return false
    } finally {
      setExporting(false)
    }
  }

  // Wipes the entire audit trail. Always ensures a CSV export exists first
  // -- if the admin hasn't clicked Export yet this page view, this triggers
  // and waits for that download before deleting anything, rather than ever
  // deleting without a copy in hand. Confirmation dialog matches this
  // codebase's existing admin-panel convention for destructive actions
  // (window.confirm -- see UserModeration.tsx's handleDeleteUser/
  // handleDeleteCompany) rather than introducing a new typed-confirmation
  // pattern just for this screen.
  const handleDeleteAll = async () => {
    const confirmed = window.confirm(
      `This will permanently delete the ENTIRE activity log (${totalItems} record${totalItems === 1 ? "" : "s"}). This cannot be undone. Continue?`
    )
    if (!confirmed) return

    if (!hasExported) {
      const exported = await handleExport()
      if (!exported) {
        toast.error("Export failed -- logs were not deleted. Please try again.")
        return
      }
    }

    setDeleting(true)
    try {
      const result = await AdminApi.deleteAllAuditLogs()
      toast.success(`Purged ${result?.deletedCount ?? 0} activity log record(s).`)
      setHasExported(false)
      setPage(1)
      // Forces the fetch effect to re-run even if `page` was already 1 (see
      // refreshKey's declaration above) -- the table should now show just
      // the one new "PURGE_AUDIT_LOGS" row the deletion itself creates.
      setRefreshKey((k) => k + 1)
    } catch (err: any) {
      console.error("Failed to delete activity logs", err)
      toast.error(err?.message || "Failed to delete activity logs.")
    } finally {
      setDeleting(false)
    }
  }

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
            tagColor = "bg-teal-100/60 text-teal-800 dark:bg-teal-950/20 dark:text-teal-300 border border-teal-200/20"
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
            <FileText className="size-6 text-[#6B2C91] dark:text-pink-300" />
            Platform Activity Logs
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Traceable, audit logs of moderator operations, user blocks, corporate certifications, and flags changes.
          </p>
        </div>

        {/* Export -- Admin/Super Admin (matches GET /admins/audits/export's
            requireRole(USER_MGMT_ROLES) gate). Delete -- Super Admin only
            (matches DELETE /admins/audits's requireSuperAdmin gate), since
            purging the platform's own audit trail is a stricter action than
            just downloading a copy of it. */}
        <div className="flex items-center gap-2 shrink-0">
          {canExport && (
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="h-9 text-xs font-bold gap-1.5"
            >
              <Download className="size-3.5" />
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDeleteAll}
              disabled={deleting || exporting || totalItems === 0}
              title={totalItems === 0 ? "No records to delete" : "Permanently deletes the entire activity log"}
              className="h-9 text-xs font-bold gap-1.5 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400"
            >
              <Trash2 className="size-3.5" />
              {deleting ? "Deleting..." : "Delete All Logs"}
            </Button>
          )}
        </div>
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
