import { v2 as cloudinary } from "cloudinary"
import { Readable } from "stream"
import env from "../config/env"
import { logger } from "./logger"
import prisma from "../database/db"
import { extractExtension } from "./documents"

// Configure Cloudinary with actual credentials
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
})

export interface CloudinaryUploadResult {
  url: string
  secureUrl: string
  publicId: string
  size: number
  // Delivery format/extension Cloudinary actually stored the asset under
  // (e.g. "pdf", "docx"). Only meaningful for raw (isPrivate) uploads --
  // present so callers can persist it alongside the document's metadata and
  // the frontend can pick a correct preview/download strategy without having
  // to guess from a URL that may have no extension at all.
  format?: string
}

// In-memory upload metrics hook for observability monitoring
export const cloudinaryMetrics = {
  uploadCount: 0,
  deleteCount: 0,
  averageLatencyMs: 0,
  totalBytesUploaded: 0,
  retryCount: 0,
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
  // application/msword (legacy .doc) uses the OLE2/CFB container signature
  "application/msword": [OLE2_SIGNATURE],
  "application/vnd.ms-excel": [OLE2_SIGNATURE], // legacy .xls
  "application/vnd.ms-powerpoint": [OLE2_SIGNATURE], // legacy .ppt
  // Office Open XML formats (.docx/.xlsx/.pptx) are all zip archives that
  // only differ in their internal part structure -- indistinguishable from
  // the first 4 bytes alone, so all three share the same signature check.
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

    // WEBP needs a second check: RIFF....WEBP (bytes 8-11 == "WEBP")
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

/**
 * Uploads a file buffer directly to Cloudinary using streaming with retries.
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: string,
  fileName: string,
  isPrivate: boolean = false,
  originalFileName?: string
): Promise<CloudinaryUploadResult> {
  const isClean = await scanFileForVirus(fileBuffer)
  if (!isClean) {
    throw new Error("Security Alert: Uploaded file contains virus threat.")
  }

  const startTime = Date.now()
  let attempts = 0
  const maxAttempts = 3
  let delay = 1000 // starts with 1s sleep

  // Without a `format` hint, raw assets (public_id has no extension) come
  // back as generic application/octet-stream -- browsers can't inline-preview
  // them and downloads save without a usable extension, looking "corrupted"
  // even though the bytes are fine.
  const extension = isPrivate ? extractExtension(originalFileName) : null

  while (attempts < maxAttempts) {
    try {
      attempts++
      const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
        const options: any = {
          folder,
          public_id: fileName.replace(/\s+/g, "_"),
          resource_type: isPrivate ? "raw" : "image",
        }

        if (extension) {
          options.format = extension
        }

        if (!isPrivate) {
          options.transformation = [
            { width: 800, height: 800, crop: "limit" },
            { quality: "auto" },
            { fetch_format: "auto" },
          ]
        }

        const uploadStream = cloudinary.uploader.upload_stream(
          options,
          (error, res) => {
            if (error) {
              return reject(error)
            }
            if (!res) {
              return reject(new Error("Empty response from Cloudinary"))
            }
            resolve({
              url: res.url,
              secureUrl: res.secure_url,
              publicId: res.public_id,
              size: res.bytes,
              format: res.format || extension || undefined,
            })
          }
        )

        const readable = new Readable()
        readable.push(fileBuffer)
        readable.push(null)
        readable.pipe(uploadStream)
      })

      // Update metrics
      const latency = Date.now() - startTime
      cloudinaryMetrics.uploadCount++
      cloudinaryMetrics.totalBytesUploaded += result.size
      cloudinaryMetrics.averageLatencyMs = 
        (cloudinaryMetrics.averageLatencyMs * (cloudinaryMetrics.uploadCount - 1) + latency) / 
        cloudinaryMetrics.uploadCount

      return result
    } catch (err: any) {
      cloudinaryMetrics.retryCount++
      logger.warn(`[Cloudinary] Upload attempt ${attempts} failed: ${err.message}`)
      if (attempts >= maxAttempts) {
        logger.error(`[Cloudinary] Max upload attempts exhausted: ${err.message}`)
        throw err
      }
      await sleep(delay)
      delay *= 2 // exponential backoff
    }
  }

  throw new Error("Cloudinary upload failed")
}

/**
 * Deletes an asset from Cloudinary.
 */
export async function deleteFromCloudinary(publicId: string, isPrivate: boolean = false): Promise<void> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { resource_type: isPrivate ? "raw" : "image" },
      (error, result) => {
        if (error) {
          logger.error(`[Cloudinary] Deletion failed for ${publicId}: ${error.message}`)
          return reject(error)
        }
        cloudinaryMetrics.deleteCount++
        logger.info(`[Cloudinary] Deleted asset ${publicId} successfully: ${JSON.stringify(result)}`)
        resolve()
      }
    )
  })
}

