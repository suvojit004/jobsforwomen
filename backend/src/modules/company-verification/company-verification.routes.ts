import { Router } from "express"
import { CompanyVerificationController } from "./company-verification.controller"
import { uploadVerificationDocumentMiddleware } from "../../shared/middleware/upload.middleware"
import { authRateLimiter, uploadRateLimiter } from "../../shared/middleware/rateLimit.middleware"

// Entirely public, unauthenticated routes (Part 3 of the recruiter
// onboarding/approval spec) -- a recruiter reaches these via a mailed,
// secure, single-use token link, not by logging in. Deliberately NOT mounted
// behind authenticateToken/requireRole: the token itself (validated inside
// CompanyVerificationService) is the only credential here. That makes the
// token the sole guard against unauthorized access, so -- same as the auth
// module -- these get the strict, IP-keyed auth-tier limiter rather than
// just the global default, to blunt token-guessing/brute-force attempts.
const router = Router()
const controller = new CompanyVerificationController()

router.get("/:token", authRateLimiter, controller.getByToken)
router.post("/:token", authRateLimiter, controller.resubmit)
router.post("/:token/documents", authRateLimiter, uploadRateLimiter, uploadVerificationDocumentMiddleware, controller.addDocument)

export default router
