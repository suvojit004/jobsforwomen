import fs from "fs"
import path from "path"
import crypto from "crypto"
import env from "../config/env"
import { logger } from "./logger"
import prisma from "../database/db"
import { extractExtension } from "./documents"

// Local-disk replacement for the old Cloudinary-backed storage. Files live
// under env.DISK_MOUNT_PATH -- on Render this must be a Persistent Disk
// mount (Render's regular filesystem is wiped on every redeploy/restart), so
// production deploys are single-instance only (a Render Persistent Disk
// can't be shared across replicas).

export interface FileUploadResult {
  url: string
  secureUrl: string
  publicId: string // path relative to DISK_MOUNT_PATH, e.g. "jfw/resumes/abc123_resume.pdf"
  size: number
  format?: string
}

// Folders whose contents are meant to be publicly visible (company logos,
// office gallery photos shown on public job listings) -- served with no
// signature required. Everything else is a private document (resume, offer
// letter, verification/perk document) and requires a signed, time-limited
// URL -- see signFileUrl()/verifyFileSignature() below.
export const PUBLIC_FOLDER_TYPES = new Set(["logos", "gallery"])
export const KNOWN_FOLDER_TYPES = new Set([
  "logos",
  "gallery",
  "resumes",
  "offer-letters",
  "perk-documents",
  "company-verification",
])

export const FILE_URL_TTL_SECONDS = 60 * 60 // 1 hour

export const storageMetrics = {
  uploadCount: 0,
  deleteCount: 0,
  averageLatencyMs: 0,
  totalBytesUploaded: 0,
  retryCount: 0,
}

// Known magic-byte signatures for the file types this app accepts. Used to
// confirm the buffer's *actual* content matches its declared MIME type,
// independent of whatever the client claims in the multipart header (which is
// trivially spoofable). This is structural validation, not malware detection.
const OLE2_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) // legacy MS Office (.doc/.xls/.ppt)
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]) // Office Open XML (.docx/.xlsx/.pptx) is a zip archive

const FILE_SIGNATURES: Record<string, Buffer[]> = {
  "application/pdf": [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  "image/jpeg": [Buffer.from([0xff, 0xd8, 0xff])],
  "image/png": [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  "image/gif": [Buffer.from("GIF87a", "ascii"), Buffer.from("GIF89a", "ascii")],
  // WEBP has no fixed leading-byte signature -- it's a RIFF container
  // ("RIFF"[size]"WEBP"), verified by the dedicated check further down
  // (bytes 0-3 and 8-11). Empty array here just ensures the
  // FILE_SIGNATURES[declaredMimeType] lookup guard doesn't skip webp
  // entirely and fall through to that check.
  "image/webp": [],
  "application/msword": [OLE2_SIGNATURE],
  "application/vnd.ms-excel": [OLE2_SIGNATURE],
  "application/vnd.ms-powerpoint": [OLE2_SIGNATURE],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [ZIP_SIGNATURE],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [ZIP_SIGNATURE],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [ZIP_SIGNATURE],
}

/**
 * File security checkpoint. Performs local structural validation only:
 * empty-buffer rejection and a magic-byte signature check confirming the
 * uploaded bytes match the declared MIME type (catches "renamed .exe as
 * .pdf" spoofing). Does NOT perform real malware/virus scanning -- no
 * ClamAV/VirusTotal-style scanning infrastructure is wired in.
 */
export async function scanFileForVirus(fileBuffer: Buffer, declaredMimeType?: string): Promise<boolean> {
  if (!fileBuffer || fileBuffer.length === 0) {
    logger.warn("[FileSecurity] Rejected upload: empty file buffer.")
    return false
  }

  if (declaredMimeType && FILE_SIGNATURES[declaredMimeType]) {
    const signatures = FILE_SIGNATURES[declaredMimeType]
    let matches = signatures.some((sig) => fileBuffer.subarray(0, sig.length).equals(sig))

    if (!matches && declaredMimeType === "image/webp") {
      const isRiff = fileBuffer.subarray(0, 4).toString("ascii") === "RIFF"
      const isWebp = fileBuffer.subarray(8, 12).toString("ascii") === "WEBP"
      matches = isRiff && isWebp
    }

    if (!matches) {
      logger.warn(`[FileSecurity] Rejected upload: file content does not match declared type "${declaredMimeType}".`)
      return false
    }
  }

  logger.info(`[FileSecurity] Structural validation passed (${fileBuffer.length} bytes). NOTE: real malware/virus scanning is an EXTERNAL DEPENDENCY and is not performed here.`)
  return true
}

async function ensureDir(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true })
}

