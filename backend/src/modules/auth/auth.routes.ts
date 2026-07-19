import { Router } from "express"
import { AuthController } from "./auth.controller"
import { authenticateToken } from "../../shared/middleware/auth.middleware"

const router = Router()
const controller = new AuthController()

// Public Registration & Verification
router.post("/register/candidate", controller.registerCandidate)
router.post("/register/recruiter", controller.registerRecruiter)
router.get("/verify-email", controller.verifyEmail)

// Standard / Google Login
router.post("/login", controller.login)
router.post("/oauth", controller.oauth)
router.get("/google", controller.initiateGoogleOAuth)
router.get("/google/callback", controller.googleCallback)

// Token Refresh & Invalidation
router.post("/refresh", controller.refresh)
router.post("/logout", controller.logout)

// Password Management
router.post("/forgot-password", controller.forgotPassword)
router.post("/reset-password", controller.resetPassword)

// Invitations -- public, token-based (reached via the mailed invite link,
// no login involved yet). GET must be registered so the frontend can look up
// who/what company the invite is for and confirm it's still valid before
// the invited person fills out the accept form; it doesn't collide with the
// POST /invitations/accept route below despite the shared "/invitations"
// prefix since Express matches on method + full path independently.
router.get("/invitations/:token", controller.getInvitation)
router.post("/invitations/accept", controller.acceptInvitation)

// Protected Account Sessions (Authentication required)
router.get("/me", authenticateToken, controller.getMe)
router.get("/sessions", authenticateToken, controller.getSessions)
router.delete("/sessions/:id", authenticateToken, controller.revokeSession)
router.delete("/sessions", authenticateToken, controller.revokeOtherSessions)

// Protected Self-Service Account Management (Authentication required)
router.put("/change-password", authenticateToken, controller.changePassword)
router.delete("/account", authenticateToken, controller.deleteAccount)

export default router
