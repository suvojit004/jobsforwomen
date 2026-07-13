import { useRef, useState } from "react"
import { toast } from "sonner"
import { Download, FileText, Loader2, RefreshCw, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { candidateApi } from "@/features/candidate/services/candidateApi"

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB, matches backend uploadResumeMiddleware limit

type ResumeCardProps = {
  resume?: {
    name: string
    uploadDate: string
    verified: boolean
    url: string
    publicId?: string
    size?: number
    mimetype?: string
    originalName?: string
    uploadedAt?: string
  }
  onChanged?: () => void | Promise<void>
  onUpload?: (file: File) => Promise<any>
  onDelete?: () => Promise<any>
}

export function ResumeCard({ resume, onChanged, onUpload, onDelete }: ResumeCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  if (!resume) return null

  const hasResume = Boolean(resume?.url)

  const handlePickFile = () => {
    if (isUploading) return
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset the input immediately so selecting the same file again still fires onChange
    e.target.value = ""
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Unsupported file type. Please upload a PDF, DOC, or DOCX file.")
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("File is too large. Maximum resume size is 10MB.")
      return
    }

    setIsUploading(true)
    try {
      if (onUpload) {
        await onUpload(file)
      } else {
        await candidateApi.uploadResume(file)
      }
      toast.success(hasResume ? "Resume replaced successfully." : "Resume uploaded successfully.")
      await onChanged?.()
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload resume. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async () => {
    if (isDeleting || isUploading) return
    if (!window.confirm("Remove your uploaded resume? Recruiters will no longer be able to view it.")) {
      return
    }
    setIsDeleting(true)
    try {
      if (onDelete) {
        await onDelete()
      } else {
        await candidateApi.deleteResume()
      }
      toast.success("Resume removed successfully.")
      await onChanged?.()
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove resume. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDownload = () => {
    if (!resume.url) return
    window.open(resume.url, "_blank", "noopener,noreferrer")
  }

  return (
    <DashboardCard className="p-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
          Resume
        </h2>
        {resume.verified && (
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
            Verified
          </span>
        )}
      </div>

      {hasResume ? (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/55">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-[#6B2C91] dark:bg-violet-500/20 dark:text-pink-100">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-slate-950 dark:text-white">
              {resume.name || "Resume"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {resume.uploadDate ? `Uploaded on ${resume.uploadDate}` : "Uploaded"}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
          No resume uploaded yet. Add one so recruiters can review your experience.
        </div>
      )}

      <div className={`mt-4 grid grid-cols-1 gap-2 ${hasResume ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
        {!hasResume ? (
          <Button
            type="button"
            variant="outline"
            disabled={isUploading}
            onClick={handlePickFile}
            className="h-9 justify-center gap-1.5"
          >
            {isUploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={isUploading || isDeleting}
              onClick={handlePickFile}
              className="h-9 justify-center gap-1.5"
            >
              {isUploading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {isUploading ? "Uploading..." : "Replace"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isUploading || isDeleting}
              onClick={handleDelete}
              className="h-9 justify-center gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/20"
            >
              {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              {isDeleting ? "Removing..." : "Remove"}
            </Button>
            <Button
              type="button"
              onClick={handleDownload}
              className="h-9 justify-center gap-1.5 bg-[#6B2C91] hover:bg-[#5a237b]"
            >
              <Download className="size-3.5" />
              Download
            </Button>
          </>
        )}
      </div>
    </DashboardCard>
  )
}
