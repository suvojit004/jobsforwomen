import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp, Ticket } from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { SupportTicketsApi, type SupportTicket, type TicketStatus } from "@/api/supportTickets"
import { TicketCommentThread } from "./TicketCommentThread"

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

// Shared "My Tickets" panel -- shows the current user's own submitted
// tickets and their live status/resolution notes. Used by Candidate,
// Recruiter, and Admin-tier "Report an Issue" pages alike.
export function MyTicketsList({ refreshKey }: { refreshKey?: number }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    SupportTicketsApi.listMine()
      .then((data) => {
        if (!cancelled) setTickets(data)
      })
      .catch(() => {
        if (!cancelled) setTickets([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <DashboardCard className="p-5">
      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex items-center gap-1.5">
        <Ticket className="size-3.5 text-[#6B2C91] dark:text-pink-300" />
        My Tickets
      </h3>

      {loading ? (
        <p className="mt-4 text-[11px] font-semibold text-slate-400">Loading your tickets...</p>
      ) : tickets.length === 0 ? (
        <p className="mt-4 text-[11px] font-semibold text-slate-400">You haven't filed any tickets yet.</p>
      ) : (
        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-850">
          {tickets.map((ticket) => {
            const isOpen = openId === ticket.id
            return (
              <div key={ticket.id} className="py-3 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : ticket.id)}
                  className="w-full flex items-center justify-between gap-2 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-850 dark:text-white truncate">{ticket.subject}</p>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                      {ticket.category} &middot; {new Date(ticket.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${STATUS_BADGE[ticket.status]}`}>
                      {STATUS_LABEL[ticket.status]}
                    </span>
                    {isOpen ? <ChevronUp className="size-4 text-slate-450" /> : <ChevronDown className="size-4 text-slate-450" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-2 space-y-2 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 break-words">
                    <p>{ticket.message}</p>
                    {ticket.resolutionNotes && (
                      <div className="p-2.5 rounded-lg bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-300">
                        <span className="font-black uppercase text-[9px] block mb-0.5">Resolution</span>
                        {ticket.resolutionNotes}
                      </div>
                    )}
                    <div className="pt-1">
                      <TicketCommentThread ticketId={ticket.id} canPost />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </DashboardCard>
  )
}

export default MyTicketsList
