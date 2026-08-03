import { Router } from "express"
import path from "path"
import fs from "fs"
import env from "../config/env"
import { PUBLIC_FOLDER_TYPES, KNOWN_FOLDER_TYPES, verifyFileSignature } from "../utils/fileStorage"
import { logger } from "../utils/logger"

// Serves locally-stored uploads (replaces Cloudinary's public/raw asset
// delivery URLs). Public folders (logos, gallery) are served with no auth --
// they're shown on public job listings even to logged-out visitors, same as
// today. Private folders (resumes, offer letters, perk/verification
// documents) require a valid, unexpired signature -- see fileStorage.ts's
// signFileUrl()/signFileUrlsDeep() for where that signature gets attached;
// this route only verifies it, it doesn't re-derive per-user ownership,
// since that's already enforced by whichever authenticated endpoint chose to
// include this URL in its response in the first place.
const router = Router()

router.get("/jfw/:type/:filename", (req, res) => {
  const { type, filename } = req.params

  if (!KNOWN_FOLDER_TYPES.has(type) || filename.includes("..") || filename.includes("/")) {
    return res.status(404).json({ success: false, message: "File not found" })
  }

  if (!PUBLIC_FOLDER_TYPES.has(type)) {
    const { exp, sig } = req.query
    if (!exp || !sig || !verifyFileSignature(req.baseUrl + req.path, exp as string, sig as string)) {
      return res.status(403).json({
        success: false,
        message: "This link has expired or is invalid. Reload the page to get a fresh link.",
      })
    }
  }

  const root = path.resolve(env.DISK_MOUNT_PATH)
  const resolved = path.resolve(root, "jfw", type, filename)
  if (!resolved.startsWith(root + path.sep)) {
    return res.status(400).json({ success: false, message: "Invalid file path" })
  }

  fs.access(resolved, fs.constants.R_OK, (err) => {
    if (err) {
      return res.status(404).json({ success: false, message: "File not found" })
    }

    // ?dl=<filename> forces a real download with that filename via
    // Content-Disposition: attachment (replaces Cloudinary's
    // fl_attachment:<name> URL trick). Without it, the file is sent inline
    // so PDFs/images open directly in the browser tab.
    const downloadName = typeof req.query.dl === "string" ? req.query.dl : null
    if (downloadName) {
      return res.download(resolved, downloadName, (sendErr) => {
        if (sendErr && !res.headersSent) {
          logger.error(`[FileServe] Failed to send ${resolved}: ${sendErr.message}`)
        }
      })
    }

    return res.sendFile(resolved, (sendErr) => {
      if (sendErr && !res.headersSent) {
        logger.error(`[FileServe] Failed to send ${resolved}: ${sendErr.message}`)
      }
    })
  })
})

export default router
