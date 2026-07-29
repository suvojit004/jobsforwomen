import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Search,
  Check,
  X,
  HelpCircle,
  AlertCircle,
  Award,
} from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import type { ColumnDef } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { AdminApi } from "../services/adminApi"
import { getSocket } from "@/api/socket"
import { FileTypeIcon } from "@/components/shared/forms/SupportingDocumentsUploader"
import { DocumentPreviewModal } from "@/components/shared/DocumentPreviewModal"
import { formatFileSize, getFileIconKind, type PreviewableDocument } from "@/utils/fileHelpers"

interface PerkDocument {
  url: string
  category: string
  uploadedAt: string
  version: number
  mimetype?: string
  size?: number
  originalFilename?: string
  format?: string
}

interface AdminPerkRequest {
  id: string
  companyName: string
  recruiterName: string
  recruiterEmail: string
  perkName: string
  status: string
  submittedAt: string
  adminComment: string | null
  recruiterComment: string | null
  documents: PerkDocument[]
}

// Company Perk Requests (Parts 6/7 of the recruiter-onboarding spec) --
// deliberately its own admin module, entirely independent from Company
// Registration Requests (CompanyApprovals.tsx). Never merge these two.
export function CompanyPerkRequests() {
  const [requests, setRequests] = useState<AdminPerkRequest[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "approved" | "info_requested" | "rejected">("all")
  const [loading, setLoading] = useState(true)
  const [previewDoc, setPreviewDoc] = useState<PreviewableDocument | null>(null)

  const [activeModal, setActiveModal] = useState<{
    requestId: string
    type: "approve" | "info_request" | "reject"
    perkName: string
    companyName: string
  } | null>(null)
  const [modalComment, setModalComment] = useState("")

  const loadRequests = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const data = await AdminApi.getPerkRequests()
      setRequests(
        (data || []).map((r: any) => {
          const recruiter = (r.company?.recruiters || [])[0]
          return {
            id: r.id,
            companyName: r.company?.name || "Unknown Company",
            recruiterName: recruiter?.fullName || recruiter?.user?.email?.split("@")[0] || "Not specified",
            recruiterEmail: recruiter?.user?.email || "Not specified",
            perkName: r.perkName,
            status: r.status,
            submittedAt: r.submittedAt
              ? new Date(r.submittedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
              : "Not specified",
            adminComment: r.adminComment || null,
            recruiterComment: r.recruiterComment || null,
            documents: Array.isArray(r.documents) ? r.documents : [],
          }
        })
      )
    } catch (err: any) {
      console.error("Failed to load perk requests:", err)
      toast.error(err?.message || "Failed to load perk requests.")
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  // live refresh -- perk submissions/resubmissions/document uploads
  // all fan out a "Moderation" notification to every active admin pointed at
  // this page (notification.listener.ts).
  useEffect(() => {
    const socket = getSocket("admin")
    const handleNotification = (data: any) => {
      if (data?.category === "Moderation" && data?.actionUrl === "/admin/company-perk-requests") {
        loadRequests(true)
      }
    }
    socket.on("notification", handleNotification)
    return () => {
      socket.off("notification", handleNotification)
    }
  }, [])

  const handleApprove = async (requestId: string) => {
    if (confirm("Approve this perk claim? It will become publicly visible.")) {
      try {
        await AdminApi.reviewPerkRequest(requestId, "approved")
        loadRequests()
      } catch (err: any) {
        console.error("Failed to approve perk request", err)
        toast.error(err?.message || "Failed to approve perk request.")
      }
    }
  }

  const handleModalSubmit = async () => {
    if (!activeModal) return
    if (!modalComment.trim()) {
      alert("Please provide a note/reason.")
      return
    }

    const targetStatus = activeModal.type === "info_request" ? "info_requested" : "rejected"
    try {
      await AdminApi.reviewPerkRequest(activeModal.requestId, targetStatus, modalComment)
      setActiveModal(null)
      setModalComment("")
      loadRequests()
    } catch (err: any) {
      console.error("Failed to reject or request info on perk request", err)
      toast.error(err?.message || "Failed to submit decision.")
    }
  }

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.perkName.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false
    if (filterMode === "all") return true
    return r.status === filterMode
  })

  const columns: ColumnDef<AdminPerkRequest>[] = [
    {
      header: "Company / Perk",
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Award className="size-3.5 text-slate-450 dark:text-slate-500" />
            <span className="font-bold text-slate-900 dark:text-white text-xs">{row.companyName}</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[#6B2C91] dark:text-pink-300">{row.perkName}</p>
        </div>
      ),
    },
    {
      header: "Recruiter",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-slate-900 dark:text-white">{row.recruiterName}</p>
          <p className="text-[10px] font-semibold text-slate-450 dark:text-slate-500">{row.recruiterEmail}</p>
        </div>
      ),
    },
    {
      header: "Documents",
      cell: (row) =>
        row.documents.length > 0 ? (
          <div className="flex flex-col gap-1">
            {row.documents.map((doc, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPreviewDoc(doc)}
                className="flex items-center gap-1 text-[10px] font-bold text-[#6B2C91] dark:text-pink-300 hover:underline text-left"
              >
                <FileTypeIcon kind={getFileIconKind(doc)} className="size-3" />
                <span className="truncate max-w-[140px]">{doc.originalFilename || doc.category} v{doc.version}</span>
                {typeof doc.size === "number" && <span className="text-slate-400 shrink-0">{formatFileSize(doc.size)}</span>}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[10px] font-semibold text-slate-400">No documents</span>
        ),
    },
    {
      header: "Submitted",
      cell: (row) => <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{row.submittedAt}</span>,
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
          case "pending":
            badgeStyle = "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350"
            statusLabel = "Pending"
            break
          case "info_requested":
            badgeStyle = "bg-indigo-100/60 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-350"
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
        // flex-wrap keeps 3 action buttons from forcing this table
        // into horizontal-scroll mode on mobile.
        <div className="flex flex-wrap justify-end gap-1.5">
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
                setActiveModal({ requestId: row.id, type: "info_request", perkName: row.perkName, companyName: row.companyName })
              }
            >
              <HelpCircle className="size-3 mr-0.5" />
              Request More Information
            </Button>
          )}
          {row.status !== "rejected" && row.status !== "approved" && (
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-[10px] font-bold flex items-center gap-1"
              onClick={() =>
                setActiveModal({ requestId: row.id, type: "reject", perkName: row.perkName, companyName: row.companyName })
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
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">Company Perk Requests</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Review individual perk/credential claims (Menstrual Leave Champion, Flexible Hours, etc). Independent from
          Company Registration Requests.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button variant={filterMode === "all" ? "default" : "outline"} className="h-8 text-[11px] font-bold" onClick={() => setFilterMode("all")}>
            All Requests
          </Button>
          <Button variant={filterMode === "pending" ? "default" : "outline"} className="h-8 text-[11px] font-bold" onClick={() => setFilterMode("pending")}>
            Pending
            <span className="ml-1.5 bg-blue-100 text-blue-700 dark:bg-blue-955/20 dark:text-blue-300 text-[9px] px-1 rounded-full font-black">
              {requests.filter((r) => r.status === "pending").length}
            </span>
          </Button>
          <Button variant={filterMode === "info_requested" ? "default" : "outline"} className="h-8 text-[11px] font-bold" onClick={() => setFilterMode("info_requested")}>
            Info Requested
          </Button>
          <Button variant={filterMode === "approved" ? "default" : "outline"} className="h-8 text-[11px] font-bold" onClick={() => setFilterMode("approved")}>
            Approved
          </Button>
          <Button variant={filterMode === "rejected" ? "default" : "outline"} className="h-8 text-[11px] font-bold" onClick={() => setFilterMode("rejected")}>
            Rejected
          </Button>
        </div>

        <div className="relative w-full max-w-xs shrink-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search by company or perk name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9 rounded-lg border-slate-200 bg-white focus-visible:ring-[#6B2C91]/25 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
      </div>

      <DashboardCard className="p-4 overflow-hidden">
        {loading ? (
          <div className="py-12 flex flex-col justify-center items-center gap-2">
            <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Fetching perk requests...
            </p>
          </div>
        ) : (
          <DataTable columns={columns} data={filteredRequests} emptyMessage="No matching perk requests found." />
        )}
      </DashboardCard>

      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden select-none animate-fadeIn">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white flex items-center gap-1.5">
                <AlertCircle className={`size-4 ${activeModal.type === "reject" ? "text-pink-500" : "text-blue-500"}`} />
                {activeModal.type === "reject" ? "Reject Perk Claim" : "Request More Information"}
              </h3>
              <button
                onClick={() => {
                  setActiveModal(null)
                  setModalComment("")
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                Provide notes for <strong className="text-slate-800 dark:text-slate-200">{activeModal.companyName}</strong>'s{" "}
                <strong className="text-slate-800 dark:text-slate-200">{activeModal.perkName}</strong> claim. This will
                notify the recruiter in their dashboard and by email.
              </p>
              <textarea
                placeholder={
                  activeModal.type === "reject"
                    ? "Enter rejection reason..."
                    : "Describe what documentation or information is needed..."
                }
                value={modalComment}
                onChange={(e) => setModalComment(e.target.value)}
                className="w-full h-24 rounded-lg border border-slate-250 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold"
              />
              <div className="flex justify-end gap-2 pt-1.5">
                <Button
                  variant="ghost"
                  className="h-8 text-xs font-bold"
                  onClick={() => {
                    setActiveModal(null)
                    setModalComment("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className={`h-8 text-xs font-bold text-white ${
                    activeModal.type === "reject" ? "bg-pink-600 hover:bg-pink-700" : "bg-[#6B2C91] hover:bg-[#5a237b] dark:bg-pink-650 dark:hover:bg-pink-700"
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

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  )
}

export default CompanyPerkRequests
