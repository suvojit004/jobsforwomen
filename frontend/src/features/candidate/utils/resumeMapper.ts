export interface NormalizedResume {
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

export function mapResumeData(
  resumeUrl: string | null | undefined,
  resumePublicId: string | null | undefined,
  resumeMetadataRaw: any
): NormalizedResume {
  if (!resumeUrl) {
    return {
      name: "",
      uploadDate: "",
      verified: false,
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
    verified: true,
    url: resumeUrl,
    publicId: resumePublicId || "",
    size: resumeMeta.size || 0,
    mimetype: resumeMeta.mimetype || "",
    originalName: resumeMeta.originalName || "",
    uploadedAt: resumeMeta.uploadedAt || "",
  }
}
