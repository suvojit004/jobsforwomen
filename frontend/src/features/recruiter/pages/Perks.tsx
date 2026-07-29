import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Award,
  Baby,
  Clock,
  Home as HomeIcon,
  GraduationCap,
  CheckCircle2,
  Upload,
  HelpCircle,
} from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import { RecruiterApi } from "../services/recruiterApi"
import { getSocket } from "@/api/socket"
import { SupportingDocumentsUploader, FileTypeIcon, type StagedDocument } from "@/components/shared/forms/SupportingDocumentsUploader"
import { DocumentPreviewModal } from "@/components/shared/DocumentPreviewModal"
import { formatFileSize, getFileIconKind, SUPPORTING_DOCUMENT_ACCEPT, type PreviewableDocument } from "@/utils/fileHelpers"

// Canonical perk registry. "Menstrual Leave Champion" must match exactly
// what Dashboard.tsx's status card checks for -- the two previously
// disagreed ("Menstrual Leave Support" vs "Menstrual Leave Champion"), so
// that card was permanently stuck showing "Inactive".
const CANONICAL_PERKS = [
  { name: "Menstrual Leave Champion", icon: Award, description: "Certified paid menstrual leave policy." },
  { name: "Flexible Hours", icon: Clock, description: "Flexible working hours for employees." },
  { name: "Flexible Returnship", icon: Baby, description: "Structured return-to-work program after a career break." },
  { name: "Work From Home", icon: HomeIcon, description: "Work-from-home policy available to employees." },
  { name: "Learning & Development Schemes", icon: GraduationCap, description: "Dedicated upskilling / learning budget." },
  { name: "Childcare Allowance Support", icon: Baby, description: "Childcare allowance or creche support." },
]

const DOCUMENT_CATEGORIES = ["GovernmentIssuedID", "TaxRegistration", "BusinessLicense", "Other"]

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

interface PerkRequest {
  id: string
  perkName: string
  status: "pending" | "approved" | "rejected" | "info_requested"
  adminComment: string | null
  recruiterComment: string | null
  documents: PerkDocument[]
}

