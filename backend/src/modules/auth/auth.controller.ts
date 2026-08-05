import type { Request, Response } from "express"
import { AuthService } from "./auth.service"
import { sendSuccess, sendError } from "../../shared/utils/response"
import { getGoogleAuthUrl, getGoogleUser } from "../../shared/utils/googleOAuth"
import {
  REFRESH_COOKIE_NAME,
  getRefreshCookieOptions,
  getClearRefreshCookieOptions,
} from "../../shared/utils/cookies"
import env from "../../shared/config/env"
import {
  registerCandidateSchema,
  registerRecruiterSchema,
  loginSchema,
  oauthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  acceptInvitationSchema,
  changePasswordSchema,
  deleteAccountSchema,
  twoFactorVerifyLoginSchema,
  twoFactorEnrollConfirmSchema,
  twoFactorDisableSchema,
} from "./auth.validator"

export class AuthController {
  private authService = new AuthService()

  registerCandidate = async (req: Request, res: Response) => {
    const validated = registerCandidateSchema.parse(req.body)
    const result = await this.authService.registerCandidate(
      validated.email,
      validated.password,
      validated.fullName
    )
    return sendSuccess(res, { userId: result.user.id }, "Candidate registered successfully. Please verify your email.", 201)
  }

  registerRecruiter = async (req: Request, res: Response) => {
    const validated = registerRecruiterSchema.parse(req.body)
    const result = await this.authService.registerRecruiter(
      validated.email,
      validated.password,
      validated.fullName,
      validated.phone,
      validated.companyName,
      validated.website,
      validated.location,
      validated.industry
    )
    return sendSuccess(
      res,
      { userId: result.user.id },
      "Recruiter registered successfully. Please verify your email to submit company details for verification.",
      201
    )
  }

  verifyEmail = async (req: Request, res: Response) => {
    const token = req.query.token as string
    if (!token) {
      return sendError(res, "Verification token is required", null, 400)
    }

    const result = await this.authService.verifyEmail(token)
    return sendSuccess(res, { status: result.status }, "Email verified successfully.", 200)
  }

  login = async (req: Request, res: Response) => {
    const validated = loginSchema.parse(req.body)
    const ipAddress = req.ip || "127.0.0.1"
    const userAgent = req.headers["user-agent"] || "Unknown"

    const result = await this.authService.login(validated.email, validated.password, ipAddress, userAgent)

    // Password checked out, but the account has 2FA enrolled -- no tokens
    // issued yet, just a short-lived challenge the client must complete via
    // POST /auth/2fa/verify.
    if (result.kind === "twoFactorRequired") {
      return sendSuccess(
        res,
        { requiresTwoFactor: true, pendingToken: result.pendingToken },
        "Two-factor authentication code required."
      )
    }

    // Set refresh token HttpOnly cookie
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions())

