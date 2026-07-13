import request from "supertest"

// Mock Prisma DB Operations inline in factory
jest.mock("../../shared/database/db", () => {
  const localPrismaMock = {
    user: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    role: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    permission: { findMany: jest.fn() },
    rolePermission: { createMany: jest.fn(), deleteMany: jest.fn() },
    userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
    recruiterProfile: { findUnique: jest.fn(), updateMany: jest.fn() },
    company: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    companyVerificationHistory: { create: jest.fn() },
    industry: { upsert: jest.fn() },
    department: { upsert: jest.fn() },
    job: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    jobStatusHistory: { create: jest.fn() },
    jobReport: { count: jest.fn() },
    jobSkill: { findMany: jest.fn() },
    candidateSkill: { findMany: jest.fn() },
    candidateProfile: { count: jest.fn(), findMany: jest.fn() },
    application: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    invitation: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
    companyBenefit: { updateMany: jest.fn() },
    featureFlag: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
    notification: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (callback) => await callback(localPrismaMock)),
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  }
  return {
    ...localPrismaMock,
    prisma: localPrismaMock,
    default: localPrismaMock,
    __esModule: true,
  }
})

// Mock Redis Caching operations inline in factory
jest.mock("../../shared/utils/redis", () => {
  const localRedisMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    // getSystemHealth() does a real readiness check (redis.status === "ready")
    // and a real PING round-trip rather than a hardcoded "UP" -- the mock
    // needs to simulate a healthy, connected client for that check to pass.
    status: "ready",
    ping: jest.fn().mockResolvedValue("PONG"),
  }
  return {
    ...localRedisMock,
    redis: localRedisMock,
    default: localRedisMock,
    __esModule: true,
  }
})

// getSystemHealth() also performs a real SMTP verify() and a real Cloudinary
// Admin API ping. Both would otherwise make real outbound network calls
// during tests (slow, flaky, and dependent on live credentials), so only
// those two specific functions are stubbed here -- everything else these
// modules export keeps its real implementation via jest.requireActual.
jest.mock("../../shared/utils/email", () => {
  const actual = jest.requireActual("../../shared/utils/email")
  return {
    ...actual,
    verifyEmailTransport: jest.fn().mockResolvedValue(true),
    // __esModule must be re-declared explicitly: `Object.defineProperty(exports,
    // "__esModule", ...)` in the real compiled output defines it as
    // non-enumerable, so `{...actual}` silently drops it. Without it, TS's
    // `__importDefault` interop helper can't tell this mock is an ES module
    // and wraps the WHOLE mocked object as `{ default: mockedObject }`
    // instead of preserving the real `default` (the EmailService class) --
    // which is exactly what broke every `EmailService.sendXyzEmail(...)` call
    // in queue.ts ("email_1.default.sendXyzEmail is not a function") the
    // first time this file mocked this module.
    __esModule: true,
  }
})

jest.mock("../../shared/utils/cloudinary", () => {
  const actual = jest.requireActual("../../shared/utils/cloudinary")
  return {
    ...actual,
    verifyCloudinaryConnection: jest.fn().mockResolvedValue(true),
    __esModule: true,
  }
})

import app from "../../app"
import jwt from "jsonwebtoken"
import env from "../../shared/config/env"
import { UserStatus, CompanyStatus, JobStatus } from "@prisma/client"
import prisma from "../../shared/database/db"
import redis from "../../shared/utils/redis"
import EventBus from "../../shared/eventBus/eventBus"

const mockPrisma = prisma as any
const mockRedis = redis as any

