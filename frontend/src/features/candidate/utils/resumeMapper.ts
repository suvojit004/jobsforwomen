export interface NormalizedResume {
  name: string
  uploadDate: string
  // Renamed from `verified` -- this was always set to `true` the instant a
  // resume existed and `false` otherwise (see below), so it was never a real
  // verification flag, just "has resume" under a misleading name. Resumes
  // aren't reviewed/verified by anyone on this platform, and the old field
  // fed a "Verified" badge on the candidate's own Dashboard that implied
  // otherwise.
  uploaded: boolean
  url: string
  publicId?: string
  size?: number
  mimetype?: string
  originalName?: string
  uploadedAt?: string
}

export function mapResumeData(
  resumeUrl: string | null | undefined,
  resumePublicId: string | null | undefined,
  resumeMetadataRaw: any
): NormalizedResume {
  if (!resumeUrl) {
    return {
      name: "",
      uploadDate: "",
      uploaded: false,
      url: "",
      publicId: "",
      size: 0,
      mimetype: "",
      originalName: "",
      uploadedAt: "",
    }
  }

  let resumeMeta = resumeMetadataRaw || {}
  if (typeof resumeMeta === "string") {
    try {
      resumeMeta = JSON.parse(resumeMeta)
    } catch {
      resumeMeta = {}
    }
  }

  const name = resumeMeta.originalName || resumeUrl.split("/").pop() || "Resume"
  const uploadDate = resumeMeta.uploadedAt
    ? new Date(resumeMeta.uploadedAt).toLocaleDateString()
    : ""

  return {
    name,
    uploadDate,
    uploaded: true,
    url: resumeUrl,
    publicId: resumePublicId || "",
    size: resumeMeta.size || 0,
    mimetype: resumeMeta.mimetype || "",
    originalName: resumeMeta.originalName || "",
    uploadedAt: resumeMeta.uploadedAt || "",
  }
}
