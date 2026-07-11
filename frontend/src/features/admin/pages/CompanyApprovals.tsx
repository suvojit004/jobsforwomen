import { useState, useEffect } from "react"
import {
  Search,
  Check,
  X,
  HelpCircle,
  AlertCircle,
  Building,
  Globe,
} from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import type { ColumnDef } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { AdminApi } from "../services/adminApi"

interface AdminCompany {
  id: string
  name: string
  website: string
  location: string
  industry: string
  claimedPerks: string[]
  status: string
  feedback?: string
}

export function CompanyApprovals() {
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "approved" | "info_requested" | "rejected">("all")
  const [loading, setLoading] = useState(true)

  // Dialog/Modal state
  const [activeModal, setActiveModal] = useState<{
    companyId: string
    type: "info_request" | "reject"
    companyName: string
  } | null>(null)
  const [modalFeedbackText, setModalFeedbackText] = useState("")

  const loadCompanies = async () => {
    try {
      setLoading(true)
      const data = await AdminApi.getCompanies()
      setCompanies((data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        website: c.website || "www.example.com",
        location: c.location || "Not Specified",
        industry: c.industry?.name || "Software & Technology",
        claimedPerks: c.claimedPerks || ["Flexible Hours", "Menstrual Leave Support"],
        status: c.status,
        feedback: c.feedback || ""
      })))
    } catch (err) {
      console.error("Failed to load companies:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCompanies()
  }, [])

  const handleApprove = async (companyId: string) => {
    if (confirm("Are you sure you want to approve this company's verification checklist?")) {
      try {
        await AdminApi.verifyCompany(companyId, "approved")
        loadCompanies()
      } catch (err) {
        console.error("Failed to approve company", err)
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
    } catch (err) {
      console.error("Failed to reject or request info", err)
    }
  }

  // Filter logic
  const filteredCompanies = companies.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false

    if (filterMode === "pending") return c.status === "pending"
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
      header: "Industry",
      accessorKey: "industry",
    },
    {
      header: "Claimed Perks / Credentials",
      cell: (row) => (
        <div className="flex flex-wrap gap-1 max-w-sm">
          {row.claimedPerks.map((perk, i) => (
            <span
              key={i}
              className="text-[9px] font-black bg-[#6B2C91]/5 text-[#6B2C91] border border-[#6B2C91]/15 dark:bg-pink-900/10 dark:text-pink-300 dark:border-pink-900/20 px-2 py-0.5 rounded"
            >
              {perk}
            </span>
          ))}
        </div>
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
            statusLabel = "Approved Champion"
            break
          case "pending":
            badgeStyle = "bg-amber-100/60 text-amber-800 dark:bg-amber-955/30 dark:text-amber-300"
            statusLabel = "Pending Verification"
            break
          case "info_requested":
            badgeStyle = "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350"
            statusLabel = "More Info Requested"
            break
          case "rejected":
            badgeStyle = "bg-pink-100/60 text-pink-850 dark:bg-pink-955/35 dark:text-pink-300"
            statusLabel = "Rejected"
            break
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
        <div className="flex justify-end gap-1.5">
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
              Request Info
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
          Company Approvals Portal
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Approve or audit corporate status claims for Menstrual Leave Champion and return-to-work certifications.
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
            <span className="ml-1.5 bg-amber-100 text-amber-700 dark:bg-amber-955/20 dark:text-amber-300 text-[9px] px-1 rounded-full font-black">
              {companies.filter((c) => c.status === "pending").length}
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
                {activeModal.type === "reject" ? "Reject Perks Claim" : "Request Documentation"}
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
                Provide notes for <strong className="text-slate-800 dark:text-slate-200">{activeModal.companyName}</strong>. This message will be sent to the recruiter dashboard.
              </p>
              <textarea
                placeholder={
                  activeModal.type === "reject"
                    ? "Enter rejection reason (e.g. Perks checklist does not meet requirements...)"
                    : "Describe what documentation is needed (e.g. Please provide HR leave policies PDF...)"
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
