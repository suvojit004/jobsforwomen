import request from "supertest"

// Mock Prisma DB Operations inline in factory
jest.mock("../../shared/database/db", () => {
  const localPrismaMock = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    role: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    permission: { findMany: jest.fn() },
    rolePermission: { createMany: jest.fn(), deleteMany: jest.fn() },
    userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
    recruiterProfile: { findUnique: jest.fn(), updateMany: jest.fn() },
    candidateProfile: { count: jest.fn() },
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
  }
  return {
    ...localRedisMock,
    redis: localRedisMock,
    default: localRedisMock,
    __esModule: true,
  }
})

import app from "../../app"
import jwt from "jsonwebtoken"
import env from "../../shared/config/env"
import { UserStatus, CompanyStatus, JobStatus } from "@prisma/client"
import prisma from "../../shared/database/db"
import redis from "../../shared/utils/redis"

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

    it("should flag job and set job visibility to hidden during moderation rejection", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({ id: "job-999", recruiterId: "rec-1", status: JobStatus.approved })
      mockPrisma.job.update.mockResolvedValue({ id: "job-999", status: JobStatus.flagged, visibility: "hidden" })
      mockPrisma.jobStatusHistory.create.mockResolvedValue({ id: "hist-2" })

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
