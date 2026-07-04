import React, { useRef } from "react"
import { Upload, FileText, CheckCircle2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ResumeUploaderProps {
  label?: string
  fileName?: string
  uploadDate?: string
  isVerified?: boolean
  onUpload?: (file: File) => void
  onRemove?: () => void
  error?: string
}

export function ResumeUploader({
  label = "Upload Resume Attachment",
  fileName,
  uploadDate,
  isVerified = false,
  onUpload,
  onRemove,
  error,
}: ResumeUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onUpload) {
      onUpload(file)
    }
  }

  const triggerUpload = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-1.5 w-full col-span-2 select-none">
      {label && (
        <span className="text-xs font-black text-slate-800 dark:text-slate-200">
          {label}
        </span>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx"
        className="hidden"
      />

      {fileName ? (
        <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400 shrink-0">
              <FileText className="size-5.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                  {fileName}
                </span>
                {isVerified && (
                  <CheckCircle2 className="size-4 text-emerald-500 fill-emerald-500/10 shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-semibold dark:text-slate-500 mt-0.5">
                {uploadDate ? `Uploaded on ${uploadDate}` : "Verified PDF document"}
              </p>
            </div>
          </div>

          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-8 w-8 text-slate-400 hover:text-red-500"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ) : (
        <div
          onClick={triggerUpload}
          className="border-2 border-dashed border-slate-250 dark:border-slate-800 hover:border-[#6B2C91] dark:hover:border-pink-500 transition-colors rounded-xl p-6 text-center bg-slate-50/50 hover:bg-white dark:bg-slate-900/50 dark:hover:bg-slate-900 cursor-pointer flex flex-col items-center justify-center space-y-2 group"
        >
          <div className="p-2.5 rounded-full bg-white dark:bg-slate-800 text-slate-400 group-hover:text-[#6B2C91] dark:group-hover:text-pink-400 shadow-sm transition-colors">
            <Upload className="size-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-black text-slate-700 group-hover:text-slate-900 dark:text-slate-350 dark:group-hover:text-white">
              Drag & drop or Click to Browse
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
              Supports PDF, DOC, DOCX up to 5MB
            </p>
          </div>
        </div>
      )}

      {error && <span className="text-[10px] font-bold text-red-500">{error}</span>}
    </div>
  )
}
export default ResumeUploader