describe("Admin Module Integration Tests (Phase 7)", () => {
  let superAdminToken: string
  let moderatorToken: string

  beforeEach(() => {
    jest.clearAllMocks()

    superAdminToken = jwt.sign(
      { userId: "super-admin-id", email: "super@jfw.info", roles: ["Super Admin"], permissions: ["manage:admin"] },
      env.JWT_ACCESS_SECRET
    )

    moderatorToken = jwt.sign(
      { userId: "moderator-id", email: "moderator@jfw.info", roles: ["Moderator"], permissions: ["manage:admin"] },
      env.JWT_ACCESS_SECRET
    )

    mockRedis.get.mockImplementation(async (key: string) => {
      return JSON.stringify(["manage:admin"])
    })

    mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
      return {
        id: args.where.id,
        status: UserStatus.Active,
        email: "admin@jfw.info",
      }
    })
  })

  describe("Super Admin Safeguards & Protections", () => {
    it("should prevent non-Super Admin from creating new roles", async () => {
      const res = await request(app)
        .post("/api/v1/admins/rbac/roles")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .send({
          name: "Moderator Support",
          permissions: ["post:job"],
        })

      expect(res.status).toBe(403)
      expect(res.body.message).toContain("Super Admin role required")
    })

    it("should allow Super Admin to configure platform feature flags", async () => {
      mockPrisma.featureFlag.create.mockResolvedValue({
        id: "flag-1",
        key: "wfh_jobs_filter",
        value: true,
        category: "Platform",
      })

      const res = await request(app)
        .post("/api/v1/admins/feature-flags")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          key: "wfh_jobs_filter",
          value: true,
          category: "Platform",
          description: "Enable filtering by WFH status",
        })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.key).toBe("wfh_jobs_filter")
    })
  })

  describe("Company & Job Moderation Workflow Boundaries", () => {
    it("should verify company, update associated recruiter status and save verification history audit log", async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: "comp-123", name: "Tech Corp" })
      mockPrisma.companyVerificationHistory.create.mockResolvedValue({ id: "hist-1" })
      mockPrisma.company.update.mockResolvedValue({ id: "comp-123", status: CompanyStatus.approved })

      const res = await request(app)
        .post("/api/v1/admins/companies/comp-123/verify")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .send({
          status: CompanyStatus.approved,
          notes: "All documents valid and checked.",
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(mockPrisma.companyVerificationHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: "comp-123",
            status: CompanyStatus.approved,
            notes: "All documents valid and checked.",
          }),
        })
      )
      expect(mockPrisma.recruiterProfile.updateMany).toHaveBeenCalledWith({
        where: { companyId: "comp-123" },
        data: { verified: true },
      })
    })

    it("should flag job and set job visibility to hidden during moderation rejection, and notify the recruiter with the reason", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "job-999",
        title: "Rejected Posting",
        recruiterId: "rec-1",
        companyId: "comp-1",
        status: JobStatus.approved,
        recruiter: { userId: "rec-user-1" },
        company: { id: "comp-1", name: "Test Co" },
      })
      mockPrisma.job.update.mockResolvedValue({ id: "job-999", status: JobStatus.flagged, visibility: "hidden" })
      mockPrisma.jobStatusHistory.create.mockResolvedValue({ id: "hist-2" })
      mockPrisma.notification.create.mockImplementation(async ({ data }: any) => ({ id: "notif-1", ...data }))

      const res = await request(app)
        .post("/api/v1/admins/jobs/job-999/moderate")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .send({
          action: "reject",
          notes: "Content contains spam.",
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job-999" },
          data: expect.objectContaining({
            status: JobStatus.flagged,
            visibility: "hidden",
          }),
        })
      )

      // Notification creation is dispatched via a detached async EventBus
      // handler that the HTTP response doesn't wait for.
      await EventBus.allSettled()

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipientId: "rec-user-1",
            title: "Job Posting Rejected",
            message: expect.stringContaining("Content contains spam."),
            actionUrl: "/recruiter/jobs/job-999",
            dedupeKey: "job-rejected:job-999",
          }),
        })
      )
    })

    it("should approve a job, notify the owning recruiter, and notify only matched active candidates", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "job-approve-1",
        title: "React Developer",
        location: "Bangalore, India",
        recruiterId: "rec-2",
        companyId: "comp-2",
        status: JobStatus.pending_approval,
        recruiter: { userId: "rec-user-2" },
        company: { id: "comp-2", name: "Approve Co" },
      })
      mockPrisma.job.update.mockResolvedValue({ id: "job-approve-1", status: JobStatus.approved, visibility: "visible" })
      mockPrisma.jobStatusHistory.create.mockResolvedValue({ id: "hist-3" })
      mockPrisma.notification.create.mockImplementation(async ({ data }: any) => ({ id: "notif-" + data.recipientId, ...data }))

      // Skill match: job requires skill "react-skill-id"
      mockPrisma.jobSkill.findMany.mockResolvedValue([{ skillId: "react-skill-id" }])
      mockPrisma.candidateSkill.findMany.mockResolvedValue([
        { candidate: { userId: "candidate-skill-match" } },
      ])
      // Location match: one candidate's stored location contains the job's location
      mockPrisma.candidateProfile.findMany.mockResolvedValue([
        { userId: "candidate-location-match", location: "Bangalore", preferredLocations: [] },
        { userId: "candidate-skill-match", location: "Remote", preferredLocations: [] }, // also matches by skill -- must be deduped, not notified twice
        { userId: "candidate-no-match", location: "Delhi", preferredLocations: [] },
      ])

      const res = await request(app)
        .post("/api/v1/admins/jobs/job-approve-1/moderate")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .send({ action: "approve" })

      expect(res.status).toBe(200)
      await EventBus.allSettled()

      // Recruiter notified
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipientId: "rec-user-2",
            title: "Job Posting Approved",
            actionUrl: "/recruiter/jobs/job-approve-1",
          }),
        })
      )

      // Matched candidates notified (skill match + location match), each exactly once
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ recipientId: "candidate-skill-match" }) })
      )
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ recipientId: "candidate-location-match" }) })
      )
      const skillMatchCalls = mockPrisma.notification.create.mock.calls.filter(
        ([arg]: any) => arg.data.recipientId === "candidate-skill-match"
      )
      expect(skillMatchCalls).toHaveLength(1) // deduped, not notified twice for matching both ways

      // Unmatched candidate never notified
      expect(mockPrisma.notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ recipientId: "candidate-no-match" }) })
      )
    })
  })

  describe("User Management & Cached Permissions Invalidation", () => {
    it("should suspend user account and delete target user permissions cache in Redis", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: "super-admin-id", status: UserStatus.Active }) // for middleware
        .mockResolvedValueOnce({ id: "cand-777", status: UserStatus.Active }) // for target lookup
      mockPrisma.user.update.mockResolvedValue({ id: "cand-777", status: UserStatus.Suspended })

      const res = await request(app)
        .put("/api/v1/admins/users/cand-777/status")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          status: UserStatus.Suspended,
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      // Assert Redis deletion key check
      expect(mockRedis.del).toHaveBeenCalledWith("user:permissions:cand-777")
    })
  })

  describe("System Health API Exposer", () => {
    it("should return detailed platform system status parameters", async () => {
      const res = await request(app)
        .get("/api/v1/admins/health")
        .set("Authorization", `Bearer ${moderatorToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.database).toBe("UP")
      expect(res.body.data.redis).toBe("UP")
      expect(res.body.data.email).toBe("UP")
      expect(res.body.data.storage).toBe("UP")
      expect(res.body.data.socketio).toBeDefined()
      expect(res.body.data.apiUptime).toBeDefined()
    })
  })

  describe("Employee Invitation Lifecycle Management", () => {
    it("should dispatch EmployeeInvited event when sending a new employee invitation", async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ id: "role-support", name: "Support Executive" })
      mockPrisma.invitation.create.mockResolvedValue({
        id: "inv-1",
        email: "support@jfw.info",
        status: "Pending",
      })

      const res = await request(app)
        .post("/api/v1/admins/invitations")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          email: "support@jfw.info",
          roleName: "Support Executive",
        })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.email).toBe("support@jfw.info")
    })
  })
})