function statusBadge(status?: string) {
  switch (status) {
    case "approved":
      return { label: "Approved", cls: "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-350" }
    case "pending":
      return { label: "Pending Review", cls: "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350" }
    case "info_requested":
      return { label: "More Info Required", cls: "bg-indigo-100/60 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-350" }
    case "rejected":
      return { label: "Rejected", cls: "bg-pink-100/60 text-pink-850 dark:bg-pink-955/35 dark:text-pink-300" }
    default:
      return { label: "Not Submitted", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" }
  }
}

export function Perks() {
  const [requests, setRequests] = useState<PerkRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submittingPerk, setSubmittingPerk] = useState<string | null>(null)
  const [uploadingPerk, setUploadingPerk] = useState<string | null>(null)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({})
  // Files staged locally (Issue 2's "Supporting Documents" section) before a
  // perk has even been submitted -- there's no CompanyPerkRequest row (and
  // therefore no id to upload against) until handleSubmit actually creates
  // one, so these live purely in local state and get uploaded right after
  // submission succeeds. Keyed by perk name, same pattern as
  // commentDrafts/categoryDrafts above.
  const [stagedDocs, setStagedDocs] = useState<Record<string, StagedDocument[]>>({})
  const [previewDoc, setPreviewDoc] = useState<PreviewableDocument | null>(null)

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const data = await RecruiterApi.getPerkRequests()
      // Defense-in-depth: the backend now always sends `documents` as a real
      // array (the actual fix for the null.length crash lives in
      // recruiter.service.ts), but this normalizes again at the frontend's
      // data boundary rather than trusting every render site downstream to
      // remember it -- same convention CompanyDetails.tsx already uses for
      // verificationDocuments.
      const safeData = (data || []).map((r: any) => ({ ...r, documents: Array.isArray(r.documents) ? r.documents : [] }))
      setRequests(safeData)
    } catch (err) {
      console.error("Failed to load perk requests:", err)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const handleStageFiles = (perkName: string, files: File[]) => {
    setStagedDocs((prev) => ({
      ...prev,
      [perkName]: [
        ...(prev[perkName] || []),
        ...files.map((file) => ({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          status: "staged" as const,
        })),
      ],
    }))
  }

  const handleRemoveStagedFile = (perkName: string, id: string) => {
    setStagedDocs((prev) => ({ ...prev, [perkName]: (prev[perkName] || []).filter((d) => d.id !== id) }))
  }

  useEffect(() => {
    load()
  }, [])

  // live refresh when an admin reviews a perk (PerkReviewed fires a
  // recruiter-facing notification pointed at this page) -- silent (no
  // loading-spinner flash) since this can fire while the recruiter is
  // actively looking at the page.
  useEffect(() => {
    const socket = getSocket("recruiter")
    const handleNotification = (data: any) => {
      if (data?.category === "Moderation" && data?.actionUrl === "/recruiter/perks") {
        load(true)
      }
    }
    socket.on("notification", handleNotification)
    return () => {
      socket.off("notification", handleNotification)
    }
  }, [])

  const requestFor = (perkName: string) => requests.find((r) => r.perkName === perkName)

  const handleSubmit = async (perkName: string, comment?: string) => {
    try {
      setSubmittingPerk(perkName)
      const request = await RecruiterApi.submitPerk(perkName, comment)

      // Upload any documents the recruiter staged before submitting (Issue
      // 2's Supporting Documents section). Sequential, not Promise.all --
      // addPerkDocument's version numbering reads-then-writes the documents
      // array per request, so concurrent uploads for the same perk could
      // race and silently drop a document under the same version number.
      const filesToUpload = stagedDocs[perkName] || []
      if (filesToUpload.length > 0 && request?.id) {
        let failureCount = 0
        for (const doc of filesToUpload) {
          try {
            await RecruiterApi.uploadPerkDocument(request.id, doc.file, "SupportingDocument")
          } catch {
            failureCount++
          }
        }
        if (failureCount > 0) {
          toast.error(`${failureCount} of ${filesToUpload.length} document(s) failed to upload. Attach them again below.`)
        }
      }

      toast.success(`"${perkName}" submitted for verification.`)
      setCommentDrafts((prev) => ({ ...prev, [perkName]: "" }))
      setStagedDocs((prev) => ({ ...prev, [perkName]: [] }))
      await load()
    } catch (err: any) {
      toast.error(err.message || "Failed to submit perk for verification.")
    } finally {
      setSubmittingPerk(null)
    }
  }

  const handleUpload = async (perkName: string, request: PerkRequest | undefined, file: File) => {
    if (!request) {
      toast.error("Please submit this perk for verification first, then attach documents.")
      return
    }
    try {
      setUploadingPerk(perkName)
      const category = categoryDrafts[perkName] || DOCUMENT_CATEGORIES[0]
      await RecruiterApi.uploadPerkDocument(request.id, file, category)
      toast.success("Document uploaded.")
      await load()
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document.")
    } finally {
      setUploadingPerk(null)
    }
  }

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">Perks & Certifications</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Claim workplace equality perks, attach proof, and track verification status. Independent from your company
          registration status.
        </p>
      </div>

      {loading ? (
        <div className="py-12 flex flex-col justify-center items-center gap-2">
          <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {CANONICAL_PERKS.map((perk) => {
            const request = requestFor(perk.name)
            const badge = statusBadge(request?.status)
            const Icon = perk.icon
            const isPending = request?.status === "pending"
            const isApproved = request?.status === "approved"
            const needsAction = request?.status === "rejected" || request?.status === "info_requested"
            const notSubmitted = !request

            return (
              <DashboardCard key={perk.name} className="p-5 space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="size-9 rounded-lg bg-violet-100 text-[#6B2C91] dark:bg-pink-900/20 dark:text-pink-300 flex items-center justify-center shrink-0">
                      <Icon className="size-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">{perk.name}</h3>
                      <p className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 mt-0.5">{perk.description}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center text-[9px] font-black px-2 py-0.5 rounded-full ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>

                {isApproved && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4" />
                    Verified and publicly visible.
                  </div>
                )}

                {(request?.adminComment || request?.recruiterComment) && !isApproved && (
                  <div className="space-y-1.5">
                    {request?.adminComment && (
                      <p className="text-[11px] italic font-semibold text-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-300 p-2 rounded border border-slate-100 dark:border-slate-800/80">
                        <span className="font-bold not-italic text-[9px] uppercase tracking-wider text-slate-450 mr-1">Admin:</span>
                        "{request.adminComment}"
                      </p>
                    )}
                  </div>
                )}

                {request && (request.documents || []).length > 0 && (
                  <div className="space-y-1">
                    {request.documents.map((doc, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[10px] font-semibold text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900"
                      >
                        <FileTypeIcon kind={getFileIconKind(doc)} className="size-3" />
                        <span className="truncate">{doc.originalFilename || doc.category} v{doc.version}</span>
                        {typeof doc.size === "number" && (
                          <span className="shrink-0 text-slate-400 dark:text-slate-550">{formatFileSize(doc.size)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {notSubmitted && (
                  <div className="space-y-3">
                    <SupportingDocumentsUploader
                      documents={stagedDocs[perk.name] || []}
                      onFilesSelected={(files) => handleStageFiles(perk.name, files)}
                      onRemove={(id) => handleRemoveStagedFile(perk.name, id)}
                      disabled={submittingPerk === perk.name}
                      label="Supporting Documents (optional)"
                      helperText="Policy PDFs, HR documents, screenshots, or brochures. Up to 10MB each."
                    />
                    <Button
                      size="sm"
                      disabled={submittingPerk === perk.name}
                      className="h-8 text-[11px] font-bold bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700"
                      onClick={() => handleSubmit(perk.name)}
                    >
                      {submittingPerk === perk.name ? "Submitting..." : "Submit for Verification"}
                    </Button>
                  </div>
                )}

                {(isPending || needsAction) && (
                  <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        value={categoryDrafts[perk.name] || DOCUMENT_CATEGORIES[0]}
                        onChange={(e) => setCategoryDrafts((prev) => ({ ...prev, [perk.name]: e.target.value }))}
                        className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                      >
                        {DOCUMENT_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <label className="flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                        <Upload className="size-3" />
                        {uploadingPerk === perk.name ? "Uploading..." : "Attach Proof"}
                        <input
                          type="file"
                          accept={SUPPORTING_DOCUMENT_ACCEPT}
                          className="hidden"
                          disabled={uploadingPerk === perk.name}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUpload(perk.name, request, file)
                            e.target.value = ""
                          }}
                        />
                      </label>
                    </div>

                    {needsAction && (
                      <>
                        <textarea
                          value={commentDrafts[perk.name] || ""}
                          onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [perk.name]: e.target.value }))}
                          placeholder="Reply to admin comment / describe what you updated..."
                          className="w-full h-16 rounded-lg border border-slate-250 bg-white p-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                        />
                        <Button
                          size="sm"
                          disabled={submittingPerk === perk.name}
                          className="h-8 text-[11px] font-bold bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700"
                          onClick={() => handleSubmit(perk.name, commentDrafts[perk.name])}
                        >
                          {submittingPerk === perk.name ? "Resubmitting..." : "Resubmit"}
                        </Button>
                      </>
                    )}

                    {isPending && (
                      <p className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                        <HelpCircle className="size-3" />
                        Awaiting admin review.
                      </p>
                    )}
                  </div>
                )}
              </DashboardCard>
            )
          })}
        </div>
      )}

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  )
}

export default Perks
