import { useState } from "react"
import { Send } from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import { SupportTicketsApi } from "@/api/supportTickets"

interface ReportIssueFormProps {
  categories: string[]
  title?: string
  onSubmitted?: () => void
}

// Shared "Report Platform Issue" ticket form -- used by the Candidate,
// Recruiter, and Admin portals alike. Each portal passes its own
// portal-appropriate category list (e.g. Candidate/Recruiter don't see
// "Moderation Appeal", which only makes sense from the admin side).
export function ReportIssueForm({ categories, title = "Report an Issue", onSubmitted }: ReportIssueFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [formData, setFormData] = useState({
    subject: "",
    category: categories[0] || "",
    message: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError("")
    if (!formData.subject.trim() || !formData.message.trim()) {
      setSubmitError("Please fill out all fields.")
      return
    }

    setSubmitting(true)
    try {
      await SupportTicketsApi.createTicket(formData.subject, formData.category, formData.message)
      setSubmitSuccess(true)
      setFormData({ subject: "", category: categories[0] || "", message: "" })
      onSubmitted?.()
      setTimeout(() => setSubmitSuccess(false), 4000)
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to file ticket. Please try again or email support directly.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardCard className="p-5">
      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
        {title}
      </h3>
      {submitSuccess && (
        <div className="mt-3 p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-[11px] font-bold dark:bg-emerald-950/35 dark:text-emerald-300">
          Your issue ticket has been filed successfully! Support will update you soon.
        </div>
      )}
      {submitError && (
        <div className="mt-3 p-2.5 bg-red-50 text-red-800 rounded-lg text-[11px] font-bold dark:bg-red-950/35 dark:text-red-300">
          {submitError}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3.5 mt-4 text-xs font-semibold">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400">Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400">Subject</label>
          <input
            type="text"
            placeholder="Summarize the problem..."
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400">Detailed Message</label>
          <textarea
            placeholder="Describe your issue in detail..."
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            className="w-full h-24 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold resize-none"
          />
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-9 bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700 text-xs font-black flex items-center justify-center gap-1.5 mt-2"
        >
          <Send className="size-3.5" />
          {submitting ? "Filing Ticket..." : "File Ticket"}
        </Button>
      </form>
    </DashboardCard>
  )
}

export default ReportIssueForm
