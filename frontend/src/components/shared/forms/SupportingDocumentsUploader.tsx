import { useRef, useState } from "react"
import { toast } from "sonner"
import { UploadCloud, X, FileText, FileSpreadsheet, Presentation, FileImage, File as FileIcon, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import {
  SUPPORTING_DOCUMENT_ACCEPT,
  SUPPORTING_DOCUMENT_MIME_TYPES,
  MAX_SUPPORTING_DOCUMENT_SIZE,
  formatFileSize,
  getFileIconKind,
} from "@/utils/fileHelpers"

// Generic per-file status a consumer can drive: "staged" files haven't been
// uploaded yet (pre-submission, this is what Perks.tsx's "not submitted"
// card uses -- Issue 2 explicitly requires files to be attachable, listed,
// and removable *before* the perk request itself is created). "uploading"/
// "done"/"error" let a consumer reuse the exact same list UI for an
// immediate-upload flow instead of a stage-then-commit one, without forking
// the component.
export type SupportingDocumentStatus = "staged" | "uploading" | "done" | "error"

export interface StagedDocument {
  id: string
  file: File
  status: SupportingDocumentStatus
  errorMessage?: string
}

interface SupportingDocumentsUploaderProps {
  documents: StagedDocument[]
  onFilesSelected: (files: File[]) => void
  onRemove: (id: string) => void
  disabled?: boolean
  maxFiles?: number
  label?: string
  helperText?: string
}

export function FileTypeIcon({ kind, className = "size-4" }: { kind: ReturnType<typeof getFileIconKind>; className?: string }) {
  switch (kind) {
    case "pdf":
      return <FileText className={`${className} text-red-500`} />
    case "word":
      return <FileText className={`${className} text-blue-500`} />
    case "sheet":
      return <FileSpreadsheet className={`${className} text-emerald-600`} />
    case "slide":
      return <Presentation className={`${className} text-orange-500`} />
    case "image":
      return <FileImage className={`${className} text-violet-500`} />
    default:
      return <FileIcon className={`${className} text-slate-450`} />
  }
}

// Reusable multi-file drag & drop uploader . Deliberately generic
// (not perk-specific) -- accepts the same expanded document format set
// (PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX/PNG/JPG/JPEG/WEBP) that
// upload.middleware.ts's perkDocumentFilter enforces server-side, and does
// the same client-side type/size validation up front so a rejected file
// never even attempts the multipart request.
export function SupportingDocumentsUploader({
  documents,
  onFilesSelected,
  onRemove,
  disabled = false,
  maxFiles = 10,
  label = "Supporting Documents",
  helperText = "PDF, Word, Excel, PowerPoint, PNG, JPG, or WEBP. Up to 10MB each.",
}: SupportingDocumentsUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndAdd = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList)
    if (incoming.length === 0) return

    const remainingSlots = maxFiles - documents.length
    if (remainingSlots <= 0) {
      toast.error(`You can attach up to ${maxFiles} documents.`)
      return
    }

    const valid: File[] = []
    incoming.slice(0, remainingSlots).forEach((file) => {
      if (!SUPPORTING_DOCUMENT_MIME_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" isn't a supported file type.`)
        return
      }
      if (file.size > MAX_SUPPORTING_DOCUMENT_SIZE) {
        toast.error(`"${file.name}" exceeds the 10MB size limit.`)
        return
      }
      valid.push(file)
    })

    if (incoming.length > remainingSlots) {
      toast.error(`Only ${remainingSlots} more document(s) can be attached (max ${maxFiles}).`)
    }

    if (valid.length > 0) onFilesSelected(valid)
  }

  return (
    <div className="space-y-2.5">
      {label && <span className="text-xs font-black text-slate-800 dark:text-slate-200">{label}</span>}

      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setIsDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          if (disabled) return
          if (e.dataTransfer.files?.length) validateAndAdd(e.dataTransfer.files)
        }}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900"
            : isDragging
            ? "cursor-pointer border-[#6B2C91] bg-violet-50 dark:border-pink-500 dark:bg-pink-950/10"
            : "cursor-pointer border-slate-250 bg-slate-50/50 hover:border-[#6B2C91] hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-pink-500 dark:hover:bg-slate-900"
        }`}
      >
        <div className="rounded-full bg-white p-2.5 text-slate-400 shadow-sm dark:bg-slate-800">
          <UploadCloud className="size-5" />
        </div>
        <p className="text-xs font-black text-slate-700 dark:text-slate-300">
          Drag & drop files here, or <span className="text-[#6B2C91] dark:text-pink-300">browse</span>
        </p>
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">{helperText}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={SUPPORTING_DOCUMENT_ACCEPT}
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) validateAndAdd(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {documents.length > 0 && (
        <ul className="space-y-1.5">
          {documents.map((doc) => {
            const kind = getFileIconKind({ mimetype: doc.file.type, originalFilename: doc.file.name })
            return (
              <li
                key={doc.id}
                className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40"
              >
                <FileTypeIcon kind={kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">{doc.file.name}</p>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">{formatFileSize(doc.file.size)}</p>
                  {doc.status === "error" && (
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-red-500">
                      <AlertCircle className="size-3" />
                      {doc.errorMessage || "Upload failed"}
                    </p>
                  )}
                </div>
                {doc.status === "uploading" && <Loader2 className="size-4 shrink-0 animate-spin text-slate-400" />}
                {doc.status === "done" && <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />}
                {doc.status !== "uploading" && (
                  <button
                    type="button"
                    onClick={() => onRemove(doc.id)}
                    disabled={disabled}
                    className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500 disabled:pointer-events-none dark:hover:bg-slate-800"
                    aria-label={`Remove ${doc.file.name}`}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default SupportingDocumentsUploader
