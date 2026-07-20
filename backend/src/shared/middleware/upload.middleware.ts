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

// Office gallery photos (Part 5 -- expanded Company Profile). Same image
// constraints as the company logo (2MB, JPEG/PNG/GIF/WEBP); kept as its own
// export rather than reusing uploadLogoMiddleware directly so the two upload
// surfaces (single logo vs. multi-photo gallery) can diverge independently,
// and so the multipart field name can be "photo" instead of "logo".
export const uploadGalleryPhotoMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const upload = logoUploader.single("photo")
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

// Company verification documents (GST/PAN/CIN/registration certificate/
// website ownership proof/etc. -- Part 3 & 13 of the recruiter-onboarding
// spec). Same PDF/PNG/JPEG + 10MB constraints already defined for this
// purpose in recruiter.validator.ts's AllowedDocumentFormats/MaxDocumentSize,
// duplicated here as literals since multer's fileFilter runs before Zod ever
// sees the request.
const verificationDocumentFilter = (req: Request, file: any, cb: any) => {
  const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type. Only PDF, PNG, and JPEG documents are allowed."))
  }
}

const verificationDocumentUploader = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: verificationDocumentFilter,
})

export const uploadVerificationDocumentMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const upload = verificationDocumentUploader.single("document")
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

// Perk supporting documents (HR policy PDFs, insurance/benefit brochures,
// screenshots). Its own filter/uploader rather than reusing
// verificationDocumentUploader, because perk proof needs a wider format
// allow-list (Office docs, WEBP) than company identity documents should
// accept.
const perkDocumentFilter = (req: Request, file: any, cb: any) => {
  const allowedMimeTypes = [
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
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, PNG, JPG, JPEG, WEBP."))
  }
}

const perkDocumentUploader = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: perkDocumentFilter,
})

export const uploadPerkDocumentMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const upload = perkDocumentUploader.single("document")
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

// Offer letter attachment (Release Offer flow -- optional; a recruiter can
// still release an offer with text-only details and no file). Same
// PDF/DOC/DOCX allow-list as resumes, since an offer letter is the same
// class of formal document. The field is optional -- multer's .single()
// doesn't error if the "offerLetter" part is simply absent from the
// multipart body, so releasing an offer with no attachment still works.
const offerLetterFilter = (req: Request, file: any, cb: any) => {
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type. Only PDF, DOC, and DOCX are allowed for the offer letter."))
  }
}

const offerLetterUploader = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: offerLetterFilter,
})

export const uploadOfferLetterMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const upload = offerLetterUploader.single("offerLetter")
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

