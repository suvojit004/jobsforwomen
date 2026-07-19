import { Router } from "express"
import { CompanyVerificationController } from "./company-verification.controller"
import { uploadVerificationDocumentMiddleware } from "../../shared/middleware/upload.middleware"

// Entirely public, unauthenticated routes (Part 3 of the recruiter
// onboarding/approval spec) -- a recruiter reaches these via a mailed,
// secure, single-use token link, not by logging in. Deliberately NOT mounted
// behind authenticateToken/requireRole: the token itself (validated inside
// CompanyVerificationService) is the only credential here.
const router = Router()
const controller = new CompanyVerificationController()

router.get("/:token", controller.getByToken)
router.post("/:token", controller.resubmit)
router.post("/:token/documents", uploadVerificationDocumentMiddleware, controller.addDocument)

export default router
