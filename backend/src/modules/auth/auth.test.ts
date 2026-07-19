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
      }
    }),
  }
})

import app from "../../app"
import jwt from "jsonwebtoken"
import env from "../../shared/config/env"
import { UserStatus } from "@prisma/client"
import EventBus from "../../shared/eventBus/eventBus"

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
})
