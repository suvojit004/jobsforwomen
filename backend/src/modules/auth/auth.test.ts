import request from "supertest"

// Mock the database config
jest.mock("../../shared/database/db", () => {
  const localPrismaMock = {
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: "audit-1" }),
    },
    notification: {
      create: jest.fn().mockResolvedValue({ id: "notif-1" }),
    },
    // notification.listener.ts's notifyActiveAdmins() queries prisma.user.findMany()
    // to fan a notification out to every Active Admin/Super Admin -- registering a
    // recruiter (CompanyRegistered event) and several other flows in this file
    // trigger that listener as a real side effect. Without this stub it threw
    // "Cannot read properties of undefined (reading 'findMany')" on every run
    // (silently caught by that listener's own try/catch, so it never failed an
    // assertion here, but it polluted every test's log output with a spurious
    // error). Empty result is correct for this file's purposes -- no test here
    // asserts on the admin fan-out notification itself.
    user: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  }
  return {
    ...localPrismaMock,
    prisma: localPrismaMock,
    default: localPrismaMock,
    __esModule: true,
  }
})

jest.mock("../../shared/utils/redis", () => ({
  redis: null,
  default: null,
}))

// Define mock functions before imports
const mockFindUserByEmail = jest.fn()
const mockFindUserById = jest.fn()
const mockCreateCandidateUser = jest.fn()
const mockCreateRecruiterUser = jest.fn()
const mockCreateEmailVerification = jest.fn()
const mockFindEmailVerification = jest.fn()
const mockDeleteEmailVerification = jest.fn()
const mockUpdateUserStatus = jest.fn()
const mockCreateSession = jest.fn()
const mockFindSessionsByUserId = jest.fn()
const mockDeleteSessionById = jest.fn()
const mockDeleteOtherSessions = jest.fn()
const mockCreateRefreshToken = jest.fn()
const mockFindRefreshToken = jest.fn()
const mockRevokeRefreshToken = jest.fn()
const mockFindOAuthAccount = jest.fn()
const mockCreateOAuthAccount = jest.fn()
const mockFindInvitation = jest.fn()
const mockAcceptInvitation = jest.fn()
const mockCreateInvitedUser = jest.fn()
const mockSetPendingTwoFactorSecret = jest.fn()
const mockEnableTwoFactor = jest.fn()
const mockDisableTwoFactor = jest.fn()

// Factory Mock AuthRepository
jest.mock("./auth.repository", () => {
  return {
    AuthRepository: jest.fn().mockImplementation(() => {
      return {
        findUserByEmail: mockFindUserByEmail,
        findUserById: mockFindUserById,
        createCandidateUser: mockCreateCandidateUser,
        createRecruiterUser: mockCreateRecruiterUser,
        createEmailVerification: mockCreateEmailVerification,
        findEmailVerification: mockFindEmailVerification,
        deleteEmailVerification: mockDeleteEmailVerification,
        updateUserStatus: mockUpdateUserStatus,
        createSession: mockCreateSession,
        findSessionsByUserId: mockFindSessionsByUserId,
        deleteSessionById: mockDeleteSessionById,
        deleteOtherSessions: mockDeleteOtherSessions,
        createRefreshToken: mockCreateRefreshToken,
        findRefreshToken: mockFindRefreshToken,
        revokeRefreshToken: mockRevokeRefreshToken,
        findOAuthAccount: mockFindOAuthAccount,
        createOAuthAccount: mockCreateOAuthAccount,
        findInvitation: mockFindInvitation,
        acceptInvitation: mockAcceptInvitation,
        createInvitedUser: mockCreateInvitedUser,
        setPendingTwoFactorSecret: mockSetPendingTwoFactorSecret,
        enableTwoFactor: mockEnableTwoFactor,
        disableTwoFactor: mockDisableTwoFactor,
      }
    }),
  }
})

import app from "../../app"
import jwt from "jsonwebtoken"
import env from "../../shared/config/env"
import { UserStatus } from "@prisma/client"
import EventBus from "../../shared/eventBus/eventBus"
import { generateTotpSecret, generateTotpToken, encryptTwoFactorSecret } from "../../shared/utils/twoFactor"

