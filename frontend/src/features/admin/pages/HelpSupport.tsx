import { useState } from "react"
import {
  CircleHelp,
  BookOpen,
  Mail,
  Send,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"

interface FaqItem {
  q: string
  a: string
}

export function HelpSupport() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    subject: "",
    category: "Technical Issue",
    message: "",
  })

  const faqs: FaqItem[] = [
    {
      q: "How does the Menstrual Leave Champion verification work?",
      a: "Employers upload their HR leave policy checklist and documents. Admins audit these claims via the Company Approvals portal. Once approved, the company automatically receives the Menstrual Leave Champion badge.",
    },
    {
      q: "Can a blocked candidate verify their credentials again?",
      a: "Yes. An administrator can locate the candidate profile in the Users management log or the Candidate Management page and click 'Unblock' to restore their access.",
    },
    {
      q: "How do I configure new Feature Flags?",
      a: "Navigate to Feature Configs from the navigation menu. Toggle the desired flags and click 'Save Feature Configurations' to propagate the changes.",
    },
    {
      q: "Where do I export weekly analytics summaries?",
      a: "Navigate to the Reports & Analytics page. You can trigger simulated exports to download CSV records directories or generate detailed PDF telemetry overviews.",
    },
  ]

  const handleToggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.subject.trim() || !formData.message.trim()) {
      alert("Please fill out all fields.")
      return
    }

    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      alert("Your issue ticket has been filed successfully! Support will update you soon.")
      setFormData({ subject: "", category: "Technical Issue", message: "" })
    }, 1000)
  }

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
          <CircleHelp className="size-6 text-[#6B2C91] dark:text-pink-300" />
          Help & Support Desk
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Find operational FAQs, explore compliance manuals, or file troubleshooting tickets.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* FAQs and Documentation */}
        <div className="lg:col-span-2 space-y-6">
          {/* FAQs Accordion */}
          <DashboardCard className="p-6 space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white">
              Platform FAQ Index
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-850">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx
                return (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0">
                    <button
                      onClick={() => handleToggleFaq(idx)}
                      className="w-full flex items-center justify-between text-left text-xs font-extrabold text-slate-850 dark:text-white py-1.5 focus:outline-none"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="size-4 text-slate-450 shrink-0" />
                      ) : (
                        <ChevronDown className="size-4 text-slate-450 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                        {faq.a}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </DashboardCard>

          {/* Documentation Guides */}
          <DashboardCard className="p-6 space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white">
              Operator Documentation Manuals
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <a
                href="#docs-rbac"
                onClick={(e) => {
                  e.preventDefault()
                  alert("Opening RBAC & Entitlements configuration documentation...")
                }}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-850 hover:border-[#6B2C91]/30 dark:hover:border-pink-300/30 transition-all flex items-start gap-3 bg-slate-50/20 dark:bg-slate-950/5 group"
              >
                <BookOpen className="size-5 text-[#6B2C91] dark:text-pink-300 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-slate-905 dark:text-white group-hover:text-[#6B2C91] dark:group-hover:text-pink-300">
                    RBAC Entitlements Guild
                  </h4>
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 leading-relaxed mt-1">
                    Guideline specifications on roles, permission overrides, and security constraints.
                  </p>
                </div>
              </a>

              <a
                href="#docs-verify"
                onClick={(e) => {
                  e.preventDefault()
                  alert("Opening Company Approvals auditing documentation...")
                }}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-850 hover:border-[#6B2C91]/30 dark:hover:border-pink-300/30 transition-all flex items-start gap-3 bg-slate-50/20 dark:bg-slate-950/5 group"
              >
                <BookOpen className="size-5 text-[#6B2C91] dark:text-pink-300 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-slate-905 dark:text-white group-hover:text-[#6B2C91] dark:group-hover:text-pink-300">
                    Verification Playbook
                  </h4>
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 leading-relaxed mt-1">
                    Auditing guidelines for Menstrual Leave rest policy verification files.
                  </p>
                </div>
              </a>
            </div>
          </DashboardCard>
        </div>

        {/* Report an Issue & Support Contacts */}
        <div className="space-y-6">
          {/* Issue Submission Form */}
          <DashboardCard className="p-5">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Report Platform Issue
            </h3>
            <form onSubmit={handleFormSubmit} className="space-y-3.5 mt-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold"
                >
                  <option value="Technical Issue">Technical Issue</option>
                  <option value="Perk Dispute">Perk Dispute</option>
                  <option value="Moderation Appeal">Moderation Appeal</option>
                  <option value="Other Query">Other Query</option>
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

          {/* Core Support Contacts */}
          <DashboardCard className="p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
              Operations Support Contacts
            </h3>
            <div className="space-y-3.5 text-xs font-semibold">
              <div className="flex items-center gap-2.5">
                <Mail className="size-4 text-[#6B2C91] dark:text-pink-300 shrink-0" />
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Technical Helpdesk</p>
                  <a href="mailto:ops-support@jobsforwomen.info" className="text-slate-850 dark:text-white hover:underline">
                    ops-support@jobsforwomen.info
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <MessageSquare className="size-4 text-[#6B2C91] dark:text-pink-300 shrink-0" />
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Direct Slack channel</p>
                  <span className="text-slate-850 dark:text-white">#jfw-platform-ops</span>
                </div>
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  )
}
export default HelpSupport
