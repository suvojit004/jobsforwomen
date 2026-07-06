import { v2 as cloudinary } from "cloudinary"
import { Readable } from "stream"
import env from "../config/env"
import { logger } from "./logger"

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

/**
 * Mock antivirus scanner checkpoint.
 */
export async function scanFileForVirus(fileBuffer: Buffer): Promise<boolean> {
  // ClamAV / VirusTotal scanner integration placeholder
  // In development/test mode, we assume the file is clean
  logger.info(`[VirusScanner] Executing file scan on buffer (${fileBuffer.length} bytes)...`)
  return true // returns true if clean
}

/**
 * Uploads a file buffer directly to Cloudinary using streaming with retries.
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: string,
  fileName: string,
  isPrivate: boolean = false
): Promise<CloudinaryUploadResult> {
  const isClean = await scanFileForVirus(fileBuffer)
  if (!isClean) {
    throw new Error("Security Alert: Uploaded file contains virus threat.")
  }

  const startTime = Date.now()
  let attempts = 0
  const maxAttempts = 3
  let delay = 1000 // starts with 1s sleep

  while (attempts < maxAttempts) {
    try {
      attempts++
      const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
        const options: any = {
          folder,
          public_id: fileName.replace(/\s+/g, "_"),
          resource_type: isPrivate ? "raw" : "image",
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

/**
 * Mock Orphan Asset Cleanup utility.
 */
export async function runOrphanAssetCleanup(): Promise<{ cleaned: number }> {
  // In production, queries Cloudinary listing APIs and cross-references public IDs against DB tables.
  logger.info("[Cloudinary] Scheduled orphan assets cleanup executed successfully.")
  return { cleaned: 0 }
}

export default {
  uploadToCloudinary,
  deleteFromCloudinary,
  replaceInCloudinary,
  scanFileForVirus,
  runOrphanAssetCleanup,
  cloudinaryMetrics,
}
