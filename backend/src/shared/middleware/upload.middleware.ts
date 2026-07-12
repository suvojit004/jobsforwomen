// @ts-ignore
import multer from "multer"
import type { Request, Response, NextFunction } from "express"
import { sendError } from "../utils/response"
import { scanFileForVirus } from "../utils/cloudinary"

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

// Memory storage to keep buffer for Cloudinary streaming
const storage = multer.memoryStorage()

const resumeFilter = (req: Request, file: any, cb: any) => {
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type. Only PDF, DOC, and DOCX are allowed."))
  }
}

const uploader = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: resumeFilter,
})

export const uploadResumeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const upload = uploader.single("resume")
  upload(req, res, async (err: any) => {
    if (err) {
      return sendError(res, err.message, null, 400)
    }

    const file = (req as any).file
    if (file) {
      try {
        const isClean = await scanFileForVirus(file.buffer, file.mimetype)
        if (!isClean) {
          return sendError(res, "File rejected: it is empty or its contents do not match the declared file type.", null, 400)
        }
      } catch (scanErr: any) {
        return sendError(res, "File security verification failed.", null, 400)
      }
    }
    next()
  })
}

const logoFilter = (req: Request, file: any, cb: any) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp"
  ]
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WEBP images are allowed."))
  }
}

const logoUploader = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: logoFilter,
})

export const uploadLogoMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const upload = logoUploader.single("logo")
  upload(req, res, async (err: any) => {
    if (err) {
      return sendError(res, err.message, null, 400)
    }

    const file = (req as any).file
    if (file) {
      try {
        const isClean = await scanFileForVirus(file.buffer, file.mimetype)
        if (!isClean) {
          return sendError(res, "File rejected: it is empty or its contents do not match the declared file type.", null, 400)
        }
      } catch (scanErr: any) {
        return sendError(res, "File security verification failed.", null, 400)
      }
    }
    next()
  })
}

