import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CalendarClock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RecruiterApi } from "../services/recruiterApi"

// Issue 1 (Candidate Job Lifecycle spec): both Applicants.tsx and
// CandidatePreview.tsx previously each had their own near-identical copy of
// this modal, and both only captured Title/DateTime/Location -- missing the
// spec'd Timezone, Interview Mode (Online/Offline), Meeting Link, Venue, and
// Notes fields entirely. Centralized here as one real component per the
// ticket's "reuse existing components instead of duplicating layouts"
// instruction, with the full field set and its own submit handling.

const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
]

// Best-effort guess at the recruiter's own timezone as the default selection
// -- falls back to Asia/Kolkata (the platform's primary market) if the
// browser can't tell us, or reports something not in the quick-pick list.
function guessTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz || "Asia/Kolkata"
  } catch {
    return "Asia/Kolkata"
  }
}

// Formats "now" as a datetime-local input expects ("YYYY-MM-DDTHH:mm", in the
// browser's local time, no timezone suffix) so it can be used as the input's
// `min` -- this is what actually grays out past dates/times in the native
// picker, rather than just rejecting them after the fact on submit.
function nowForDateTimeLocal(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export interface ScheduleInterviewSubject {
  applicationId: string
  name: string
  jobTitle?: string
}

interface ScheduleInterviewModalProps {
  subject: ScheduleInterviewSubject | null
  onClose: () => void
  onScheduled: () => void
}

export function ScheduleInterviewModal({ subject, onClose, onScheduled }: ScheduleInterviewModalProps) {
  const [title, setTitle] = useState("")
  const [dateTime, setDateTime] = useState("")
  const [timezone, setTimezone] = useState(guessTimezone())
  const [mode, setMode] = useState<"Online" | "Offline">("Online")
  const [meetingLink, setMeetingLink] = useState("")
  const [venue, setVenue] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Reset the form fresh every time a new subject is opened (including
  // "closed" -> null, where none of this matters since the modal unmounts).
  useEffect(() => {
    if (subject) {
      setTitle(`Interview for ${subject.jobTitle || subject.name}`)
      setDateTime("")
      setTimezone(guessTimezone())
      setMode("Online")
      setMeetingLink("")
      setVenue("")
      setNotes("")
    }
  }, [subject])

  if (!subject) return null

  const handleConfirm = async () => {
    if (!title.trim() || !dateTime) {
      toast.error("Title and date/time are required.")
      return
    }
    // Mirrors the backend's scheduleInterviewSchema check (recruiter.validator.ts)
    // -- catching it here means the recruiter sees the problem immediately
    // instead of after a round trip, but the server-side check is the real
    // guard since a client-side check alone can always be bypassed.
    if (new Date(dateTime).getTime() <= Date.now()) {
      toast.error("Interview date/time must be in the future.")
      return
    }
    if (mode === "Offline" && !venue.trim()) {
      toast.error("Venue is required for an offline interview.")
      return
    }
    try {
      setSubmitting(true)
      await RecruiterApi.scheduleInterview(subject.applicationId, {
        title: title.trim(),
        scheduledAt: new Date(dateTime).toISOString(),
        timezone,
        mode,
        meetingLink: mode === "Online" ? meetingLink.trim() || undefined : undefined,
        venue: mode === "Offline" ? venue.trim() : undefined,
        notes: notes.trim() || undefined,
      })
      toast.success("Interview scheduled and candidate notified.")
      onScheduled()
      onClose()
    } catch (err: any) {
      toast.error(err?.message || "Couldn't schedule the interview.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
            <CalendarClock className="size-4 text-[#6B2C91]" />
            Schedule Interview — {subject.name}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>
          {/* sm:grid-cols-2, not a bare grid-cols-2: this modal is capped at
              max-w-md, so on the narrowest phones (~320-360px) an unconditional
              2-column split leaves each column under 150px -- tight for a
              native datetime-local input, which every other 2-up field row in
              this codebase avoids by staying single-column below sm:. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Date & Time <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                value={dateTime}
                min={nowForDateTimeLocal()}
                onChange={(e) => setDateTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Timezone <span className="text-red-500">*</span></label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                {[timezone, ...COMMON_TIMEZONES.filter((tz) => tz !== timezone)].map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Interview Mode <span className="text-red-500">*</span></label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["Online", "Offline"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                    mode === m
                      ? "border-[#6B2C91] bg-[#6B2C91]/10 text-[#6B2C91] dark:border-pink-300 dark:bg-pink-500/10 dark:text-pink-200"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {mode === "Online" ? (
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Meeting Link (optional)</label>
              <input
                type="text"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="e.g. https://meet.google.com/..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Venue <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Office address"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything the candidate should know before the interview"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs font-bold">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={submitting}
            className="text-xs font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white"
          >
            {submitting ? "Scheduling..." : "Schedule & Notify"}
          </Button>
        </div>
      </div>
    </div>
  )
}
