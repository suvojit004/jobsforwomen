import crypto from "crypto"
import { AuthRepository } from "./auth.repository"
import { hashPassword, comparePassword } from "../../shared/utils/password"
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../shared/utils/token"
import { calculateProfileCompletion } from "../../shared/utils/profileCompletion"
import { logger } from "../../shared/utils/logger"
import EventBus from "../../shared/eventBus/eventBus"
import { UserStatus } from "@prisma/client"

export class AuthService {
  private authRepository = new AuthRepository()

  async registerCandidate(email: string, passwordHashRaw: string, fullName: string) {
    const existing = await this.authRepository.findUserByEmail(email)
    if (existing) {
      throw new Error("Email already registered")
    }

    const passwordHash = await hashPassword(passwordHashRaw)
    const user = await this.authRepository.createCandidateUser(
      email,
      passwordHash,
      fullName,
      process.env.BYPASS_EMAIL_VERIFICATION === "true" ? UserStatus.Active : UserStatus.PendingVerification
    )

    const verificationToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await this.authRepository.createEmailVerification(email, verificationToken, expiresAt)

    logger.info(`[AuthService] Registered Candidate: ${email}. Verification token generated.`)

    // Publish UserRegistered Domain Event
    EventBus.publish("UserRegistered", {
      userId: user.id,
      email: user.email,
      fullName,
      role: "Candidate",
      verificationToken,
    })

    return { user, verificationToken }
  }

  async registerRecruiter(
    email: string,
    passwordHashRaw: string,
    fullName: string,
    phone: string,
    companyName: string,
    website: string,
    location: string,
    industry: string
  ) {
    const existing = await this.authRepository.findUserByEmail(email)
    if (existing) {
      throw new Error("Email already registered")
    }

    const passwordHash = await hashPassword(passwordHashRaw)
    const user = await this.authRepository.createRecruiterUser(
      email,
      passwordHash,
      fullName,
      phone,
      companyName,
      website,
      location,
      industry,
      process.env.BYPASS_EMAIL_VERIFICATION === "true" ? UserStatus.Active : UserStatus.PendingVerification
    )

    const verificationToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await this.authRepository.createEmailVerification(email, verificationToken, expiresAt)

    logger.info(`[AuthService] Registered Recruiter: ${email}. Verification token generated.`)

    // Publish UserRegistered Domain Event
    EventBus.publish("UserRegistered", {
      userId: user.id,
      email: user.email,
      fullName,
      role: "Recruiter",
      verificationToken,
    })

    return { user, verificationToken }
  }

  async verifyEmail(token: string) {
    const record = await this.authRepository.findEmailVerification(token)
    if (!record) {
      throw new Error("Invalid verification token")
    }

    if (new Date() > record.expiresAt) {
      throw new Error("Verification token has expired")
    }

    const user = await this.authRepository.findUserByEmail(record.email)
    if (!user) {
      throw new Error("User associated with token not found")
    }

    const isRecruiter = user.roles.some((r) => r.role.name === "Recruiter")
    const nextStatus = isRecruiter ? UserStatus.PendingApproval : UserStatus.Active

    await this.authRepository.updateUserStatus(user.id, nextStatus)
    await this.authRepository.deleteEmailVerification(record.id)

    logger.info(`[AuthService] Verified email for: ${record.email}. Next status: ${nextStatus}`)

    // Publish EmailVerified event (Audit / Notifications listen to this)
    EventBus.publish("EmailVerified", {
      userId: user.id,
      email: record.email,
      status: nextStatus,
    })

    return { email: record.email, status: nextStatus }
  }

