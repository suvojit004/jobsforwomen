import { useState, useEffect } from "react"
import {
  CircleHelp,
  BookOpen,
  Mail,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { ReportIssueForm } from "@/features/shared/support/ReportIssueForm"
import { MyTicketsList } from "@/features/shared/support/MyTicketsList"
import { AdminApi } from "../services/adminApi"
import { useAuth } from "@/contexts/AuthContext"

const TICKET_CATEGORIES = ["Technical Issue", "Perk Dispute", "Moderation Appeal", "Other Query"]

interface FaqItem {
  q: string
  a: string
}

export function HelpSupport() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Was previously hardcoded straight into this page's JSX with no way to
  // change it without a code deploy. Now backed by the PlatformSettings
  // singleton row (see AdminService.getPlatformSettings/updatePlatformSettings)
  // -- both Admin and Super Admin can edit it, unlike the Super-Admin-only
  // Platform Security Policies on Administrative Settings.
  const canEditSupportContact = !!(user?.roles?.includes("Admin") || user?.roles?.includes("Super Admin"))
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [ticketsRefreshKey, setTicketsRefreshKey] = useState(0)

  const [supportEmail, setSupportEmail] = useState("")
  const [supportEmailLoading, setSupportEmailLoading] = useState(true)
  const [editingSupportEmail, setEditingSupportEmail] = useState(false)
  const [supportEmailDraft, setSupportEmailDraft] = useState("")
  const [supportEmailSaving, setSupportEmailSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const settings = await AdminApi.getPlatformSettings()
        if (!cancelled) {
          setSupportEmail(settings?.supportContactEmail || "")
        }
      } catch {
        // Non-critical -- the card just renders without a contact if this
        // fails, same as any other best-effort admin widget on this page.
      } finally {
        if (!cancelled) setSupportEmailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const startEditingSupportEmail = () => {
    setSupportEmailDraft(supportEmail)
    setEditingSupportEmail(true)
  }

  const cancelEditingSupportEmail = () => {
    setEditingSupportEmail(false)
    setSupportEmailDraft("")
  }

  const saveSupportEmail = async () => {
    const trimmed = supportEmailDraft.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid support contact email address.")
      return
    }
    setSupportEmailSaving(true)
    try {
      const settings = await AdminApi.updatePlatformSettings({ supportContactEmail: trimmed })
      setSupportEmail(settings?.supportContactEmail || trimmed)
      setEditingSupportEmail(false)
      toast.success("Support contact email updated.")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update the support contact email.")
    } finally {
      setSupportEmailSaving(false)
    }
  }

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
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white">
                Operations Support Contacts
              </h3>
              {canEditSupportContact && !editingSupportEmail && !supportEmailLoading && (
                <button
                  type="button"
                  onClick={startEditingSupportEmail}
                  className="text-slate-400 hover:text-[#6B2C91] dark:hover:text-pink-300 transition-colors"
                  aria-label="Edit technical helpdesk email"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-3.5 text-xs font-semibold">
              <div className="flex items-center gap-2.5">
                <Mail className="size-4 text-[#6B2C91] dark:text-pink-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase text-slate-400">Technical Helpdesk</p>
                  {editingSupportEmail ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="email"
                        value={supportEmailDraft}
                        onChange={(e) => setSupportEmailDraft(e.target.value)}
                        disabled={supportEmailSaving}
                        autoFocus
                        className="flex-1 min-w-0 text-xs font-semibold text-slate-850 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#6B2C91]"
                      />
                      <button
                        type="button"
                        onClick={saveSupportEmail}
                        disabled={supportEmailSaving}
                        className="text-emerald-600 hover:text-emerald-700 shrink-0 disabled:opacity-50"
                        aria-label="Save"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditingSupportEmail}
                        disabled={supportEmailSaving}
                        className="text-slate-400 hover:text-slate-600 shrink-0 disabled:opacity-50"
                        aria-label="Cancel"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : supportEmailLoading ? (
                    <p className="text-slate-400">Loading…</p>
                  ) : supportEmail ? (
                    <a href={`mailto:${supportEmail}`} className="text-slate-850 dark:text-white hover:underline break-all">
                      {supportEmail}
                    </a>
                  ) : (
                    <p className="text-slate-400">Not set</p>
                  )}
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
