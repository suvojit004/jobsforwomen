import { useEffect, useState } from "react"
import { CircleHelp, Mail, ChevronDown, ChevronUp, Search } from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { ReportIssueForm } from "@/features/shared/support/ReportIssueForm"
import { MyTicketsList } from "@/features/shared/support/MyTicketsList"
import { SupportTicketsApi } from "@/api/supportTickets"

const TICKET_CATEGORIES = ["Technical Issue", "Account Issue", "Application Issue", "Other Query"]

interface FaqItem {
  question: string
  answer: string
}

export function Help() {
  const [search, setSearch] = useState("")
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  const [ticketsRefreshKey, setTicketsRefreshKey] = useState(0)
  // Admin-configured support contact email (Operations Support Contacts
  // card, admin Help & Support page) -- was hardcoded here previously, so
  // an admin's change to that card silently never showed up for candidates.
  const [supportEmail, setSupportEmail] = useState("support@jobsforwomen.info")

  useEffect(() => {
    SupportTicketsApi.getContactEmail()
      .then(setSupportEmail)
      .catch(() => {
        // Keep the fallback already in state -- no need to surface an error
        // for a non-critical display value.
      })
  }, [])

  const faqs: FaqItem[] = [
    {
      question: "How do I upload or update my resume?",
      answer: "Go to your Profile page and use the Resume section to upload a new file or replace an existing one. Supported formats are PDF, DOC, and DOCX.",
    },
    {
      question: "Why can't I apply to a job?",
      answer: "Applying requires a verified email address and a profile that meets the minimum completion threshold. Check your Settings page for your email verification status, and your Profile page for completion percentage.",
    },
    {
      question: "How do I track the status of my applications?",
      answer: "Visit the 'My Applications' page from the sidebar. Each application shows its current stage -- Applied, Reviewed, Shortlisted, Interview Scheduled, Offer Released, Hired, or Rejected.",
    },
    {
      question: "Can I withdraw an application after submitting it?",
      answer: "Yes. Open the application from 'My Applications' and click 'Withdraw Application' in the details panel. This is available up until an offer is released -- once you're at the Offer Released or Selected stage, withdrawal is disabled and you'll need to contact the recruiter directly. Withdrawing is permanent and the recruiter will be notified.",
    },
  ]

  const filteredFaqs = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-3xl mx-auto select-none">
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
          <CircleHelp className="size-6 text-[#6B2C91] dark:text-pink-300" />
          Help & Support
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Find answers to common questions or file a support ticket.
        </p>
      </div>

      <DashboardCard className="p-5 space-y-5">
        <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
          Frequently Asked Questions
        </h3>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search FAQs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-3">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, idx) => {
              const isOpen = openIdx === idx
              return (
                <div key={idx} className="border border-slate-150 rounded-xl overflow-hidden dark:border-slate-850">
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    className="w-full p-4 flex items-center justify-between text-left text-xs font-black text-slate-800 hover:bg-slate-50/50 dark:text-slate-200 dark:hover:bg-slate-850/50 cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    {isOpen ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
                  </button>
                  {isOpen && (
                    <div className="p-4 bg-slate-50/40 dark:bg-slate-950/20 text-xs font-semibold text-slate-500 leading-relaxed border-t border-slate-150 dark:border-slate-850 dark:text-slate-400">
                      {faq.answer}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
              No questions matched your search criteria.
            </p>
          )}
        </div>
      </DashboardCard>

      <ReportIssueForm
        categories={TICKET_CATEGORIES}
        title="Report Platform Issue"
        onSubmitted={() => setTicketsRefreshKey((k) => k + 1)}
      />

      <MyTicketsList refreshKey={ticketsRefreshKey} />

      <DashboardCard className="p-5 space-y-4">
        <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
          Still Need Assistance?
        </h3>
        <div className="flex items-start gap-3 p-3.5 border border-slate-150 rounded-xl dark:border-slate-850">
          <Mail className="size-5 text-[#6B2C91] dark:text-pink-300 mt-0.5" />
          <div>
            <p className="text-xs font-black text-slate-800 dark:text-slate-200">Email Support</p>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{supportEmail}</p>
          </div>
        </div>
      </DashboardCard>
    </div>
  )
}
export default Help