  async login(email: string, passwordHashRaw: string, ipAddress: string, userAgent: string) {
    const user = await this.authRepository.findUserByEmail(email)
    if (!user) {
      throw new Error("Invalid email or password")
    }

    if (user.status === UserStatus.PendingVerification) {
      if (process.env.BYPASS_EMAIL_VERIFICATION === "true") {
        user.status = UserStatus.Active
        await this.authRepository.updateUserStatus(user.id, UserStatus.Active)
      } else {
        throw new Error("Please verify your email address first")
      }
    }

    if (user.status === UserStatus.Blocked) {
      throw new Error("Your account has been blocked")
    }

    if (user.status === UserStatus.Suspended) {
      throw new Error("Your account has been suspended")
    }

    if (user.status === UserStatus.Rejected) {
      throw new Error("Your account application was rejected")
    }

    if (!user.passwordHash) {
      throw new Error("This account is configured for Google login")
    }

    const isMatch = await comparePassword(passwordHashRaw, user.passwordHash)
    if (!isMatch) {
      throw new Error("Invalid email or password")
    }

    return this.createAuthSession(user, ipAddress, userAgent)
  }

  async oauth(
    provider: string,
    providerUserId: string,
    email: string,
    fullName: string,
    roleType?: "Candidate" | "Recruiter",
    ipAddress?: string,
    userAgent?: string
  ) {
    let oauthAccount = await this.authRepository.findOAuthAccount(provider, providerUserId)
    let user = oauthAccount?.user

    if (!user) {
      user = await this.authRepository.findUserByEmail(email) as any
      
      if (!user) {
        if (!roleType) {
          throw new Error("Role specification required for social registration")
        }

        if (roleType === "Candidate") {
          const registered = await this.registerCandidate(email, crypto.randomBytes(16).toString("hex"), fullName)
          user = registered.user as any
        } else {
          const registered = await this.registerRecruiter(
            email,
            crypto.randomBytes(16).toString("hex"),
            fullName,
            "",
            `${fullName}'s Company`,
            "https://change-me.com",
            "Select Location",
            "Information Technology"
          )
          user = registered.user as any
        }

        if (!user) {
          throw new Error("OAuth user registration failed")
        }

        const isRecruiter = roleType === "Recruiter"
        const nextStatus = isRecruiter ? UserStatus.PendingApproval : UserStatus.Active
        await this.authRepository.updateUserStatus(user.id, nextStatus)
      }

      await this.authRepository.createOAuthAccount(user.id, provider, providerUserId)
    }

    const fullUser = await this.authRepository.findUserById(user.id)
    return this.createAuthSession(fullUser!, ipAddress || "127.0.0.1", userAgent || "Unknown")
  }