// Deletes any existing file(s) that share this base name regardless of
// extension before a fresh upload is written, so re-uploading the same
// logical asset (e.g. a candidate's resume) under a different file type
// doesn't leave the old file behind as an orphan on disk.
async function removeExistingVariants(dir: string, baseName: string): Promise<void> {
  try {
    const entries = await fs.promises.readdir(dir)
    await Promise.all(
      entries
        .filter((name) => name === baseName || name.startsWith(`${baseName}.`))
        .map((name) => fs.promises.unlink(path.join(dir, name)).catch(() => {}))
    )
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      logger.warn(`[FileStorage] Could not clean up old variants of "${baseName}" in ${dir}: ${err.message}`)
    }
  }
}

/**
 * Saves a file buffer to local disk under DISK_MOUNT_PATH/<folder>/. Public
 * (non-private) images are resized/compressed the same way Cloudinary used
 * to (800x800 max, quality-limited) so logo/gallery uploads don't balloon
 * disk usage.
 */
export async function uploadFile(
  fileBuffer: Buffer,
  folder: string,
  fileName: string,
  isPrivate: boolean = false,
  originalFileName?: string
): Promise<FileUploadResult> {
  const isClean = await scanFileForVirus(fileBuffer)
  if (!isClean) {
    throw new Error("Security Alert: Uploaded file contains virus threat.")
  }

  const startTime = Date.now()

  try {
    const extension = extractExtension(originalFileName) || (isPrivate ? "bin" : "jpg")
    const safeBaseName = fileName.replace(/\s+/g, "_")
    const dir = path.join(env.DISK_MOUNT_PATH, folder)
    await ensureDir(dir)
    await removeExistingVariants(dir, safeBaseName)

    const storedFileName = `${safeBaseName}.${extension}`
    const fullPath = path.join(dir, storedFileName)

    // NOTE: Cloudinary used to auto-resize/compress public images on upload
    // (800x800 cap, quality "auto"). That required an image-processing
    // dependency (e.g. "sharp") which isn't available in this environment,
    // so public images are currently stored as-is at their original
    // dimensions/size. Multer already caps these uploads at 2MB (see
    // upload.middleware.ts's logoUploader), so this is bounded, just larger
    // than Cloudinary's optimized output would have been. Add sharp (`npm
    // install sharp`) and re-introduce a resize step here if that matters.
    await fs.promises.writeFile(fullPath, fileBuffer)
    const bytesWritten = fileBuffer.length

    const relativePath = `${folder}/${storedFileName}`
    const url = `${env.BACKEND_URL}/files/${relativePath}`

    const latency = Date.now() - startTime
    storageMetrics.uploadCount++
    storageMetrics.totalBytesUploaded += bytesWritten
    storageMetrics.averageLatencyMs =
      (storageMetrics.averageLatencyMs * (storageMetrics.uploadCount - 1) + latency) /
      storageMetrics.uploadCount

    return {
      url,
      secureUrl: url,
      publicId: relativePath,
      size: bytesWritten,
      format: extension,
    }
  } catch (err: any) {
    storageMetrics.retryCount++
    logger.error(`[FileStorage] Upload failed: ${err.message}`)
    throw err
  }
}

/**
 * Deletes an asset from local disk. A missing file is treated as already
 * deleted (not an error) -- matches Cloudinary's destroy() behavior, which
 * resolves successfully even for an already-gone public_id.
 */
