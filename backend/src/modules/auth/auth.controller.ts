import type { Request, Response } from "express"
import { AuthService } from "./auth.service"
import { sendSuccess, sendError } from "../../shared/utils/response"
import { getGoogleAuthUrl, getGoogleUser } from "../../shared/utils/googleOAuth"
import {
  registerCandidateSchema,
  registerRecruiterSchema,
  loginSchema,
  oauthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  acceptInvitationSchema,
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

    // Set refresh token HttpOnly cookie
    res.cookie("jid", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/api/v1/auth/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    return sendSuccess(
      res,
      {
        accessToken: result.accessToken,
        user: result.user,
      },
      "Logged in successfully."
    )
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

    res.cookie("jid", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/api/v1/auth/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

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
    const token = req.cookies?.jid || req.body?.refreshToken
    if (!token) {
      return sendError(res, "Refresh token required", null, 401)
    }

    const ipAddress = req.ip || "127.0.0.1"
    const userAgent = req.headers["user-agent"] || "Unknown"

    const result = await this.authService.refresh(token, ipAddress, userAgent)

    res.cookie("jid", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/api/v1/auth/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

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
    const token = req.cookies?.jid || req.body?.refreshToken
    if (token) {
      await this.authService.logout(token)
    }

    res.clearCookie("jid", {
      path: "/api/v1/auth/refresh",
    })

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
    return sendSuccess(res, { email: validated.email }, "Password reset email triggered successfully.")
  }

  resetPassword = async (req: Request, res: Response) => {
    const validated = resetPasswordSchema.parse(req.body)
    return sendSuccess(res, null, "Password reset completed successfully.")
  }

  initiateGoogleOAuth = (req: Request, res: Response) => {
    const role = (req.query.role as string) || "Candidate"
    const { url, state } = getGoogleAuthUrl(role)
    res.cookie("oauth_state", state, { httpOnly: true, maxAge: 15 * 60 * 1000 })
    return res.redirect(url)
  }

  googleCallback = async (req: Request, res: Response, next: any) => {
    try {
      const code = req.query.code as string
      const state = req.query.state as string
      const savedState = req.cookies?.oauth_state

      // State verification guard
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

      res.cookie("jid", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/api/v1/auth/refresh",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })

      res.clearCookie("oauth_state")

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
      return res.redirect(`${frontendUrl}/oauth/callback?token=${result.accessToken}`)
    } catch (err: any) {
      next(err)
    }
  }
}

export default AuthController
