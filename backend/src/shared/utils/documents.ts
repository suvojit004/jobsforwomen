// Shared helper for the "append-only Json array of documents" shape used
// across the codebase (Company.verificationDocuments, Company.galleryImages,
// CompanyPerkRequest.documents -- see schema.prisma's comments on all three).
// These are all nullable Prisma `Json?` columns with no DB-level default, so
// a freshly-created row (or any row whose documents were never touched) reads
// back as `null`, not `[]`. Every read path that hands one of these arrays to
// a caller (frontend `.map()`/`.length`, or another service function) must
// normalize it through here rather than assuming Prisma/Postgres already
// guarantees an array -- it doesn't.
export function normalizeDocuments<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

// Extracts a filesystem-safe lowercase extension (no leading dot) from an
// original uploaded filename, e.g. "Leave Policy.PDF" -> "pdf". Returns null
// when the filename has no discernible extension so callers can fall back to
// mimetype-based logic instead.
export function extractExtension(originalName?: string | null): string | null {
  if (!originalName) return null
  const match = /\.([a-zA-Z0-9]+)$/.exec(originalName.trim())
  return match ? match[1].toLowerCase() : null
}

export default { normalizeDocuments, extractExtension }
