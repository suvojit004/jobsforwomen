// One-off migration: downloads every asset still pointed at Cloudinary
// (res.cloudinary.com) and re-saves it to local disk via fileStorage.ts,
// then rewrites the owning DB row's url/publicId fields to the new
// /files/... scheme. Needed because removing Cloudinary from the codebase
// only changes where NEW uploads go -- every file uploaded before that
// change is still sitting in Cloudinary and its DB row still points there.
//
// Usage (from backend/):
//   npx ts-node src/scripts/migrateCloudinaryToDisk.ts            # dry run, no writes
//   npx ts-node src/scripts/migrateCloudinaryToDisk.ts --apply    # actually migrates
//
// Safe to re-run: anything already migrated (its DB row already points at
// /files/...) is naturally skipped since it's no longer a cloudinary.com URL.
import path from "path"
import prisma from "../shared/database/db"
import { uploadFile } from "../shared/utils/fileStorage"
import { logger } from "../shared/utils/logger"

const DRY_RUN = !process.argv.includes("--apply")

interface MigrationStats {
  migrated: number
  skipped: number
  failed: number
}

interface DocLike {
  url?: string | null
  publicId?: string | null
  [key: string]: unknown
}

function isCloudinaryUrl(url?: string | null): url is string {
  return !!url && url.includes("res.cloudinary.com")
}

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
}

async function downloadAsset(url: string): Promise<{ buffer: Buffer; contentType: string | null }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  const arrayBuffer = await res.arrayBuffer()
  return { buffer: Buffer.from(arrayBuffer), contentType: res.headers.get("content-type") }
}

// Reuses the old Cloudinary public_id as the new local filename (so the
// mapping stays 1:1 and predictable), preferring whatever extension is
// already present on the old public_id/URL and falling back to the
// downloaded response's Content-Type.
function resolveNames(oldUrl: string, oldPublicId: string, contentType: string | null): { fileName: string; originalFilename: string } {
  const base = path.basename(oldPublicId).replace(/\.[a-zA-Z0-9]+$/, "") || `migrated_${Date.now()}`
  const fromPublicId = /\.([a-zA-Z0-9]+)$/.exec(oldPublicId)?.[1]
  const fromUrl = /\.([a-zA-Z0-9]+)(?:$|\?)/.exec(oldUrl)?.[1]
  const ext = fromPublicId || fromUrl || (contentType && CONTENT_TYPE_EXTENSION[contentType]) || "bin"
  return { fileName: base, originalFilename: `${base}.${ext}` }
}

async function migrateOne(
  oldUrl: string,
  oldPublicId: string,
  folder: string,
  isPrivate: boolean,
  stats: MigrationStats
): Promise<{ secureUrl: string; publicId: string } | null> {
  try {
    const { buffer, contentType } = await downloadAsset(oldUrl)
    const { fileName, originalFilename } = resolveNames(oldUrl, oldPublicId, contentType)

    if (DRY_RUN) {
      logger.info(`[Migrate][DRY RUN] Would migrate ${oldUrl} -> ${folder}/${fileName}.* (${buffer.length} bytes)`)
      stats.migrated++
      return null
    }

    const result = await uploadFile(buffer, folder, fileName, isPrivate, originalFilename)
    stats.migrated++
    logger.info(`[Migrate] Migrated ${oldUrl} -> ${result.publicId}`)
    return { secureUrl: result.secureUrl, publicId: result.publicId }
  } catch (err: any) {
    logger.error(`[Migrate] FAILED to migrate ${oldUrl}: ${err.message}`)
    stats.failed++
    return null
  }
}

async function migrateJsonArrayField(
  items: DocLike[],
  folder: string,
  isPrivate: boolean,
  stats: MigrationStats
): Promise<{ items: DocLike[]; changed: boolean }> {
  let changed = false
  const updated: DocLike[] = []
  for (const item of items) {
    if (!item || !isCloudinaryUrl(item.url) || !item.publicId) {
      updated.push(item)
      continue
    }
    const result = await migrateOne(item.url, item.publicId, folder, isPrivate, stats)
    if (result && !DRY_RUN) {
      updated.push({ ...item, url: result.secureUrl, publicId: result.publicId })
      changed = true
    } else {
      updated.push(item)
    }
  }
  return { items: updated, changed }
}