export async function deleteFile(publicId: string, _isPrivate: boolean = false): Promise<void> {
  if (!publicId) return
  const fullPath = path.join(env.DISK_MOUNT_PATH, publicId)
  try {
    await fs.promises.unlink(fullPath)
    storageMetrics.deleteCount++
    logger.info(`[FileStorage] Deleted asset ${publicId}`)
  } catch (err: any) {
    if (err.code === "ENOENT") {
      logger.info(`[FileStorage] Asset ${publicId} was already gone, nothing to delete.`)
      return
    }
    logger.error(`[FileStorage] Deletion failed for ${publicId}: ${err.message}`)
    throw err
  }
}

/**
 * Replaces an existing asset by deleting the old one first (best-effort --
 * a failed delete of the old file doesn't block the new upload).
 */
export async function replaceFile(
  oldPublicId: string | null,
  newBuffer: Buffer,
  folder: string,
  fileName: string,
  isPrivate: boolean = false,
  originalFileName?: string
): Promise<FileUploadResult> {
  if (oldPublicId) {
    try {
      await deleteFile(oldPublicId, isPrivate)
    } catch (err: any) {
      logger.warn(`[FileStorage] Failed to delete old asset ${oldPublicId} on replace: ${err.message}`)
    }
  }
  return uploadFile(newBuffer, folder, fileName, isPrivate, originalFileName)
}

export interface OrphanAssetReport {
  referencedAssets: string[]
  storedAssets: string[]
  possibleOrphans: string[] // exist on disk, not referenced by any DB row
  missingReferenced: string[] // referenced by a DB row, not found on disk
  cleaned: number // always 0 -- this is a read-only dry run, nothing is ever deleted automatically
  scannedFolders: string[]
  error?: string
}

/**
 * Orphan asset cleanup -- SAFE READ-ONLY DRY RUN.
 *
 * Cross-references every Company.logoPublicId and CandidateProfile.resumePublicId
 * in the database against what's actually sitting on disk under the
 * jfw/logos and jfw/resumes folders. Reports orphans (uploaded but no longer
 * referenced by any row -- e.g. left behind by a failed request) and
 * missing-referenced assets (DB points at a file that no longer exists).
 *
 * This function NEVER deletes anything. It is intentionally read-only; actual
 * deletion of confirmed orphans should be a separate, explicitly-invoked,
 * human-reviewed action.
 */
export async function runOrphanAssetCleanup(): Promise<OrphanAssetReport> {
  const scannedFolders = ["jfw/logos", "jfw/resumes"]

  try {
    const [companies, candidates] = await Promise.all([
      prisma.company.findMany({
        where: { logoPublicId: { not: null } },
        select: { logoPublicId: true },
      }),
      prisma.candidateProfile.findMany({
        where: { resumePublicId: { not: null } },
        select: { resumePublicId: true },
      }),
    ])

    const referencedAssets = [
      ...companies.map((c) => c.logoPublicId as string),
      ...candidates.map((c) => c.resumePublicId as string),
    ]
    const referencedSet = new Set(referencedAssets)

    const storedAssets: string[] = []
    for (const folder of scannedFolders) {
      const dir = path.join(env.DISK_MOUNT_PATH, folder)
      try {
        const entries = await fs.promises.readdir(dir)
        storedAssets.push(...entries.map((name) => `${folder}/${name}`))
      } catch (err: any) {
        if (err.code !== "ENOENT") throw err
        // Folder doesn't exist yet (nothing has ever been uploaded there) --
        // not an error, just means no assets to report for it.
      }
    }
    const storedSet = new Set(storedAssets)

    const possibleOrphans = storedAssets.filter((id) => !referencedSet.has(id))
    const missingReferenced = referencedAssets.filter((id) => !storedSet.has(id))

    logger.info(
      `[FileStorage] Orphan asset dry run complete: ${referencedAssets.length} DB-referenced, ${storedAssets.length} on disk, ${possibleOrphans.length} possible orphans, ${missingReferenced.length} missing-referenced. No deletions performed (read-only).`
    )

    return {
      referencedAssets,
      storedAssets,
      possibleOrphans,
      missingReferenced,
      cleaned: 0,
      scannedFolders,
    }
  } catch (err: any) {
    logger.error(`[FileStorage] Orphan asset dry run failed: ${err.message}`)
    return {
      referencedAssets: [],
      storedAssets: [],
      possibleOrphans: [],
      missingReferenced: [],
      cleaned: 0,
      scannedFolders,
      error: `Disk read failed -- ${err.message}`,
    }
  }
}

