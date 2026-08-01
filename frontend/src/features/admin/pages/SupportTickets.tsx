import { useEffect, useState } from "react"
import { toast } from "sonner"
import { LifeBuoy, X, Ticket } from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import type { ColumnDef } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { useAuth } from "@/hooks/useAuth"
import { SupportTicketsApi, type SupportTicket, type TicketStatus } from "@/api/supportTickets"
import { TicketCommentThread } from "@/features/shared/support/TicketCommentThread"

const STATUS_BADGE: Record<TicketStatus, string> = {
  Open: "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350",
  InProgress: "bg-amber-100/60 text-amber-800 dark:bg-amber-950/30 dark:text-amber-350",
  Resolved: "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-350",
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  Open: "Open",
  InProgress: "In Progress",
  Resolved: "Resolved",
}

function participantName(p?: { email: string; candidateProfile?: { fullName: string } | null; recruiterProfile?: { fullName: string } | null; adminProfile?: { fullName: string } | null } | null) {
  if (!p) return "Unassigned"
  return p.candidateProfile?.fullName || p.recruiterProfile?.fullName || p.adminProfile?.fullName || p.email.split("@")[0]
}

// Admin-tier "Report Platform Issue" ticket queue. Support Executive (and
// Admin/Super Admin as an override) can update status and resolve tickets
// here; Moderator gets the same list/detail view but the status controls are
// hidden -- read-only progress visibility per spec.
export function SupportTickets() {
  const { user } = useAuth()
  const roles = user?.roles || []
  const canManage = roles.some((r) => ["Support Executive", "Admin", "Super Admin"].includes(r))

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "all">("all")
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null)
  const [statusDraft, setStatusDraft] = useState<TicketStatus>("Open")
  const [notesDraft, setNotesDraft] = useState("")
  const [saving, setSaving] = useState(false)

  const loadTickets = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const result = await SupportTicketsApi.listAll({
        status: filterStatus === "all" ? undefined : filterStatus,
        limit: 100,
      })
      setTickets(result.tickets)
    } catch (err: any) {
      toast.error(err?.message || "Failed to load support tickets.")
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus])

  const openTicket = (ticket: SupportTicket) => {
    setActiveTicket(ticket)
    setStatusDraft(ticket.status)
    setNotesDraft(ticket.resolutionNotes || "")
  }

  const closeModal = () => {
    setActiveTicket(null)
    setNotesDraft("")
  }

  const handleSave = async () => {
    if (!activeTicket) return
    if (statusDraft === "Resolved" && !notesDraft.trim()) {
      toast.error("Resolution notes are required when marking a ticket Resolved.")
      return
    }
    setSaving(true)
    try {
      await SupportTicketsApi.updateStatus(activeTicket.id, statusDraft, notesDraft.trim() || undefined)
      toast.success("Ticket updated successfully.")
      closeModal()
      await loadTickets(true)
    } catch (err: any) {
      toast.error(err?.message || "Failed to update ticket.")
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnDef<SupportTicket>[] = [
    {
      header: "Subject",
      cell: (t) => (
        <div className="min-w-0">
          <p className="font-black text-slate-900 dark:text-white truncate max-w-[220px]">{t.subject}</p>
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{t.category}</p>
        </div>
      ),
    },
    {
      header: "Submitted By",
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate max-w-[160px]">{participantName(t.submittedBy)}</p>
          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{t.submitterRole}</p>
        </div>
      ),
    },
    {
      header: "Assigned To",
      cell: (t) => <span>{participantName(t.assignedTo)}</span>,
    },
    {
      header: "Status",
      cell: (t) => (
        <span className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${STATUS_BADGE[t.status]}`}>
          {STATUS_LABEL[t.status]}
        </span>
      ),
    },
    {
      header: "Filed",
      cell: (t) => <span>{new Date(t.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>,
    },
  ]

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
          <LifeBuoy className="size-6 text-[#6B2C91] dark:text-pink-300" />
          Support Ticket Queue
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          {canManage
            ? "Work tickets filed by candidates, recruiters, and admin-tier staff."
            : "Read-only view of platform support ticket progress."}
        </p>
      </div>

      <DashboardCard className="p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["all", "Open", "InProgress", "Resolved"] as const).map((s) => (
            <Button
              key={s}
              variant={filterStatus === s ? "default" : "outline"}
              className="h-8 text-[11px] font-bold"
              onClick={() => setFilterStatus(s)}
            >
              {s === "all" ? "All Tickets" : STATUS_LABEL[s]}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 flex flex-col justify-center items-center gap-2">
            <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Fetching tickets...
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={tickets}
            onRowClick={openTicket}
            emptyMessage="No support tickets found."
          />
        )}
      </DashboardCard>

      {activeTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden select-none animate-fadeIn max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between shrink-0">
              <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white flex items-center gap-1.5">
                <Ticket className="size-4 text-[#6B2C91] dark:text-pink-300" />
                Ticket Details
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 overflow-y-auto">
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white break-words">{activeTicket.subject}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">
                  {activeTicket.category} &middot; Filed by {participantName(activeTicket.submittedBy)} ({activeTicket.submitterRole}) on{" "}
                  {new Date(activeTicket.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/40 text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                {activeTicket.message}
              </div>

              {canManage ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Status</label>
                    <select
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value as TicketStatus)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold"
                    >
                      <option value="Open">Open</option>
                      <option value="InProgress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">
                      Resolution Notes {statusDraft === "Resolved" && <span className="text-pink-500">*</span>}
                    </label>
                    <textarea
                      placeholder="What was done to resolve this? (required to mark Resolved)"
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      className="w-full h-24 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold resize-none"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Status</p>
                  <span className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${STATUS_BADGE[activeTicket.status]}`}>
                    {STATUS_LABEL[activeTicket.status]}
                  </span>
                  {activeTicket.resolutionNotes && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-300 text-[11px] font-medium leading-relaxed break-words">
                      <span className="font-black uppercase text-[9px] block mb-0.5">Resolution</span>
                      {activeTicket.resolutionNotes}
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-slate-100 dark:border-slate-850 pt-3">
                <TicketCommentThread ticketId={activeTicket.id} canPost={canManage} />
              </div>
            </div>

            {canManage && (
              <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-850 flex justify-end gap-2 shrink-0">
                <Button variant="ghost" className="h-8 text-xs font-bold" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  className="h-8 text-xs font-bold bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
export default SupportTickets
