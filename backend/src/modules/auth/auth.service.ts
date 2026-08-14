import crypto from "crypto"
import { AuthRepository } from "./auth.repository"
import { hashPassword, comparePassword } from "../../shared/utils/password"
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../shared/utils/token"
import {
  generateTotpSecret,
  verifyTotpToken,
  buildOtpAuthUri,
  encryptTwoFactorSecret,
  decryptTwoFactorSecret,
  generateTwoFactorPendingToken,
  verifyTwoFactorPendingToken,
} from "../../shared/utils/twoFactor"
import { calculateProfileCompletion } from "../../shared/utils/profileCompletion"
import { recordFailedAdminLogin, isIpFlaggedForAdminLogins, clearFailedAdminLogins } from "../../shared/utils/loginSecurity"
import { ADMIN_TIER_ROLES } from "../../shared/constants/roles"
import env from "../../shared/config/env"
import { logger } from "../../shared/utils/logger"
import EventBus from "../../shared/eventBus/eventBus"
import { UserStatus } from "@prisma/client"
import { deleteFile } from "../../shared/utils/fileStorage"
import prisma from "../../shared/database/db"
import { AppError } from "../../shared/middleware/errorHandler"

export class AuthService {
  private authRepository = new AuthRepository()

  async registerCandidate(email: string, passwordHashRaw: string, fullName: string) {
    const existing = await this.authRepository.findUserByEmail(email)
    if (existing) {
      // Was a plain `new Error("Email already registered")` -- every other
      // duplicate-email guard in the codebase (admin.service.ts's createAdmin,
      // recruiter.service.ts's inviteEmployee) says "already exists", which
      // errorHandler.ts's text-matching net recognizes and maps to 409. This
      // one said "registered" instead, matched none of that net's phrases,
      // and fell through to the generic 500 handler -- so a duplicate
      // signup attempt looked like a server crash instead of the ordinary,
      // expected conflict it actually is. AppError sidesteps the text-net
      // entirely and returns the correct status directly.
      throw new AppError("An account with this email address already exists.", 409)
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
      // Was a plain `new Error("Email already registered")` -- every other
      // duplicate-email guard in the codebase (admin.service.ts's createAdmin,
      // recruiter.service.ts's inviteEmployee) says "already exists", which
      // errorHandler.ts's text-matching net recognizes and maps to 409. This
      // one said "registered" instead, matched none of that net's phrases,
      // and fell through to the generic 500 handler -- so a duplicate
      // signup attempt looked like a server crash instead of the ordinary,
      // expected conflict it actually is. AppError sidesteps the text-net
      // entirely and returns the correct status directly.
      throw new AppError("An account with this email address already exists.", 409)
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

    // Publish CompanyRegistered Domain Event -- distinct from CompanySubmitted
    // (which fires later, on company-profile onboarding/resubmission). This
    // is the initial "a new company registration request exists" signal:
    // notification.listener.ts creates an audit log entry and a realtime
    // dashboard notification for every Active Admin/Super Admin.
    const companyId = (user as any).recruiterProfile?.companyId
    if (companyId) {
      EventBus.publish("CompanyRegistered", {
        companyId,
        companyName,
        recruiterUserId: user.id,
        recruiterName: fullName,
        recruiterEmail: email,
      })
    }

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

    const isAdminTier = user.roles.some((r: any) => ADMIN_TIER_ROLES.includes(r.role.name))

    // Real "Admin sessions are tracked by IP audit registries. Suspicious
    // access patterns trigger instant lockouts" enforcement -- previously
    // nothing admin-specific backed that claim, just the generic, IP-keyed
    // authRateLimiter every auth endpoint gets. Checked before the password
    // compare so a locked-out attacker can't keep spending bcrypt cycles
    // probing passwords once the account (or their IP) is flagged.
    // Candidate/recruiter logins are entirely unaffected -- scoped to
    // isAdminTier only, matching the claim this is fixing (it lives on the
    // Administrative Settings page).
    if (isAdminTier) {
      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        const minutesLeft = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000))
        throw new AppError(
          `This account is temporarily locked due to repeated failed login attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
          423
        )
      }

      if (await isIpFlaggedForAdminLogins(ipAddress)) {
        throw new AppError(
          "Too many failed login attempts against admin accounts from this network. Try again later.",
          423
        )
      }
    }

    if (user.status === UserStatus.PendingVerification) {
      // SECURITY: this used to also auto-activate ANY account whose email
      // ended in "@jobsforwomen.info" -- unconditionally, in every
      // environment, with no environment-variable gate at all. Registration
      // never verifies domain ownership (that's the entire point of email
      // verification), so anyone could register attacker@jobsforwomen.info,
      // never touch the verification email, and still get auto-activated on
      // their first login attempt. Removed -- BYPASS_EMAIL_VERIFICATION is
      // the only sanctioned bypass, and it must be unset/false in production.
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
      if (isAdminTier) {
        const justLocked = await this.recordAdminLoginFailure(user, ipAddress)
        if (justLocked) {
          throw new AppError(
            `Too many failed login attempts. This account is now locked for ${env.ADMIN_LOGIN_LOCKOUT_DURATION_MINUTES} minutes.`,
            423
          )
        }
      }
      throw new Error("Invalid email or password")
    }

    if (isAdminTier) {
      // A real login resets the failure counters -- old failures shouldn't
      // linger toward a future false lockout once the account has proven
      // it's being used legitimately again.
      await clearFailedAdminLogins(user.email, ipAddress)
    }

    // Password check passed, but the account has 2FA enrolled -- don't
    // issue real tokens yet. Return a short-lived pending token that only
    // authorizes completing the challenge (POST /auth/2fa/verify), not
    // general API access. See verifyTwoFactorLogin.
    //
    // `kind` is a real discriminant (not just a `requiresTwoFactor` flag
    // present on one branch only) so auth.controller.ts's `result.kind ===
    // "twoFactorRequired"` check narrows this union reliably -- an `in`/
    // truthiness check on a flag that's simply *absent* on the other branch
    // does not narrow consistently across every TS version.
    if (user.twoFactorEnabled) {
      return { kind: "twoFactorRequired" as const, pendingToken: generateTwoFactorPendingToken(user.id) }
    }

    const session = await this.createAuthSession(user, ipAddress, userAgent)
    return { kind: "success" as const, ...session }
  }

  // Records one failed password attempt against an admin-tier account and,
  // if it just crossed ADMIN_LOGIN_LOCKOUT_THRESHOLD, sets a durable
  // User.lockedUntil (survives past loginSecurity.ts's own counting
  // window) and publishes an audit entry. Returns true when this specific
  // call is the one that triggered the lock, so login() can surface a
  // clear "you're now locked out" message on this attempt rather than the
  // generic "Invalid email or password".
  private async recordAdminLoginFailure(user: any, ipAddress: string): Promise<boolean> {
    const { emailFailureCount, ipFlagged } = await recordFailedAdminLogin(user.email, ipAddress)

    let justLocked = false
    if (emailFailureCount >= env.ADMIN_LOGIN_LOCKOUT_THRESHOLD) {
      const lockedUntil = new Date(Date.now() + env.ADMIN_LOGIN_LOCKOUT_DURATION_MINUTES * 60 * 1000)
      await this.authRepository.setLockedUntil(user.id, lockedUntil)
      // The durable DB lock now covers enforcement -- no need to keep
      // counting toward it in Redis/memory too.
      await clearFailedAdminLogins(user.email, ipAddress)
      justLocked = true

      EventBus.publish("AuditCreated", {
        category: "SECURITY",
        action: "ADMIN_ACCOUNT_LOCKED",
        entity: "User",
        entityId: user.id,
        newValue: { lockedUntil, failedAttempts: emailFailureCount },
      })
    }

    if (ipFlagged) {
      EventBus.publish("AuditCreated", {
        category: "SECURITY",
        action: "ADMIN_LOGIN_IP_FLAGGED",
        entity: "User",
        entityId: user.id,
        newValue: { ipAddress },
      })
    }

    return justLocked
  }

  // Completes a login that was paused by the twoFactorEnabled branch above.
  // Uses AppError (explicit status code) rather than this file's usual plain
  // `throw new Error(...)` + errorHandler.ts message-substring mapping --
  // these are new, specific messages that wouldn't match any existing
  // pattern there, and a security-facing endpoint like this shouldn't
  // depend on a string happening to contain the right substring to avoid
  // surfacing as a 500.
  async verifyTwoFactorLogin(pendingToken: string, code: string, ipAddress: string, userAgent: string) {
    const decoded = verifyTwoFactorPendingToken(pendingToken)
    if (!decoded) {
      throw new AppError("Your two-factor challenge has expired. Please log in again.", 401)
    }

    const user = await this.authRepository.findUserById(decoded.userId)
    if (!user) {
      throw new AppError("User not found", 404)
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      // Account state changed between password check and code entry (e.g.
      // 2FA was disabled elsewhere mid-flow) -- fail closed rather than
      // silently logging in without the check that was promised.
      throw new AppError("Two-factor authentication is not enabled for this account.", 400)
    }

    const secret = decryptTwoFactorSecret(user.twoFactorSecret)
    if (!verifyTotpToken(secret, code)) {
      throw new AppError("Invalid authentication code. Please try again.", 401)
    }

    return this.createAuthSession(user, ipAddress, userAgent)
  }

  async startTwoFactorEnrollment(userId: string) {
    const user = await this.authRepository.findUserById(userId)
    if (!user) {
      throw new AppError("User not found", 404)
    }
    if (user.twoFactorEnabled) {
      throw new AppError("Two-factor authentication is already enabled on this account.", 409)
    }

    const secret = generateTotpSecret()
    await this.authRepository.setPendingTwoFactorSecret(userId, encryptTwoFactorSecret(secret))

    // Plaintext secret is only ever returned here, once, right after
    // generation -- everywhere else it's stored/read encrypted.
    return {
      secret,
      otpauthUri: buildOtpAuthUri(secret, user.email),
    }
  }

  async confirmTwoFactorEnrollment(userId: string, code: string) {
    const user = await this.authRepository.findUserById(userId)
    if (!user) {
      throw new AppError("User not found", 404)
    }
    if (!user.twoFactorSecret) {
      throw new AppError("No pending two-factor enrollment found. Please start enrollment again.", 400)
    }

    const secret = decryptTwoFactorSecret(user.twoFactorSecret)
    if (!verifyTotpToken(secret, code)) {
      throw new AppError("Invalid authentication code. Please try again.", 401)
    }

    await this.authRepository.enableTwoFactor(userId)

    EventBus.publish("AuditCreated", {
      operatorId: userId,
      category: "SECURITY",
      action: "ENABLE_2FA",
      entity: "User",
      entityId: userId,
    })

    return { twoFactorEnabled: true }
  }

  async disableTwoFactorSelfService(userId: string, password: string) {
    const user = await this.authRepository.findUserById(userId)
    if (!user) {
      throw new AppError("User not found", 404)
    }
    if (!user.passwordHash) {
      throw new AppError("This account is configured for Google login and has no password to verify.", 400)
    }

    const isMatch = await comparePassword(password, user.passwordHash)
    if (!isMatch) {
      throw new AppError("Incorrect password.", 401)
    }

    await this.authRepository.disableTwoFactor(userId)

    EventBus.publish("AuditCreated", {
      operatorId: userId,
      category: "SECURITY",
      action: "DISABLE_2FA",
      entity: "User",
      entityId: userId,
    })

    return { twoFactorEnabled: false }
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

  // Recruiters must not receive access/refresh tokens while their company is
  // still pending verification, rejected, or awaiting more information --
  // only an "approved" Company should ever let a recruiter reach the app.
  // login() previously had no PendingApproval/company-status
  // check at all, so a recruiter could fully log in immediately after email
  // verification, well before any admin approved their company. Checked once
  // here (rather than duplicated in login/oauth/refresh separately) since all
  // three paths funnel through createAuthSession.
  private assertRecruiterCompanyApproved(user: any) {
    const isRecruiter = user.roles?.some((r: any) => r.role?.name === "Recruiter")
    if (!isRecruiter) return

    const companyStatus = user.recruiterProfile?.company?.status
    if (!companyStatus || companyStatus === "approved") return

    if (companyStatus === "rejected") {
      throw new Error("Company verification rejected. Please check your email to update your company information.")
    }

    if (companyStatus === "info_requested") {
      throw new Error(
        "Additional information is required to complete your company verification. Please check your registered email for details."
      )
    }

    // draft, submitted, pending, pending_verification, under_review
    throw new Error("Your company verification is still pending. Please check your registered email for updates.")
  }

  // Shared Blocked/Suspended/Rejected check used by login(), oauth(), and
  // refresh() so a suspended/blocked account gets the same clear rejection
  // on every entry point instead of an inconsistent half-login.
  private assertAccountActive(user: any) {
    if (user.status === UserStatus.Blocked) {
      throw new Error("Your account has been blocked")
    }
    if (user.status === UserStatus.Suspended) {
      throw new Error("Your account has been suspended")
    }
    if (user.status === UserStatus.Rejected) {
      throw new Error("Your account application was rejected")
    }
  }

  private async createAuthSession(user: any, ipAddress: string, userAgent: string) {
    this.assertAccountActive(user)
    this.assertRecruiterCompanyApproved(user)

    const roles = user.roles.map((r: any) => r.role.name)
    const permissions = user.roles.flatMap((r: any) => r.role.permissions.map((p: any) => p.permission.name))

    // Session is created BEFORE the tokens so its id can be embedded in both
    // (see TokenPayload.sessionId) -- sessionTimeout.middleware.ts uses this
    // to enforce admin inactivity timeouts, and to revoke the matching
    // refresh token when it force-expires a session so a silent
    // refresh-on-401 can't resurrect it.
    const session = await this.authRepository.createSession(
      user.id,
      ipAddress,
      userAgent,
      this.detectDeviceType(userAgent)
    )

    const payload = {
      userId: user.id,
      email: user.email,
      roles,
      permissions,
      sessionId: session.id,
      // Baked in at mint time so enforceTwoFactorPolicy (Force Two-Factor
      // platform policy) can check it with zero extra DB/Redis calls on the
      // hot path. Self-corrects within one access-token lifetime
      // (JWT_ACCESS_EXPIRY) if 2FA state changes mid-session -- same
      // staleness tradeoff this app already accepts for roles/permissions.
      twoFactorEnabled: !!user.twoFactorEnabled,
    }

    const accessToken = generateAccessToken(payload)
    const refreshToken = generateRefreshToken(payload)

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await this.authRepository.createRefreshToken(user.id, refreshToken, expiresAt, userAgent, ipAddress, session.id)

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
        // Same fix as getMe() below -- the top-right profile menu (Navbar.tsx)
        // reads `user.fullName` and falls back to email only when it's
        // missing, but this shape never set it, so it always fell back
        // immediately after login/refresh/OAuth, before the next /auth/me
        // call happened to paper over it.
        fullName:
          user.candidateProfile?.fullName ||
          user.recruiterProfile?.fullName ||
          user.adminProfile?.fullName ||
          undefined,
        status: user.status,
        roles,
        permissions,
        profileCompletePercent,
        twoFactorEnabled: !!user.twoFactorEnabled,
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
    if (!user) {
      throw new Error("User not found")
    }

    await this.authRepository.revokeRefreshToken(token)
    // createAuthSession() now runs the full Blocked/Suspended/Rejected check
    // (assertAccountActive) -- previously this only checked Blocked, so a
    // Suspended or Rejected user's still-valid refresh token could mint
    // fresh access tokens indefinitely.
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
      // Frontend's User type has a top-level `fullName`, and Navbar.tsx
      // reads it directly (falling back to email only if it's missing) --
      // but this response never actually set it, so the top-right profile
      // menu showed every user's login email instead of their real name.
      // The real name lives on whichever role profile the account has.
      fullName:
        user.candidateProfile?.fullName ||
        user.recruiterProfile?.fullName ||
        user.adminProfile?.fullName ||
        undefined,
      status: user.status,
      roles,
      permissions,
      profileCompletePercent,
      twoFactorEnabled: !!user.twoFactorEnabled,
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

  // Public, unauthenticated lookup (Part of fixing the broken /accept-invitation
  // link -- the frontend page needs to greet the invited person and confirm
  // the link is still valid *before* they fill out a whole form, the same
  // way CompanyVerification.tsx's getByToken does for the company-verification
  // resubmission link). Deliberately generic on failure -- same reasoning as
  // CompanyVerificationService.findValidByToken: whether the token never
  // existed, was already accepted, or expired should look identical to the
  // caller so no one can fish for which invitations are still outstanding.
  async getInvitationDetails(token: string) {
    const invite = await this.authRepository.findInvitation(token)
    if (!invite || invite.acceptedAt || new Date() > invite.expiresAt) {
      throw new Error("This invitation link is invalid, has already been used, or has expired.")
    }

    return {
      email: invite.email,
      roleName: invite.role.name,
      companyName: invite.company?.name || null,
    }
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
      invite.roleId,
      invite.companyId
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

  // Real change-password for an already-authenticated user. Previously the
  // candidate and admin Settings pages both collected currentPassword/
  // newPassword in their forms but never actually called any endpoint --
  // they just flashed a fake "success" state, so passwords were never
  // actually changed.
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.authRepository.findUserById(userId)
    if (!user) {
      throw new Error("User not found")
    }
    if (!user.passwordHash) {
      throw new Error("This account uses OAuth sign-in and has no password to change")
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash)
    if (!isMatch) {
      throw new Error("Current password is incorrect")
    }

    const passwordHash = await hashPassword(newPassword)
    await this.authRepository.updateUserPassword(userId, passwordHash)

    // Invalidate all other sessions -- a password change should not leave
    // stale sessions from a potentially-compromised credential still valid.
    await this.authRepository.deleteOtherSessions("", userId)

    logger.info(`[AuthService] Password changed for: ${user.email}`)

    EventBus.publish("PasswordChanged", {
      userId,
      email: user.email,
    })

    return { email: user.email }
  }

  // Real, permanent self-service account deletion (requires the user's own
  // current password as confirmation). Every User relation in schema.prisma
  // is declared onDelete: Cascade for the data types a Candidate account
  // actually owns (profile, applications, saved jobs, sessions, refresh
  // tokens, conversations, notifications), so this is a genuine delete, not
  // the "simulated" placeholder the candidate Settings page previously showed.
  async deleteOwnAccount(userId: string, password: string) {
    const user = await this.authRepository.findUserById(userId)
    if (!user) {
      throw new Error("User not found")
    }
    if (user.passwordHash) {
      const isMatch = await comparePassword(password, user.passwordHash)
      if (!isMatch) {
        throw new Error("Password is incorrect")
      }
    }

    // this self-service path is role-agnostic --
    // any authenticated user can call it, not just candidates -- but it
    // never had the same job-ownership guard AdminService.deleteUser needed
    // (see that fix for the full explanation). A recruiter who still owns
    // job postings deleting their own account would hit the exact same
    // Job.recruiterId RESTRICT violation. The frontend only exposes this
    // flow to candidates today, but the API itself has no such restriction,
    // so this is a real gap, not just a theoretical one.
    const recruiterProfile = (user as any).recruiterProfile
    if (recruiterProfile) {
      const jobCount = await prisma.job.count({ where: { recruiterId: recruiterProfile.id } })
      if (jobCount > 0) {
        throw new Error(
          `You still own ${jobCount} job posting${jobCount === 1 ? "" : "s"}. Please contact an administrator to transfer or archive them before deleting your account.`
        )
      }
    }

    // AdminService.deleteUser already cleans up the candidate's resume file
    // before deleting the row -- this self-service path (Settings -> Delete
    // Account) never did, so a candidate deleting their own account left an
    // orphaned file on disk forever (the DB pointer is gone via cascade, but
    // nothing ever deleted the actual file).
    const resumePublicId = (user as any).candidateProfile?.resumePublicId
    if (resumePublicId) {
      try {
        await deleteFile(resumePublicId, true)
      } catch (err: any) {
        logger.warn(`[FileStorage] Failed to delete resume asset for self-deleted account ${userId}: ${err.message}`)
      }
    }

    await this.authRepository.deleteUserAccount(userId)
    logger.info(`[AuthService] Account permanently deleted for: ${user.email}`)

    EventBus.publish("AccountDeleted", {
      userId,
      email: user.email,
    })

    return { email: user.email }
  }

  private detectDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase()
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "Mobile"
    if (ua.includes("tablet") || ua.includes("ipad")) return "Tablet"
    return "Desktop"
  }
}

export default AuthService
