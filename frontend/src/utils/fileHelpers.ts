// Shared helpers for every place in the app that lists uploaded documents
// (recruiter Perks.tsx, admin CompanyPerkRequests.tsx / CompanyDetails.tsx,
// the public CompanyVerification.tsx resubmission form). Centralizing this
// avoids re-implementing "which icon for this mimetype" or "should this open
// inline or download" per page -- and is the actual fix for the Company
// Approval "More Information" viewer forcing a broken download for every
// file regardless of type : a plain `<a href>` has no way to decide
// that, this module does.

export type PreviewAction = "image" | "pdf" | "download"

// Mirrors upload.middleware.ts's perkDocumentFilter / fileStorage.ts's
// FILE_SIGNATURES allow-list on the backend.
export const SUPPORTING_DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp," +
  "application/pdf,application/msword," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.ms-excel," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
  "application/vnd.ms-powerpoint," +
  "application/vnd.openxmlformats-officedocument.presentationml.presentation," +
  "image/png,image/jpeg,image/webp"

export const SUPPORTING_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]

export const MAX_SUPPORTING_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10 MB, matches backend upload.middleware.ts MAX_SIZE

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size % 1 === 0 ? size : size.toFixed(1)} ${units[unitIndex]}`
}

// Best-effort extension, preferring the stored original filename (present on
// documents uploaded after this fix shipped) and falling back to sniffing
// the URL's path for older/legacy records that never had one stored.
export function getFileExtension(doc: { originalFilename?: string | null; url?: string | null; format?: string | null }): string {
  if (doc.format) return doc.format.toLowerCase()
  const name = doc.originalFilename || doc.url || ""
  const match = /\.([a-zA-Z0-9]+)(?:$|\?)/.exec(name)
  return match ? match[1].toLowerCase() : ""
}

const ICON_BY_EXTENSION: Record<string, "pdf" | "word" | "sheet" | "slide" | "image" | "file"> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  xls: "sheet",
  xlsx: "sheet",
  csv: "sheet",
  ppt: "slide",
  pptx: "slide",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
}

// Returns a short category key rather than a component so this stays a
// framework-agnostic .ts helper -- callers map the key to a lucide-react
// icon (see FileTypeIcon in SupportingDocumentsUploader.tsx).
export function getFileIconKind(doc: { mimetype?: string | null; originalFilename?: string | null; url?: string | null; format?: string | null }): "pdf" | "word" | "sheet" | "slide" | "image" | "file" {
  if (doc.mimetype?.startsWith("image/")) return "image"
  if (doc.mimetype === "application/pdf") return "pdf"
  const ext = getFileExtension(doc)
  return ICON_BY_EXTENSION[ext] || "file"
}

export function isPreviewableImage(mimetype?: string | null): boolean {
  return !!mimetype && mimetype.startsWith("image/")
}

export function isPreviewablePdf(mimetype?: string | null): boolean {
  return mimetype === "application/pdf"
}

// image/* -> inline preview, application/pdf -> open in browser, everything
// else -> download.
export function getPreviewAction(mimetype?: string | null): PreviewAction {
  if (isPreviewableImage(mimetype)) return "image"
  if (isPreviewablePdf(mimetype)) return "pdf"
  return "download"
}

// The backend's /files/... route (see backend/src/shared/routes/files.routes.ts)
// forces a real download with the given filename via Content-Disposition:
// attachment whenever a `dl` query param is present -- without it, the
// file is served inline (fine for PDFs/images opening in a new tab, but a
// download needs an explicit filename). Falls back to the untouched URL if
// it isn't parseable.
export function buildFileDownloadUrl(url: string, filename: string): string {
  try {
    const parsed = new URL(url, window.location.origin)
    parsed.searchParams.set("dl", filename.replace(/\//g, "_"))
    return parsed.toString()
  } catch {
    return url
  }
}

export interface PreviewableDocument {
  url: string
  mimetype?: string | null
  originalFilename?: string | null
  category?: string | null
  format?: string | null
}

// The single entry point every doc-listing page should call on click --
// decides preview vs. download and, for downloads, builds a URL that
// preserves the original filename/extension instead of handing the browser
// an extensionless raw URL.
export function openDocument(doc: PreviewableDocument) {
  const action = getPreviewAction(doc.mimetype)
  if (action === "image" || action === "pdf") {
    window.open(doc.url, "_blank", "noopener,noreferrer")
    return
  }
  const ext = getFileExtension(doc)
  const baseName = doc.originalFilename || doc.category || "document"
  const filename = ext && !baseName.toLowerCase().endsWith(`.${ext}`) ? `${baseName}.${ext}` : baseName
  const downloadUrl = buildFileDownloadUrl(doc.url, filename)
  window.open(downloadUrl, "_blank", "noopener,noreferrer")
}
