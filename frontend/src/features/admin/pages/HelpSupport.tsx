import { useState } from "react"
import {
  CircleHelp,
  BookOpen,
  Mail,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { ReportIssueForm } from "@/features/shared/support/ReportIssueForm"
import { MyTicketsList } from "@/features/shared/support/MyTicketsList"

const TICKET_CATEGORIES = ["Technical Issue", "Perk Dispute", "Moderation Appeal", "Other Query"]

interface FaqItem {
  q: string
  a: string
}

export function HelpSupport() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [ticketsRefreshKey, setTicketsRefreshKey] = useState(0)

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
      a: "Navigate to the Reports & Analytics page. You can trigger exports there to download live CSV summaries generated from current platform data.",
    },
  ]

  const handleToggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx)
  }

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
            <CircleHelp className="size-6 text-[#6B2C91] dark:text-pink-300" />
            Help & Support Desk
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Find operational FAQs, explore compliance manuals, or file troubleshooting tickets.
          </p>
        </div>
        <a
          href="/admin/support-tickets"
          onClick={(e) => {
            e.preventDefault()
            navigate("/admin/support-tickets")
          }}
          className="text-xs font-black text-[#6B2C91] dark:text-pink-300 hover:underline shrink-0"
        >
          View Support Ticket Queue &rarr;
        </a>
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
                href="/admin/roles-permissions"
                onClick={(e) => {
                  e.preventDefault()
                  navigate("/admin/roles-permissions")
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
                href="/admin/company-approvals"
                onClick={(e) => {
                  e.preventDefault()
                  navigate("/admin/company-approvals")
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
          <ReportIssueForm
            categories={TICKET_CATEGORIES}
            title="Report Platform Issue"
            onSubmitted={() => setTicketsRefreshKey((k) => k + 1)}
          />

          <MyTicketsList refreshKey={ticketsRefreshKey} />

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
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  )
}
export default HelpSupport
