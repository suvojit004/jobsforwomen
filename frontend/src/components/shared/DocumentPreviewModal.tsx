import { X, ExternalLink, Download } from "lucide-react"
import { FileTypeIcon } from "@/components/shared/forms/SupportingDocumentsUploader"
import {
  type PreviewableDocument,
  getPreviewAction,
  getFileIconKind,
  getFileExtension,
  buildFileDownloadUrl,
  buildGoogleViewerUrl,
  isPubliclyReachableUrl,
} from "@/utils/fileHelpers"

interface DocumentPreviewModalProps {
  // null means "closed" -- callers hold this in local state and pass the
  // clicked document straight through instead of a separate open/doc pair.
  doc: (PreviewableDocument & { title?: string }) | null
  onClose: () => void
}

// Single reusable in-app viewer for every document surface in the app
// (resume, company verification docs, perk supporting docs, offer letters).
// Previously every one of these opened window.open(url, "_blank") --
// functional, but it left the app entirely (no in-app preview at all), and
// silently did nothing when the browser's popup blocker caught it (see
// Applicants.tsx/CandidatePreview.tsx's resume-download fix for that
// failure mode). Images and PDFs render inline via <img>/<iframe>, which
// sidesteps the popup-blocker problem entirely since neither uses
// window.open. DOC/DOCX/XLS/XLSX/PPT/PPTX have no native browser renderer,
// so those route through Google Docs Viewer (an <iframe> embed that fetches
// the file server-side on Google's end) -- which only works once the app has
// a real public URL, so local dev falls back to an honest download state.
export function DocumentPreviewModal({ doc, onClose }: DocumentPreviewModalProps) {
  if (!doc) return null

  const action = getPreviewAction(doc.mimetype, doc.url)
  const displayName = doc.title || doc.originalFilename || doc.category || "Document"
  const ext = getFileExtension(doc)
  const downloadName = ext && !displayName.toLowerCase().endsWith(`.${ext}`) ? `${displayName}.${ext}` : displayName
  const downloadUrl = buildFileDownloadUrl(doc.url, downloadName)
  const canUseGoogleViewer = action === "office" && isPubliclyReachableUrl(doc.url)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${displayName}`}
    >
      <div
        className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <h3 className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
            <FileTypeIcon kind={getFileIconKind(doc)} className="size-4 shrink-0" />
            <span className="truncate">{displayName}</span>
          </h3>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Open in a new tab"
            >
              <ExternalLink className="size-3.5" />
            </a>
            <a
              href={downloadUrl}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Download"
            >
              <Download className="size-3.5" />
            </a>
            <button
              onClick={onClose}
              className="inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Close preview"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
          {action === "image" ? (
            <div className="flex min-h-full items-center justify-center p-4">
              <img src={doc.url} alt={displayName} className="max-h-full max-w-full rounded-lg object-contain shadow-sm" />
            </div>
          ) : action === "pdf" ? (
            <iframe src={doc.url} title={displayName} className="h-full w-full border-0" />
          ) : canUseGoogleViewer ? (
            <iframe src={buildGoogleViewerUrl(doc.url)} title={displayName} className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <FileTypeIcon kind={getFileIconKind(doc)} className="size-12" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Preview isn't available for this file type</p>
              <p className="max-w-xs text-xs font-semibold text-slate-450 dark:text-slate-400">
                {action === "office"
                  ? "Google Docs Viewer needs a publicly reachable link, which only works once the app is deployed -- not on a local dev server."
                  : `${ext ? `.${ext} files` : "This file"} can't be rendered in-browser.`}{" "}
                Download it to open in the right application.
              </p>
              <a
                href={downloadUrl}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#6B2C91] to-pink-600 px-4 py-2 text-xs font-bold text-white shadow-sm"
              >
                <Download className="size-3.5" />
                Download {displayName}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DocumentPreviewModal
