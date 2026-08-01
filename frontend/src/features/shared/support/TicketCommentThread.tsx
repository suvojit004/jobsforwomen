import { useEffect, useState } from "react"
import { Send, MessagesSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { SupportTicketsApi, type TicketComment } from "@/api/supportTickets"

function participantName(p?: { email: string; candidateProfile?: { fullName: string } | null; recruiterProfile?: { fullName: string } | null; adminProfile?: { fullName: string } | null } | null) {
  if (!p) return "Unknown"
  return p.candidateProfile?.fullName || p.recruiterProfile?.fullName || p.adminProfile?.fullName || p.email.split("@")[0]
}

interface TicketCommentThreadProps {
  ticketId: string
  // Whether the current viewer is allowed to post a reply -- the ticket's
  // own submitter or the manager tier (Support Executive/Admin/Super Admin)
  // can post; Moderator can read but not post (see support.service.ts's
  // addComment).
  canPost: boolean
}

// Threaded replies on a support ticket -- lazily fetches the ticket's full
// comment list when mounted (list views like MyTicketsList/SupportTickets'
// table deliberately don't carry comments to keep those responses lean, see
// support.service.ts's TICKET_DETAIL_INCLUDE), so this only loads once the
// ticket is actually expanded/opened.
export function TicketCommentThread({ ticketId, canPost }: TicketCommentThreadProps) {
  const { user } = useAuth()
  const [comments, setComments] = useState<TicketComment[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState("")
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    SupportTicketsApi.getById(ticketId)
      .then((ticket) => {
        if (!cancelled) setComments(ticket.comments || [])
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load replies.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ticketId])

  const handlePost = async () => {
    if (!draft.trim()) return
    setPosting(true)
    setError("")
    try {
      const comment = await SupportTicketsApi.addComment(ticketId, draft.trim())
      setComments((prev) => [...prev, comment])
      setDraft("")
    } catch (err: any) {
      setError(err?.message || "Failed to post reply.")
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
        <MessagesSquare className="size-3.5" />
        Replies
      </p>

      {loading ? (
        <p className="text-[11px] font-semibold text-slate-400">Loading replies...</p>
      ) : (
        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-0.5">
          {comments.length === 0 ? (
            <p className="text-[11px] font-semibold text-slate-400">No replies yet.</p>
          ) : (
            comments.map((c) => {
              const isMe = c.authorId === user?.id
              return (
                <div key={c.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] font-medium leading-relaxed break-words ${
                      isMe
                        ? "bg-[#6B2C91] text-white dark:bg-pink-650"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-850 dark:text-slate-200"
                    }`}
                  >
                    {c.message}
                  </div>
                  <p className="mt-1 text-[9px] font-bold text-slate-400">
                    {participantName(c.author)} &middot;{" "}
                    {new Date(c.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              )
            })
          )}
        </div>
      )}

      {error && <p className="text-[10px] font-bold text-red-600 dark:text-red-400">{error}</p>}

      {canPost && (
        <div className="flex items-end gap-2">
          <textarea
            placeholder="Write a reply..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 h-16 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold resize-none"
          />
          <Button
            type="button"
            size="icon"
            className="h-9 w-9 shrink-0 bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700"
            onClick={handlePost}
            disabled={posting || !draft.trim()}
            aria-label="Post reply"
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

export default TicketCommentThread