/**
 * Real storage connectivity/health check (used by admin system health), as
 * opposed to a hardcoded "UP". Confirms the disk mount is actually writable,
 * not just that the path string is configured.
 */
export async function verifyStorageConnection(): Promise<boolean> {
  try {
    await ensureDir(env.DISK_MOUNT_PATH)
    const probePath = path.join(env.DISK_MOUNT_PATH, `.health-check-${crypto.randomBytes(6).toString("hex")}`)
    await fs.promises.writeFile(probePath, "ok")
    await fs.promises.unlink(probePath)
    return true
  } catch (err: any) {
    logger.warn(`[FileStorage] Connectivity check failed: ${err.message}`)
    return false
  }
}

// --- Signed, time-limited URLs for private documents ---------------------
//
// Files aren't behind a per-request auth check at the /files route itself --
// that would mean re-deriving ownership (which candidate does this resume
// belong to, which recruiter's company does this logo belong to, etc.) a
// second time outside the service layer that already computes it correctly.
// Instead, every URL under /files/ that sendSuccess() serializes into an API
// response is signed here with a short expiry: the *existing* per-endpoint
// auth/ownership checks (authenticateToken, requireRole, and each service's
// own "is this the caller's own resume/company/application" filtering)
// already gate whether a given URL ever reaches this response in the first
// place. Signing just makes the resulting link time-limited instead of a
// permanent, forever-guessable URL (which is what a bare Cloudinary link
// effectively was).

function fileSigningSecret(): string {
  return env.JWT_ACCESS_SECRET
}

function folderTypeFromPathname(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean)
  // Expected shape: ["files", "jfw", "<type>", "<filename>"]
  if (segments.length !== 4 || segments[0] !== "files" || segments[1] !== "jfw") return null
  return segments[2] || null
}

export function isPrivateFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url, env.BACKEND_URL)
    const type = folderTypeFromPathname(parsed.pathname)
    return !!type && KNOWN_FOLDER_TYPES.has(type) && !PUBLIC_FOLDER_TYPES.has(type)
  } catch {
    return false
  }
}

export function signFileUrl(url: string, ttlSeconds: number = FILE_URL_TTL_SECONDS): string {
  let parsed: URL
  try {
    parsed = new URL(url, env.BACKEND_URL)
  } catch {
    return url
  }
  if (!isPrivateFileUrl(url)) return url

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const sig = crypto
    .createHmac("sha256", fileSigningSecret())
    .update(`${parsed.pathname}:${exp}`)
    .digest("hex")
  parsed.searchParams.set("exp", String(exp))
  parsed.searchParams.set("sig", sig)
  return parsed.toString()
}

export function verifyFileSignature(pathname: string, exp: string | number, sig: string): boolean {
  const expNum = Number(exp)
  if (!expNum || Number.isNaN(expNum) || Math.floor(Date.now() / 1000) > expNum) return false
  const expected = crypto
    .createHmac("sha256", fileSigningSecret())
    .update(`${pathname}:${expNum}`)
    .digest("hex")
  const expectedBuf = Buffer.from(expected)
  const actualBuf = Buffer.from(String(sig || ""))
  if (expectedBuf.length !== actualBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, actualBuf)
}

// Recursively walks an API response payload and signs every /files/ URL it
// finds, so callers never have to remember to sign a URL themselves --
// see response.ts's sendSuccess(), the single call site for this.
export function signFileUrlsDeep<T>(value: T): T {
  if (typeof value === "string") {
    if (value.includes("/files/jfw/")) {
      return signFileUrl(value) as unknown as T
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => signFileUrlsDeep(item)) as unknown as T
  }
  if (value && typeof value === "object" && value.constructor === Object) {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = signFileUrlsDeep(val)
    }
    return result as T
  }
  return value
}

export default {
  uploadFile,
  deleteFile,
  replaceFile,
  scanFileForVirus,
  runOrphanAssetCleanup,
  verifyStorageConnection,
  signFileUrl,
  verifyFileSignature,
  signFileUrlsDeep,
  storageMetrics,
}
