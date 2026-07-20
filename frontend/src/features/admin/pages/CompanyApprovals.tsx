import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import {
  Search,
  Check,
  X,
  HelpCircle,
  AlertCircle,
  Building,
  Globe,
  Eye,
  Mail,
} from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import type { ColumnDef } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { AdminApi } from "../services/adminApi"
import { getSocket } from "@/api/socket"

// Company Registration Requests (Part 2 of the recruiter-onboarding spec).
// This module is intentionally kept independent from Company Perks Approval
// -- it shows registration/verification status only. Perk claims used to be
// displayed here too (a "Claimed Perks / Credentials" column); that's been
// removed since Part 12/20 of the spec explicitly require these two
// workflows never be mixed in the same module.
interface AdminCompany {
  id: string
  name: string
  website: string
  location: string
  industry: string
  recruiterName: string
  recruiterEmail: string
  registeredAt: string
  status: string
  feedback?: string
}

export function CompanyApprovals() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "approved" | "info_requested" | "rejected">("all")

  // The real Prisma CompanyStatus enum has 4 distinct "awaiting admin
  // action" states (pending, pending_verification, submitted, under_review)
  // -- the same set admin.service.ts's dashboard already groups together as
  // "pendingCompanies". Previously this page only ever matched the exact
  // string "pending", so a company that had just completed onboarding (which
  // recruiter.service.ts sets to "submitted", never "pending") was invisible
  // under the Pending filter/count and rendered with a blank, unstyled
  // status badge (no switch case matched "submitted" either).
  const PENDING_LIKE_STATUSES = ["pending", "pending_verification", "submitted", "under_review"]
  const isPendingLike = (status: string) => PENDING_LIKE_STATUSES.includes(status)
  const [loading, setLoading] = useState(true)

  // Dialog/Modal state
  const [activeModal, setActiveModal] = useState<{
    companyId: string
    type: "info_request" | "reject"
    companyName: string
  } | null>(null)
  const [modalFeedbackText, setModalFeedbackText] = useState("")

  const loadCompanies = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const data = await AdminApi.getCompanies()
      setCompanies((data || []).map((c: any) => {
        const recruiter = (c.recruiters || [])[0]
        return {
          id: c.id,
          name: c.name,
          website: c.website || "Not specified",
          location: c.location || "Not Specified",
          industry: c.industry?.name || "Not specified",
          recruiterName: recruiter?.fullName || recruiter?.user?.email?.split("@")[0] || "Not specified",
          recruiterEmail: recruiter?.user?.email || "Not specified",
          registeredAt: c.createdAt
            ? new Date(c.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
            : "Not specified",
          status: c.status,
          feedback: c.feedback || ""
        }
      }))
    } catch (err: any) {
      console.error("Failed to load companies:", err)
      toast.error(err?.message || "Failed to load company approvals.")
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadCompanies()
  }, [])

  // live refresh instead of requiring a manual reload. New
  // registrations, resubmissions, and document uploads all fan out a
  // "Moderation" notification to every active admin (notification.listener.ts)
  // pointed at this exact page -- listen for that and refetch, following the
  // same getSocket("admin") + socket.on("notification") pattern already used
  // by the recruiter/candidate Messages pages.
  useEffect(() => {
    const socket = getSocket("admin")
    const handleNotification = (data: any) => {
      if (data?.category === "Moderation" && data?.actionUrl === "/admin/company-approvals") {
        loadCompanies(true)
      }
    }
    socket.on("notification", handleNotification)
    return () => {
      socket.off("notification", handleNotification)
    }
  }, [])

  const handleApprove = async (companyId: string) => {
    if (confirm("Are you sure you want to approve this company's verification checklist?")) {
      try {
        await AdminApi.verifyCompany(companyId, "approved")
        loadCompanies()
      } catch (err: any) {
        console.error("Failed to approve company", err)
        toast.error(err?.message || "Failed to approve company.")
      }
    }
  }

  const handleModalSubmit = async () => {
    if (!activeModal) return
    if (!modalFeedbackText.trim()) {
      alert("Please provide a note/reason.")
      return
    }

    const targetStatus = activeModal.type === "info_request" ? "info_requested" : "rejected"
    try {
      await AdminApi.verifyCompany(activeModal.companyId, targetStatus)
      setActiveModal(null)
      setModalFeedbackText("")
      loadCompanies()
    } catch (err: any) {
      console.error("Failed to reject or request info", err)
      toast.error(err?.message || "Failed to submit decision.")
    }
  }

  // Filter logic
  const filteredCompanies = companies.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false

    if (filterMode === "pending") return isPendingLike(c.status)
    if (filterMode === "approved") return c.status === "approved"
    if (filterMode === "info_requested") return c.status === "info_requested"
    if (filterMode === "rejected") return c.status === "rejected"
    return true
  })

  const columns: ColumnDef<AdminCompany>[] = [
    {
      header: "Company Details",
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Building className="size-3.5 text-slate-450 dark:text-slate-500" />
            <span className="font-bold text-slate-900 dark:text-white text-xs">{row.name}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
            <span>{row.location}</span>
            <span>•</span>
            <a
              href={`https://${row.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline flex items-center gap-0.5 text-[#6B2C91] dark:text-pink-300"
            >
              <Globe className="size-2.5" />
              {row.website}
            </a>
          </div>
          {row.feedback && (
            <p className="text-[10px] italic font-semibold text-slate-500 bg-slate-50 dark:bg-slate-900 dark:text-slate-400 p-1.5 rounded border border-slate-100 dark:border-slate-800/80 mt-1 max-w-md">
              <span className="font-bold not-italic text-[9px] uppercase tracking-wider text-slate-450 mr-1">
                Admin Note:
              </span>
              "{row.feedback}"
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Recruiter",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-slate-900 dark:text-white">{row.recruiterName}</p>
          <a
            href={`mailto:${row.recruiterEmail}`}
            className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 hover:underline flex items-center gap-0.5"
          >
            <Mail className="size-2.5" />
            {row.recruiterEmail}
          </a>
        </div>
      ),
    },
    {
      header: "Industry",
      accessorKey: "industry",
    },
    {
      header: "Registered",
      cell: (row) => (
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{row.registeredAt}</span>
      ),
    },
    {
      header: "Status",
      cell: (row) => {
        let badgeStyle = ""
        let statusLabel = ""

        switch (row.status) {
          case "approved":
            badgeStyle = "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-350"
            statusLabel = "Approved"
            break
          // Part 17 accessible status colors: Pending -> Blue (was amber,
          // an ambiguous/lower-contrast color the spec explicitly calls out
          // to replace), Need More Info -> Purple/Indigo (was blue here,
          // which collided with the Pending color below it -- swapped so
          // each status has its own distinct, WCAG-accessible color).
          case "pending":
            badgeStyle = "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350"
            statusLabel = "Pending Verification"
            break
          // These 3 statuses didn't have a case at all before, so any
          // company in one of them (which is most newly-onboarded companies,
          // since recruiter.service.ts's onboardCompany sets "submitted") got
          // a blank, unstyled badge with no label.
          case "submitted":
            badgeStyle = "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350"
            statusLabel = "Submitted for Review"
            break
          case "pending_verification":
            badgeStyle = "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350"
            statusLabel = "Pending Verification"
            break
          case "under_review":
            badgeStyle = "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350"
            statusLabel = "Under Review"
            break
          case "draft":
            badgeStyle = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            statusLabel = "Draft (Not Submitted)"
            break
          case "info_requested":
            badgeStyle = "bg-indigo-100/60 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
            statusLabel = "More Info Requested"
            break
          case "rejected":
            badgeStyle = "bg-pink-100/60 text-pink-850 dark:bg-pink-955/35 dark:text-pink-300"
            statusLabel = "Rejected"
            break
          default:
            badgeStyle = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            statusLabel = row.status
        }

        return (
          <span className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${badgeStyle}`}>
            {statusLabel}
          </span>
        )
      },
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        // up to 4 buttons here with no flex-wrap forced the whole
        // table into horizontal-scroll mode on mobile just to reach a
        // primary action -- wrapping keeps the table itself narrower.
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-bold border-slate-200 dark:border-slate-800"
            onClick={() => navigate(`/admin/company-details?companyId=${row.id}`)}
          >
            <Eye className="size-3 mr-0.5" />
            View Details
          </Button>

          {row.status !== "approved" && (
            <Button
              size="sm"
              className="h-7 text-[10px] font-bold bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700"
              onClick={() => handleApprove(row.id)}
            >
              <Check className="size-3 mr-0.5" />
              Approve
            </Button>
          )}

          {row.status !== "info_requested" && row.status !== "approved" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] font-bold border-slate-200 hover:bg-slate-100 text-blue-650 dark:text-blue-400"
              onClick={() =>
                setActiveModal({
                  companyId: row.id,
                  type: "info_request",
                  companyName: row.name,
                })
              }
            >
              <HelpCircle className="size-3 mr-0.5" />
              Request More Information
            </Button>
          )}

          {row.status !== "rejected" && (
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-[10px] font-bold flex items-center gap-1"
              onClick={() =>
                setActiveModal({
                  companyId: row.id,
                  type: "reject",
                  companyName: row.name,
                })
              }
            >
              <X className="size-3" />
              Reject
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Company Registration Requests
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Review and verify new company registrations. Company perk/credential claims are managed separately.
        </p>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterMode === "all" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("all")}
          >
            All Requests
          </Button>
          <Button
            variant={filterMode === "pending" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("pending")}
          >
            Pending
            <span className="ml-1.5 bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300 text-[9px] px-1 rounded-full font-black">
              {companies.filter((c) => isPendingLike(c.status)).length}
            </span>
          </Button>
          <Button
            variant={filterMode === "info_requested" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("info_requested")}
          >
            Info Requested
          </Button>
          <Button
            variant={filterMode === "approved" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("approved")}
          >
            Approved
          </Button>
          <Button
            variant={filterMode === "rejected" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("rejected")}
          >
            Rejected
          </Button>
        </div>

        <div className="relative w-full max-w-xs shrink-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search by company name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9 rounded-lg border-slate-200 bg-white focus-visible:ring-[#6B2C91]/25 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
      </div>

      {/* Companies table */}
      <DashboardCard className="p-4 overflow-hidden">
        {loading ? (
          <div className="py-12 flex flex-col justify-center items-center gap-2">
            <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Fetching partner logs...
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredCompanies}
            emptyMessage="No matching company verification requests found."
          />
        )}
      </DashboardCard>

      {/* Absolute Feedback Action Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden select-none animate-fadeIn">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white flex items-center gap-1.5">
                <AlertCircle className={`size-4 ${activeModal.type === "reject" ? "text-pink-500" : "text-blue-500"}`} />
                {activeModal.type === "reject" ? "Reject Company Registration" : "Request More Information"}
              </h3>
              <button
                onClick={() => {
                  setActiveModal(null)
                  setModalFeedbackText("")
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                Provide notes for <strong className="text-slate-800 dark:text-slate-200">{activeModal.companyName}</strong>. This message will be emailed to the registering recruiter.
              </p>
              <textarea
                placeholder={
                  activeModal.type === "reject"
                    ? "Enter rejection reason (e.g. Company details could not be verified...)"
                    : "Describe what's needed (e.g. Please upload your GST/PAN/CIN or a company registration certificate...)"
                }
                value={modalFeedbackText}
                onChange={(e) => setModalFeedbackText(e.target.value)}
                className="w-full h-24 rounded-lg border border-slate-250 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold"
              />
              <div className="flex justify-end gap-2 pt-1.5">
                <Button
                  variant="ghost"
                  className="h-8 text-xs font-bold"
                  onClick={() => {
                    setActiveModal(null)
                    setModalFeedbackText("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className={`h-8 text-xs font-bold text-white ${
                    activeModal.type === "reject"
                      ? "bg-pink-600 hover:bg-pink-700"
                      : "bg-[#6B2C91] hover:bg-[#5a237b] dark:bg-pink-650 dark:hover:bg-pink-700"
                  }`}
                  onClick={handleModalSubmit}
                >
                  Submit Action
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default CompanyApprovals