async function migrateCandidateResumes(stats: MigrationStats) {
  const rows = await prisma.candidateProfile.findMany({
    where: { resumeUrl: { contains: "res.cloudinary.com" } },
    select: { id: true, resumeUrl: true, resumePublicId: true },
  })
  for (const row of rows) {
    if (!row.resumeUrl || !row.resumePublicId) {
      stats.skipped++
      continue
    }
    const result = await migrateOne(row.resumeUrl, row.resumePublicId, "jfw/resumes", true, stats)
    if (result && !DRY_RUN) {
      await prisma.candidateProfile.update({
        where: { id: row.id },
        data: { resumeUrl: result.secureUrl, resumePublicId: result.publicId },
      })
    }
  }
}

async function migrateOfferLetters(stats: MigrationStats) {
  const rows = await prisma.application.findMany({
    where: { offerLetterUrl: { contains: "res.cloudinary.com" } },
    select: { id: true, offerLetterUrl: true, offerLetterPublicId: true },
  })
  for (const row of rows) {
    if (!row.offerLetterUrl || !row.offerLetterPublicId) {
      stats.skipped++
      continue
    }
    const result = await migrateOne(row.offerLetterUrl, row.offerLetterPublicId, "jfw/offer-letters", true, stats)
    if (result && !DRY_RUN) {
      await prisma.application.update({
        where: { id: row.id },
        data: { offerLetterUrl: result.secureUrl, offerLetterPublicId: result.publicId },
      })
    }
  }
}

async function migrateCompanyAssets(stats: MigrationStats) {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      logoUrl: true,
      logoPublicId: true,
      verificationDocuments: true,
      galleryImages: true,
    },
  })

  for (const company of companies) {
    const data: Record<string, unknown> = {}

    if (isCloudinaryUrl(company.logoUrl) && company.logoPublicId) {
      const result = await migrateOne(company.logoUrl, company.logoPublicId, "jfw/logos", false, stats)
      if (result && !DRY_RUN) {
        data.logoUrl = result.secureUrl
        data.logoPublicId = result.publicId
      }
    }

    const verificationDocs = Array.isArray(company.verificationDocuments) ? (company.verificationDocuments as unknown as DocLike[]) : []
    const { items: newDocs, changed: docsChanged } = await migrateJsonArrayField(verificationDocs, "jfw/company-verification", true, stats)
    if (docsChanged) data.verificationDocuments = newDocs

    const gallery = Array.isArray(company.galleryImages) ? (company.galleryImages as unknown as DocLike[]) : []
    const { items: newGallery, changed: galleryChanged } = await migrateJsonArrayField(gallery, "jfw/gallery", false, stats)
    if (galleryChanged) data.galleryImages = newGallery

    if (!DRY_RUN && Object.keys(data).length > 0) {
      await prisma.company.update({ where: { id: company.id }, data: data as any })
    }
  }
}

async function migratePerkDocuments(stats: MigrationStats) {
  const requests = await prisma.companyPerkRequest.findMany({
    select: { id: true, documents: true },
  })
  for (const request of requests) {
    const docs = Array.isArray(request.documents) ? (request.documents as unknown as DocLike[]) : []
    const { items, changed } = await migrateJsonArrayField(docs, "jfw/perk-documents", true, stats)
    if (changed && !DRY_RUN) {
      await prisma.companyPerkRequest.update({ where: { id: request.id }, data: { documents: items as any } })
    }
  }
}

async function main() {
  const stats: MigrationStats = { migrated: 0, skipped: 0, failed: 0 }
  logger.info(`[Migrate] Starting Cloudinary -> local disk migration (${DRY_RUN ? "DRY RUN -- pass --apply to actually write changes" : "APPLY MODE -- writing files and updating the database"})`)

  await migrateCandidateResumes(stats)
  await migrateOfferLetters(stats)
  await migrateCompanyAssets(stats)
  await migratePerkDocuments(stats)

  logger.info(`[Migrate] Done. Migrated: ${stats.migrated}, Skipped (already local/incomplete): ${stats.skipped}, Failed: ${stats.failed}`)
  if (DRY_RUN) {
    logger.info(`[Migrate] This was a dry run -- nothing was written. Re-run with --apply once DISK_MOUNT_PATH points at a real, persistent mount.`)
  }
  await prisma.$disconnect()
}

main().catch((err: any) => {
  logger.error(`[Migrate] Fatal error: ${err.message}`)
  process.exit(1)
})