    return sendSuccess(
      res,
      {
        accessToken: result.accessToken,
        user: result.user,
      },
      "Logged in successfully."
    )
  }

  verifyTwoFactorLogin = async (req: Request, res: Response) => {
    const validated = twoFactorVerifyLoginSchema.parse(req.body)
    const ipAddress = req.ip || "127.0.0.1"
    const userAgent = req.headers["user-agent"] || "Unknown"

    const result = await this.authService.verifyTwoFactorLogin(
      validated.pendingToken,
      validated.code,
      ipAddress,
      userAgent
    )

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions())

    return sendSuccess(
      res,
      {
        accessToken: result.accessToken,
        user: result.user,
      },
      "Logged in successfully."
    )
  }

  startTwoFactorEnrollment = async (req: Request, res: Response) => {
    const user = req.user
    if (!user) {
      return sendError(res, "Authentication required", null, 401)
    }
    const result = await this.authService.startTwoFactorEnrollment(user.userId)
    return sendSuccess(
      res,
      result,
      "Scan the QR code (or enter the secret manually) in your authenticator app, then confirm with a 6-digit code."
    )
  }

  confirmTwoFactorEnrollment = async (req: Request, res: Response) => {
    const user = req.user
    if (!user) {
      return sendError(res, "Authentication required", null, 401)
    }
    const validated = twoFactorEnrollConfirmSchema.parse(req.body)
    const result = await this.authService.confirmTwoFactorEnrollment(user.userId, validated.code)
    return sendSuccess(res, result, "Two-factor authentication enabled.")
  }

  disableTwoFactor = async (req: Request, res: Response) => {
    const user = req.user
    if (!user) {
      return sendError(res, "Authentication required", null, 401)
    }
    const validated = twoFactorDisableSchema.parse(req.body)
    const result = await this.authService.disableTwoFactorSelfService(user.userId, validated.password)
    return sendSuccess(res, result, "Two-factor authentication disabled.")
  }

  oauth = async (req: Request, res: Response) => {
    const validated = oauthSchema.parse(req.body)
    const ipAddress = req.ip || "127.0.0.1"
    const userAgent = req.headers["user-agent"] || "Unknown"

    const result = await this.authService.oauth(
      validated.provider,
      validated.providerUserId,
      validated.email,
      validated.fullName,
      validated.roleType,
      ipAddress,
      userAgent
    )

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions())

    return sendSuccess(
      res,
      {
        accessToken: result.accessToken,
        user: result.user,
      },
      "Social OAuth login successful."
    )
  }

  refresh = async (req: Request, res: Response) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken
    if (!token) {
      return sendError(res, "Refresh token required", null, 401)
    }

    const ipAddress = req.ip || "127.0.0.1"
    const userAgent = req.headers["user-agent"] || "Unknown"

    const result = await this.authService.refresh(token, ipAddress, userAgent)

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions())

    return sendSuccess(
      res,
      {
        accessToken: result.accessToken,
        user: result.user,
      },
      "Tokens refreshed successfully."
    )
  }

  logout = async (req: Request, res: Response) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken
    if (token) {
      await this.authService.logout(token)
    }

    res.clearCookie(REFRESH_COOKIE_NAME, getClearRefreshCookieOptions())

    return sendSuccess(res, null, "Logged out successfully.")
  }

  getMe = async (req: Request, res: Response) => {
    const user = req.user
    if (!user) {
      return sendError(res, "Authentication required", null, 401)
    }

    const result = await this.authService.getMe(user.userId)
    return sendSuccess(res, { user: result }, "Fetched current profile successfully.")
  }

  getSessions = async (req: Request, res: Response) => {
    const user = req.user
    if (!user) {
      return sendError(res, "Authentication required", null, 401)
    }

    const sessions = await this.authService.getSessions(user.userId)
    return sendSuccess(res, { sessions }, "Fetched active sessions successfully.")
  }

  revokeSession = async (req: Request, res: Response) => {
    const user = req.user
    if (!user) {
      return sendError(res, "Authentication required", null, 401)
    }

    const sessionId = req.params.id as string
    if (!sessionId) {
      return sendError(res, "Session ID is required", null, 400)
    }

    await this.authService.revokeSession(sessionId, user.userId)
    return sendSuccess(res, null, "Session revoked successfully.")
  }

  revokeOtherSessions = async (req: Request, res: Response) => {
    const user = req.user
    if (!user) {
      return sendError(res, "Authentication required", null, 401)
    }

    const sessionHeader = req.headers["x-session-id"] || ""
    const activeSessionId = Array.isArray(sessionHeader) ? (sessionHeader[0] || "") : sessionHeader
    await this.authService.revokeAllOtherSessions(activeSessionId, user.userId)
    return sendSuccess(res, null, "Other sessions revoked successfully.")
  }

  getInvitation = async (req: Request, res: Response) => {
    const token = req.params.token as string
    const result = await this.authService.getInvitationDetails(token)
    return sendSuccess(res, result, "Invitation details fetched successfully.")
  }

  acceptInvitation = async (req: Request, res: Response) => {
    const validated = acceptInvitationSchema.parse(req.body)
    const result = await this.authService.acceptInvitation(
      validated.token,
      validated.password,
      validated.googleToken,
      validated.fullName
    )
    return sendSuccess(res, { userId: result.id }, "Invitation accepted and staff user created successfully.", 201)
  }

  forgotPassword = async (req: Request, res: Response) => {
    const validated = forgotPasswordSchema.parse(req.body)
    await this.authService.forgotPassword(validated.email)
    return sendSuccess(res, { email: validated.email }, "If that email is registered, a password reset link has been sent.")
  }

  resetPassword = async (req: Request, res: Response) => {
    const validated = resetPasswordSchema.parse(req.body)
    await this.authService.resetPassword(validated.token, validated.password)
    return sendSuccess(res, null, "Password reset completed successfully.")
  }

  changePassword = async (req: Request, res: Response) => {
    const user = req.user
    if (!user) {
      return sendError(res, "Authentication required", null, 401)
    }
    const validated = changePasswordSchema.parse(req.body)
    await this.authService.changePassword(user.userId, validated.currentPassword, validated.newPassword)
    return sendSuccess(res, null, "Password changed successfully.")
  }

  deleteAccount = async (req: Request, res: Response) => {
    const user = req.user
    if (!user) {
      return sendError(res, "Authentication required", null, 401)
    }
    const validated = deleteAccountSchema.parse(req.body)
    await this.authService.deleteOwnAccount(user.userId, validated.password)
    return sendSuccess(res, null, "Account deleted successfully.")
  }

  initiateGoogleOAuth = (req: Request, res: Response) => {
    const role = (req.query.role as string) || "Candidate"
    const { url, state } = getGoogleAuthUrl(role)
    res.cookie("oauth_state", state, {
      httpOnly: true,
      secure: env.NODE_ENV !== "development",
      maxAge: 15 * 60 * 1000,
    })
    return res.redirect(url)
  }

  googleCallback = async (req: Request, res: Response, next: any) => {
    try {
      const code = req.query.code as string
      const state = req.query.state as string
      const savedState = req.cookies?.oauth_state

      if (!state || state !== savedState) {
        return sendError(res, "Forbidden: Secure OAuth State parameter mismatch.", null, 403)
      }

      const roleType = (state.split(":")[1] || "Candidate") as "Candidate" | "Recruiter"
      const googleUser = await getGoogleUser(code)

      const ipAddress = req.ip || "127.0.0.1"
      const userAgent = req.headers["user-agent"] || "Unknown"

      const result = await this.authService.oauth(
        "google",
        googleUser.id,
        googleUser.email,
        googleUser.name,
        roleType,
        ipAddress,
        userAgent
      )

      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions())

      res.clearCookie("oauth_state")

      const frontendUrl = process.env.FRONTEND_URL || env.CLIENT_URL || "http://localhost:3000"
      return res.redirect(`${frontendUrl}/oauth/callback?token=${result.accessToken}`)
    } catch (err: any) {
      // This is a full-page browser redirect, not a fetch/XHR -- letting a
      // thrown error (e.g. the recruiter company-approval gate in
      // AuthService.createAuthSession, or any other OAuth failure) reach the
      // generic Express error handler would render a bare JSON blob instead
      // of anything inside the SPA. Redirect back into the app with the
      // message instead so OAuthCallback.tsx can display it properly.
      const frontendUrl = process.env.FRONTEND_URL || env.CLIENT_URL || "http://localhost:3000"
      const message = err?.message || "Google sign-in failed. Please try again."
      return res.redirect(`${frontendUrl}/oauth/callback?error=${encodeURIComponent(message)}`)
    }
  }
}

export default AuthController