describe("Authentication Routes Integration Tests (Phase 3)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("POST /api/v1/auth/register/candidate", () => {
    it("should register candidate and return success with status 201", async () => {
      mockFindUserByEmail.mockResolvedValue(null)
      mockCreateCandidateUser.mockResolvedValue({
        id: "mock-candidate-id",
        email: "candidate@email.com",
        roles: [{ role: { name: "Candidate" } }],
      })
      mockCreateEmailVerification.mockResolvedValue({
        id: "verify-id",
        token: "token-123",
      })

      const res = await request(app)
        .post("/api/v1/auth/register/candidate")
        .send({
          email: "candidate@email.com",
          password: "password123",
          fullName: "Priya Sharma",
        })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty("userId", "mock-candidate-id")
      expect(mockCreateEmailVerification).toHaveBeenCalled()
    })
  })

  describe("POST /api/v1/auth/register/recruiter", () => {
    it("should register recruiter and companies records", async () => {
      mockFindUserByEmail.mockResolvedValue(null)
      mockCreateRecruiterUser.mockResolvedValue({
        id: "mock-recruiter-id",
        email: "recruiter@email.com",
        roles: [{ role: { name: "Recruiter" } }],
      })
      mockCreateEmailVerification.mockResolvedValue({
        id: "verify-id",
        token: "token-123",
      })

      const res = await request(app)
        .post("/api/v1/auth/register/recruiter")
        .send({
          email: "recruiter@email.com",
          password: "password123",
          fullName: "Sneha Reddy",
          phone: "9876543210",
          companyName: "TechNova Solutions",
          website: "https://technova.io",
          location: "Bengaluru, IN",
          industry: "Information Technology",
        })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty("userId", "mock-recruiter-id")
      expect(mockCreateEmailVerification).toHaveBeenCalled()
    })

    it("publishes a CompanyRegistered domain event for the audit/admin-notification listener (Part 1)", async () => {
      mockFindUserByEmail.mockResolvedValue(null)
      mockCreateRecruiterUser.mockResolvedValue({
        id: "mock-recruiter-id-2",
        email: "recruiter2@email.com",
        roles: [{ role: { name: "Recruiter" } }],
        recruiterProfile: { companyId: "company-abc" },
      })
      mockCreateEmailVerification.mockResolvedValue({
        id: "verify-id-2",
        token: "token-456",
      })

      const publishSpy = jest.spyOn(EventBus, "publish")

      const res = await request(app)
        .post("/api/v1/auth/register/recruiter")
        .send({
          email: "recruiter2@email.com",
          password: "password123",
          fullName: "Anita Rao",
          phone: "9876500000",
          companyName: "GreenLeaf Analytics",
          website: "https://greenleaf.io",
          location: "Pune, IN",
          industry: "Analytics",
        })

      expect(res.status).toBe(201)
      expect(publishSpy).toHaveBeenCalledWith(
        "CompanyRegistered",
        expect.objectContaining({
          companyId: "company-abc",
          companyName: "GreenLeaf Analytics",
          recruiterEmail: "recruiter2@email.com",
        })
      )

      publishSpy.mockRestore()
    })
  })

  describe("GET /api/v1/auth/verify-email", () => {
    it("should verify email link and update status", async () => {
      mockFindEmailVerification.mockResolvedValue({
        id: "verify-id",
        email: "candidate@email.com",
        expiresAt: new Date(Date.now() + 100000),
      })
      mockFindUserByEmail.mockResolvedValue({
        id: "candidate-id",
        email: "candidate@email.com",
        roles: [{ role: { name: "Candidate" } }],
      })
      mockUpdateUserStatus.mockResolvedValue({
        id: "candidate-id",
        status: UserStatus.Active,
      })
      mockDeleteEmailVerification.mockResolvedValue({})

      const res = await request(app)
        .get("/api/v1/auth/verify-email")
        .query({ token: "verification-token-123" })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(mockUpdateUserStatus).toHaveBeenCalledWith("candidate-id", UserStatus.Active)
    })
  })

  describe("POST /api/v1/auth/login", () => {
    it("should authenticate active users and inject refresh cookie", async () => {
      const bcrypt = require("bcrypt")
      jest.spyOn(bcrypt, "compare").mockResolvedValue(true as never)

      mockFindUserByEmail.mockResolvedValue({
        id: "user-id",
        email: "candidate@email.com",
        status: UserStatus.Active,
        passwordHash: "$2b$10$hashedpass",
        roles: [
          {
            role: {
              name: "Candidate",
              permissions: [{ permission: { name: "read:job" } }],
            },
          },
        ],
        candidateProfile: {
          fullName: "Priya Sharma",
        },
      })
      mockCreateSession.mockResolvedValue({ id: "session-id" })
      mockCreateRefreshToken.mockResolvedValue({ id: "token-id" })

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "candidate@email.com",
          password: "password123",
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty("accessToken")
      expect(res.headers["set-cookie"]).toBeDefined()
    })
  })

  // Regression coverage for the soft-delete/status-gate audit: login()
  // already checked Blocked/Suspended/Rejected, but oauth() and refresh()
  // didn't consistently -- see AuthService.assertAccountActive.
  describe("Account status gate consistency across login paths (Part: soft-delete audit)", () => {
    it("rejects an OAuth login for a Blocked user with an existing linked account", async () => {
      const blockedUser = {
        id: "blocked-user-id",
        email: "blocked@email.com",
        status: UserStatus.Blocked,
        roles: [{ role: { name: "Candidate", permissions: [] } }],
      }
      mockFindOAuthAccount.mockResolvedValue({ user: blockedUser })
      // oauth() does not pass the account's embedded user straight through --
      // it re-reads the full record with findUserById(user.id) and hands THAT
      // to createAuthSession(). Without this mock the re-read returns
      // undefined and assertAccountActive() throws a TypeError (a 500) rather
      // than the "account has been blocked" rejection under test.
      mockFindUserById.mockResolvedValue(blockedUser)

      const res = await request(app)
        .post("/api/v1/auth/oauth")
        .send({
          provider: "google",
          // `token` is required by oauthSchema -- without it the request fails
          // Zod validation with a 400 and never reaches the account-status
          // gate this test is asserting on.
          token: "google-oauth-token",
          providerUserId: "google-uid-1",
          email: "blocked@email.com",
          fullName: "Blocked User",
        })

      expect(res.status).toBe(403)
      expect(res.body.message).toMatch(/blocked/i)
    })

    it("rejects refreshing a token for a Suspended user (not just Blocked)", async () => {
      const refreshToken = jwt.sign({ userId: "suspended-user-id" }, env.JWT_REFRESH_SECRET)

      mockFindRefreshToken.mockResolvedValue({
        token: refreshToken,
        revoked: false,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      })
      mockFindUserById.mockResolvedValue({
        id: "suspended-user-id",
        email: "suspended@email.com",
        status: UserStatus.Suspended,
        roles: [{ role: { name: "Candidate", permissions: [] } }],
      })

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken })

      expect(res.status).toBe(403)
      expect(res.body.message).toMatch(/suspended/i)
    })
  })

  describe("POST /api/v1/auth/login - recruiter company approval gate (Part 4)", () => {
    const recruiterUserWithCompany = (companyStatus: string) => ({
      id: "recruiter-id",
      email: "recruiter@email.com",
      status: UserStatus.PendingApproval,
      passwordHash: "$2b$10$hashedpass",
      roles: [
        {
          role: {
            name: "Recruiter",
            permissions: [{ permission: { name: "create:job" } }],
          },
        },
      ],
      recruiterProfile: {
        companyId: "company-id",
        company: { id: "company-id", status: companyStatus },
      },
    })

    beforeEach(() => {
      const bcrypt = require("bcrypt")
      jest.spyOn(bcrypt, "compare").mockResolvedValue(true as never)
    })

    it("blocks login while company verification is pending", async () => {
      mockFindUserByEmail.mockResolvedValue(recruiterUserWithCompany("pending"))

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "recruiter@email.com", password: "password123" })

      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
      expect(res.body.message).toMatch(/still pending/i)
    })

    it("blocks login when company verification was rejected", async () => {
      mockFindUserByEmail.mockResolvedValue(recruiterUserWithCompany("rejected"))

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "recruiter@email.com", password: "password123" })

      expect(res.status).toBe(403)
      expect(res.body.message).toMatch(/rejected/i)
    })

    it("blocks login when more information is required", async () => {
      mockFindUserByEmail.mockResolvedValue(recruiterUserWithCompany("info_requested"))

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "recruiter@email.com", password: "password123" })

      expect(res.status).toBe(403)
      expect(res.body.message).toMatch(/additional information/i)
    })

    it("allows login once the company is approved", async () => {
      mockFindUserByEmail.mockResolvedValue(recruiterUserWithCompany("approved"))
      mockCreateSession.mockResolvedValue({ id: "session-id" })
      mockCreateRefreshToken.mockResolvedValue({ id: "token-id" })

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "recruiter@email.com", password: "password123" })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty("accessToken")
    })
  })

  describe("GET /api/v1/auth/sessions", () => {
    it("should list active sessions for authenticated users", async () => {
      const accessToken = jwt.sign(
        { userId: "user-id", email: "candidate@email.com", roles: ["Candidate"], permissions: ["read:job"] },
        env.JWT_ACCESS_SECRET
      )

      mockFindSessionsByUserId.mockResolvedValue([
        { id: "sess-1", ipAddress: "127.0.0.1", userAgent: "Chrome" },
      ])

      const res = await request(app)
        .get("/api/v1/auth/sessions")
        .set("Authorization", `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.sessions).toHaveLength(1)
    })
  })

  // Force 2FA fix: twoFactorEnabled existed on User as a stub that nothing
  // read or wrote. Now real -- login() pauses with a pending challenge
  // instead of issuing tokens, and enrollment is a real TOTP secret +
  // confirmation flow.
  describe("Two-Factor Authentication", () => {
    beforeEach(() => {
      const bcrypt = require("bcrypt")
      jest.spyOn(bcrypt, "compare").mockResolvedValue(true as never)
    })

    it("pauses login with a pending challenge instead of issuing tokens when 2FA is enabled", async () => {
      mockFindUserByEmail.mockResolvedValue({
        id: "2fa-user-id",
        email: "twofactor@email.com",
        status: UserStatus.Active,
        passwordHash: "$2b$10$hashedpass",
        twoFactorEnabled: true,
        roles: [{ role: { name: "Candidate", permissions: [] } }],
      })

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "twofactor@email.com", password: "password123" })

      expect(res.status).toBe(200)
      expect(res.body.data.requiresTwoFactor).toBe(true)
      expect(typeof res.body.data.pendingToken).toBe("string")
      expect(res.body.data.accessToken).toBeUndefined()
      expect(res.headers["set-cookie"]).toBeUndefined()
      expect(mockCreateSession).not.toHaveBeenCalled()
    })

    it("completes login via POST /auth/2fa/verify with a valid code", async () => {
      const secret = generateTotpSecret()
      const validCode = generateTotpToken(secret)

      mockFindUserByEmail.mockResolvedValue({
        id: "2fa-user-id-2",
        email: "twofactor2@email.com",
        status: UserStatus.Active,
        passwordHash: "$2b$10$hashedpass",
        twoFactorEnabled: true,
        roles: [{ role: { name: "Candidate", permissions: [] } }],
      })

      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "twofactor2@email.com", password: "password123" })
      const pendingToken = loginRes.body.data.pendingToken

      mockFindUserById.mockResolvedValue({
        id: "2fa-user-id-2",
        email: "twofactor2@email.com",
        status: UserStatus.Active,
        twoFactorEnabled: true,
        twoFactorSecret: encryptTwoFactorSecret(secret),
        roles: [{ role: { name: "Candidate", permissions: [] } }],
      })
      mockCreateSession.mockResolvedValue({ id: "session-id-2fa" })
      mockCreateRefreshToken.mockResolvedValue({ id: "token-id-2fa" })

      const verifyRes = await request(app)
        .post("/api/v1/auth/2fa/verify")
        .send({ pendingToken, code: validCode })

      expect(verifyRes.status).toBe(200)
      expect(verifyRes.body.success).toBe(true)
      expect(verifyRes.body.data).toHaveProperty("accessToken")
      expect(verifyRes.headers["set-cookie"]).toBeDefined()
    })

    it("rejects POST /auth/2fa/verify with an incorrect code", async () => {
      const secret = generateTotpSecret()

      mockFindUserByEmail.mockResolvedValue({
        id: "2fa-user-id-3",
        email: "twofactor3@email.com",
        status: UserStatus.Active,
        passwordHash: "$2b$10$hashedpass",
        twoFactorEnabled: true,
        roles: [{ role: { name: "Candidate", permissions: [] } }],
      })

      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "twofactor3@email.com", password: "password123" })
      const pendingToken = loginRes.body.data.pendingToken

      mockFindUserById.mockResolvedValue({
        id: "2fa-user-id-3",
        twoFactorEnabled: true,
        twoFactorSecret: encryptTwoFactorSecret(secret),
        roles: [{ role: { name: "Candidate", permissions: [] } }],
      })

      const verifyRes = await request(app)
        .post("/api/v1/auth/2fa/verify")
        .send({ pendingToken, code: "000000" })

      expect(verifyRes.status).toBe(401)
      expect(verifyRes.body.message).toMatch(/invalid authentication code/i)
    })

    it("rejects a pendingToken signed for a different purpose (e.g. a real access token can't be reused here)", async () => {
      const realAccessToken = jwt.sign(
        { userId: "some-user", email: "x@y.com", roles: ["Candidate"], permissions: [] },
        env.JWT_ACCESS_SECRET
      )

      const res = await request(app)
        .post("/api/v1/auth/2fa/verify")
        .send({ pendingToken: realAccessToken, code: "123456" })

      expect(res.status).toBe(401)
      expect(res.body.message).toMatch(/expired/i)
    })

    it("starts enrollment with a real TOTP secret and otpauth URI, without enabling 2FA yet", async () => {
      const accessToken = jwt.sign(
        { userId: "enroll-user-id", email: "enroll@email.com", roles: ["Admin"], permissions: [] },
        env.JWT_ACCESS_SECRET
      )
      mockFindUserById.mockResolvedValue({
        id: "enroll-user-id",
        email: "enroll@email.com",
        twoFactorEnabled: false,
        roles: [{ role: { name: "Admin", permissions: [] } }],
      })
      mockSetPendingTwoFactorSecret.mockResolvedValue({})

      const res = await request(app)
        .post("/api/v1/auth/2fa/enroll/start")
        .set("Authorization", `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(typeof res.body.data.secret).toBe("string")
      expect(res.body.data.otpauthUri).toContain("otpauth://totp/")
      expect(mockSetPendingTwoFactorSecret).toHaveBeenCalledWith("enroll-user-id", expect.any(String))
      // The stored secret must be encrypted, not the plaintext one returned to the client.
      expect(mockSetPendingTwoFactorSecret.mock.calls[0][1]).not.toBe(res.body.data.secret)
    })

    it("confirms enrollment with a valid code and enables 2FA", async () => {
      const secret = generateTotpSecret()
      const validCode = generateTotpToken(secret)
      const accessToken = jwt.sign(
        { userId: "confirm-user-id", email: "confirm@email.com", roles: ["Admin"], permissions: [] },
        env.JWT_ACCESS_SECRET
      )
      mockFindUserById.mockResolvedValue({
        id: "confirm-user-id",
        email: "confirm@email.com",
        twoFactorEnabled: false,
        twoFactorSecret: encryptTwoFactorSecret(secret),
        roles: [{ role: { name: "Admin", permissions: [] } }],
      })
      mockEnableTwoFactor.mockResolvedValue({})

      const res = await request(app)
        .post("/api/v1/auth/2fa/enroll/confirm")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ code: validCode })

      expect(res.status).toBe(200)
      expect(res.body.data.twoFactorEnabled).toBe(true)
      expect(mockEnableTwoFactor).toHaveBeenCalledWith("confirm-user-id")
    })

    it("disables 2FA only after re-verifying the current password", async () => {
      const accessToken = jwt.sign(
        { userId: "disable-user-id", email: "disable@email.com", roles: ["Admin"], permissions: [] },
        env.JWT_ACCESS_SECRET
      )
      mockFindUserById.mockResolvedValue({
        id: "disable-user-id",
        email: "disable@email.com",
        passwordHash: "$2b$10$hashedpass",
        twoFactorEnabled: true,
        roles: [{ role: { name: "Admin", permissions: [] } }],
      })
      mockDisableTwoFactor.mockResolvedValue({})

      const res = await request(app)
        .post("/api/v1/auth/2fa/disable")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ password: "correct-password" })

      expect(res.status).toBe(200)
      expect(res.body.data.twoFactorEnabled).toBe(false)
      expect(mockDisableTwoFactor).toHaveBeenCalledWith("disable-user-id")
    })

    it("rejects disabling 2FA with the wrong password", async () => {
      const bcrypt = require("bcrypt")
      jest.spyOn(bcrypt, "compare").mockResolvedValueOnce(false as never)

      const accessToken = jwt.sign(
        { userId: "disable-user-id-2", email: "disable2@email.com", roles: ["Admin"], permissions: [] },
        env.JWT_ACCESS_SECRET
      )
      mockFindUserById.mockResolvedValue({
        id: "disable-user-id-2",
        passwordHash: "$2b$10$hashedpass",
        twoFactorEnabled: true,
        roles: [{ role: { name: "Admin", permissions: [] } }],
      })

      const res = await request(app)
        .post("/api/v1/auth/2fa/disable")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ password: "wrong-password" })

      expect(res.status).toBe(401)
      expect(mockDisableTwoFactor).not.toHaveBeenCalled()
    })
  })
})