  private async createAuthSession(user: any, ipAddress: string, userAgent: string) {
    const roles = user.roles.map((r: any) => r.role.name)
    const permissions = user.roles.flatMap((r: any) => r.role.permissions.map((p: any) => p.permission.name))

    const payload = {
      userId: user.id,
      email: user.email,
      roles,
      permissions,
    }

    const accessToken = generateAccessToken(payload)
    const refreshToken = generateRefreshToken(payload)

    const session = await this.authRepository.createSession(
      user.id,
      ipAddress,
      userAgent,
      this.detectDeviceType(userAgent)
    )

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await this.authRepository.createRefreshToken(user.id, refreshToken, expiresAt, userAgent, ipAddress)

    const profileCompletePercent = calculateProfileCompletion(user)

    // Publish UserLoggedIn event
    EventBus.publish("UserLoggedIn", {
      userId: user.id,
      email: user.email,
      ipAddress,
      userAgent,
    })

    return {
      accessToken,
      refreshToken,
      session,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        roles,
        permissions,
        profileCompletePercent,
      },
    }
  }

  async refresh(token: string, ipAddress: string, userAgent: string) {
    const dbToken = await this.authRepository.findRefreshToken(token)
    if (!dbToken || dbToken.revoked || new Date() > dbToken.expiresAt) {
      throw new Error("Invalid or expired refresh token")
    }

    const payload = verifyRefreshToken(token)
    if (!payload) {
      throw new Error("Invalid refresh token signature")
    }

    const user = await this.authRepository.findUserById(payload.userId)
    if (!user || user.status === UserStatus.Blocked) {
      throw new Error("User accounts blocked or missing")
    }

    await this.authRepository.revokeRefreshToken(token)
    return this.createAuthSession(user, ipAddress, userAgent)
  }

  async logout(token: string) {
    await this.authRepository.revokeRefreshToken(token)
    return { success: true }
  }

  async getMe(userId: string) {
    const user = await this.authRepository.findUserById(userId)
    if (!user) {
      throw new Error("User profile not found")
    }

    const roles = user.roles.map((r: any) => r.role.name)
    const permissions = user.roles.flatMap((r: any) => r.role.permissions.map((p: any) => p.permission.name))
    const profileCompletePercent = calculateProfileCompletion(user)

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      roles,
      permissions,
      profileCompletePercent,
      candidateProfile: user.candidateProfile,
      recruiterProfile: user.recruiterProfile,
      adminProfile: user.adminProfile,
    }
  }

  async getSessions(userId: string) {
    return this.authRepository.findSessionsByUserId(userId)
  }

  async revokeSession(sessionId: string, userId: string) {
    return this.authRepository.deleteSessionById(sessionId, userId)
  }

  async revokeAllOtherSessions(activeSessionId: string, userId: string) {
    return this.authRepository.deleteOtherSessions(activeSessionId, userId)
  }

  async acceptInvitation(token: string, passwordHashRaw?: string, googleToken?: string, fullName?: string) {
    const invite = await this.authRepository.findInvitation(token)
    if (!invite || invite.acceptedAt || new Date() > invite.expiresAt) {
      throw new Error("Invalid, accepted or expired invitation token")
    }

    let passwordHash: string | null = null
    if (passwordHashRaw) {
      passwordHash = await hashPassword(passwordHashRaw)
    }

    const user = await this.authRepository.createInvitedUser(
      invite.email,
      passwordHash,
      fullName || "Invited Member",
      invite.roleId
    )

    if (googleToken) {
      await this.authRepository.createOAuthAccount(user.id, "google", googleToken)
    }

    await this.authRepository.acceptInvitation(invite.id)

    // Publish EmployeeInvitationAccepted Domain Event
    EventBus.publish("EmployeeInvitationAccepted", {
      userId: user.id,
      email: invite.email,
      roleId: invite.roleId,
    })

    return user
  }

  async forgotPassword(email: string) {
    const user = await this.authRepository.findUserByEmail(email)

    // Always behave the same way whether or not the account exists, to avoid
    // leaking which emails are registered.
    if (!user || !user.passwordHash) {
      logger.info(`[AuthService] Password reset requested for non-resettable account: ${email}`)
      return { email }
    }

    await this.authRepository.invalidatePendingPasswordResets(email)

    const resetToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    await this.authRepository.createPasswordReset(email, resetToken, expiresAt)

    logger.info(`[AuthService] Password reset token generated for: ${email}`)

    EventBus.publish("PasswordResetRequested", {
      email,
      token: resetToken,
    })

    return { email }
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.authRepository.findValidPasswordReset(token)
    if (!record) {
      throw new Error("Invalid or expired password reset token")
    }

    if (new Date() > record.expiresAt) {
      throw new Error("Password reset token has expired")
    }

    const user = await this.authRepository.findUserByEmail(record.email)
    if (!user) {
      throw new Error("User associated with token not found")
    }

    const passwordHash = await hashPassword(newPassword)
    await this.authRepository.updateUserPassword(user.id, passwordHash)
    await this.authRepository.markPasswordResetUsed(record.id)

    // Invalidate all existing sessions so stolen/old credentials can't be used
    await this.authRepository.deleteOtherSessions("", user.id)

    logger.info(`[AuthService] Password reset completed for: ${record.email}`)

    EventBus.publish("PasswordChanged", {
      userId: user.id,
      email: record.email,
    })

    return { email: record.email }
  }

  private detectDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase()
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "Mobile"
    if (ua.includes("tablet") || ua.includes("ipad")) return "Tablet"
    return "Desktop"
  }
}

export default AuthService