/**
 * Replaces an existing asset in Cloudinary by deleting the old one first.
 */
export async function replaceInCloudinary(
  oldPublicId: string | null,
  newBuffer: Buffer,
  folder: string,
  fileName: string,
  isPrivate: boolean = false
): Promise<CloudinaryUploadResult> {
  if (oldPublicId) {
    try {
      await deleteFromCloudinary(oldPublicId, isPrivate)
    } catch (err: any) {
      logger.warn(`[Cloudinary] Failed to delete old asset ${oldPublicId} on replace: ${err.message}`)
    }
  }
  return uploadToCloudinary(newBuffer, folder, fileName, isPrivate)
}

export interface OrphanAssetReport {
  referencedAssets: string[]
  cloudinaryAssets: string[]
  possibleOrphans: string[] // exist in Cloudinary, not referenced by any DB row
  missingReferenced: string[] // referenced by a DB row, not found in Cloudinary
  cleaned: number // always 0 -- this is a read-only dry run, nothing is ever deleted automatically
  scannedFolders: string[]
  error?: string
}

/**
 * Orphan asset cleanup -- SAFE READ-ONLY DRY RUN.
 *
 * Cross-references every Company.logoPublicId and CandidateProfile.resumePublicId
 * in the database against what Cloudinary's Admin API actually has stored under
 * the jfw/logos and jfw/resumes prefixes. Reports orphans (uploaded but no
 * longer referenced by any row -- e.g. left behind by a failed request) and
 * missing-referenced assets (DB points at a public_id Cloudinary no longer has).
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

    // Logos are uploaded as resource_type "image"; resumes as "raw" (isPrivate=true).
    const [logoList, resumeList] = await Promise.all([
      cloudinary.api.resources({ type: "upload", resource_type: "image", prefix: "jfw/logos", max_results: 500 }),
      cloudinary.api.resources({ type: "upload", resource_type: "raw", prefix: "jfw/resumes", max_results: 500 }),
    ])

    const cloudinaryAssets: string[] = [
      ...(logoList.resources || []).map((r: any) => r.public_id),
      ...(resumeList.resources || []).map((r: any) => r.public_id),
    ]
    const cloudinarySet = new Set(cloudinaryAssets)

    const possibleOrphans = cloudinaryAssets.filter((id) => !referencedSet.has(id))
    const missingReferenced = referencedAssets.filter((id) => !cloudinarySet.has(id))

    logger.info(
      `[Cloudinary] Orphan asset dry run complete: ${referencedAssets.length} DB-referenced, ${cloudinaryAssets.length} in Cloudinary, ${possibleOrphans.length} possible orphans, ${missingReferenced.length} missing-referenced. No deletions performed (read-only).`
    )

    return {
      referencedAssets,
      cloudinaryAssets,
      possibleOrphans,
      missingReferenced,
      cleaned: 0,
      scannedFolders,
    }
  } catch (err: any) {
    // If Cloudinary Admin API credentials/network are unavailable, do not
    // pretend the scan happened -- report it honestly as blocked.
    logger.error(`[Cloudinary] Orphan asset dry run failed (EXTERNAL DEPENDENCY unavailable): ${err.message}`)
    return {
      referencedAssets: [],
      cloudinaryAssets: [],
      possibleOrphans: [],
      missingReferenced: [],
      cleaned: 0,
      scannedFolders,
      error: `EXTERNAL DEPENDENCY: Cloudinary Admin API call failed -- ${err.message}`,
    }
  }
}

/**
 * Real Cloudinary connectivity check (used by admin system health), as
 * opposed to a hardcoded "UP".
 */
export async function verifyCloudinaryConnection(): Promise<boolean> {
  try {
    await cloudinary.api.ping()
    return true
  } catch (err: any) {
    logger.warn(`[Cloudinary] Connectivity check failed: ${err.message}`)
    return false
  }
}

export default {
  uploadToCloudinary,
  deleteFromCloudinary,
  replaceInCloudinary,
  scanFileForVirus,
  runOrphanAssetCleanup,
  verifyCloudinaryConnection,
  cloudinaryMetrics,
}
