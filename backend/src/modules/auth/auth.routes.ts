import { Router } from "express"
import { AuthController } from "./auth.controller"
import { authenticateToken } from "../../shared/middleware/auth.middleware"
import { authRateLimiter } from "../../shared/middleware/rateLimit.middleware"

const router = Router()
const controller = new AuthController()

// Every credential-facing endpoint below sits behind authRateLimiter --
// deliberately strict (see env.ts's RATE_LIMIT_AUTH_* defaults) since these
// are exactly the endpoints credential-stuffing/brute-force/enumeration
// attacks target. Applied per-route rather than router-wide so it doesn't
// also throttle the lower-risk session-management routes further down.

// Public Registration & Verification
router.post("/register/candidate", authRateLimiter, controller.registerCandidate)
router.post("/register/recruiter", authRateLimiter, controller.registerRecruiter)
router.get("/verify-email", authRateLimiter, controller.verifyEmail)

// Standard / Google Login
router.post("/login", authRateLimiter, controller.login)
router.post("/oauth", authRateLimiter, controller.oauth)
router.get("/google", authRateLimiter, controller.initiateGoogleOAuth)
router.get("/google/callback", authRateLimiter, controller.googleCallback)

// Two-Factor Authentication. /2fa/verify completes a login paused by
// AuthService.login() (the pendingToken IS the auth here, so it's public
// like /login itself, and shares the same strict rate limiter since it's
// exactly the kind of endpoint a 6-digit-code brute force would target).
// The enroll/disable endpoints are self-service account management, so they
// require a real session same as change-password/delete-account below.
router.post("/2fa/verify", authRateLimiter, controller.verifyTwoFactorLogin)
router.post("/2fa/enroll/start", authenticateToken, controller.startTwoFactorEnrollment)
router.post("/2fa/enroll/confirm", authenticateToken, controller.confirmTwoFactorEnrollment)
router.post("/2fa/disable", authenticateToken, controller.disableTwoFactor)

// Token Refresh & Invalidation
router.post("/refresh", authRateLimiter, controller.refresh)
router.post("/logout", controller.logout)

// Password Management
router.post("/forgot-password", authRateLimiter, controller.forgotPassword)
router.post("/reset-password", authRateLimiter, controller.resetPassword)

// Invitations -- public, token-based (reached via the mailed invite link,
// no login involved yet). GET must be registered so the frontend can look up
// who/what company the invite is for and confirm it's still valid before
// the invited person fills out the accept form; it doesn't collide with the
// POST /invitations/accept route below despite the shared "/invitations"
// prefix since Express matches on method + full path independently.
router.get("/invitations/:token", controller.getInvitation)
router.post("/invitations/accept", authRateLimiter, controller.acceptInvitation)

// Protected Account Sessions (Authentication required)
router.get("/me", authenticateToken, controller.getMe)
router.get("/sessions", authenticateToken, controller.getSessions)
router.delete("/sessions/:id", authenticateToken, controller.revokeSession)
router.delete("/sessions", authenticateToken, controller.revokeOtherSessions)

// Protected Self-Service Account Management (Authentication required)
router.put("/change-password", authenticateToken, controller.changePassword)
router.delete("/account", authenticateToken, controller.deleteAccount)

export default router
