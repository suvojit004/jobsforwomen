import { Download, FileText, RefreshCw, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"

type ResumeCardProps = {
  resume?: {
    name: string
    uploadDate: string
    verified: boolean
  }
}

export function ResumeCard({ resume }: ResumeCardProps) {
  if (!resume) return null

  return (
    <DashboardCard className="p-4">
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

      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/55">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-[#6B2C91] dark:bg-violet-500/20 dark:text-pink-100">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-slate-950 dark:text-white">
            {resume.name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Uploaded on {resume.uploadDate}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button variant="outline" className="h-9 justify-center gap-1.5">
          <Upload className="size-3.5" />
          Upload
        </Button>
        <Button variant="outline" className="h-9 justify-center gap-1.5">
          <RefreshCw className="size-3.5" />
          Replace
        </Button>
        <Button className="h-9 justify-center gap-1.5 bg-[#6B2C91] hover:bg-[#5a237b]">
          <Download className="size-3.5" />
          Download
        </Button>
      </div>
    </DashboardCard>
  )
}
