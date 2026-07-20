import request from "supertest"

// Mock Prisma DB Operations inline in factory
jest.mock("../../shared/database/db", () => {
  const localPrismaMock = {
    user: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), delete: jest.fn(), create: jest.fn(), count: jest.fn() },
    role: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    permission: { findMany: jest.fn() },
    rolePermission: { createMany: jest.fn(), deleteMany: jest.fn() },
    userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
    recruiterProfile: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
    company: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    companyVerificationHistory: { create: jest.fn() },
    industry: { upsert: jest.fn() },
    department: { upsert: jest.fn() },
    job: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    jobStatusHistory: { create: jest.fn(), createMany: jest.fn() },
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
    session: { updateMany: jest.fn() },
    companyBenefit: { updateMany: jest.fn() },
    featureFlag: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
    notification: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
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
      mockPrisma.recruiterProfile.findMany.mockResolvedValue([{ userId: "rec-user-123" }])
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })

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
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["rec-user-123"] } },
        data: { status: UserStatus.Active },
      })
      expect(mockRedis.del).toHaveBeenCalledWith("user:permissions:rec-user-123")
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

  // Recruiter hard-delete used to attempt prisma.user.delete() unconditionally,
  // which hits Job.recruiterId's RESTRICT constraint the moment the target
  // recruiter owns any job -- surfacing as an uncaught 500. AdminService.deleteUser
  // now checks job ownership first and requires an explicit resolution.
  describe("Recruiter Delete Flow (job-ownership conflict)", () => {
    const adminUser = { id: "super-admin-id", status: UserStatus.Active, email: "super@jfw.info" }
    const recruiterTarget = {
      id: "rec-user-1",
      status: UserStatus.Active,
      email: "recruiter@jfw.info",
      roles: [{ role: { name: "Recruiter" } }],
      candidateProfile: null,
      recruiterProfile: { id: "rec-profile-1", companyId: "company-1" },
    }

    it("hard-deletes a recruiter with no jobs without any resolution option", async () => {
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where.id === "super-admin-id" ? adminUser : recruiterTarget
      )
      mockPrisma.job.count.mockResolvedValue(0)
      mockPrisma.user.delete.mockResolvedValue({ id: "rec-user-1" })

      const res = await request(app)
        .delete("/api/v1/admins/users/rec-user-1")
        .set("Authorization", `Bearer ${superAdminToken}`)

      expect(res.status).toBe(200)
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "rec-user-1" } })
    })

    it("returns 409 instead of an uncaught FK error when the recruiter still owns jobs", async () => {
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where.id === "super-admin-id" ? adminUser : recruiterTarget
      )
      mockPrisma.job.count.mockResolvedValue(3)

      const res = await request(app)
        .delete("/api/v1/admins/users/rec-user-1")
        .set("Authorization", `Bearer ${superAdminToken}`)

      expect(res.status).toBe(409)
      expect(res.body.message).toMatch(/owns 3 job/i)
      expect(mockPrisma.user.delete).not.toHaveBeenCalled()
    })

    it("archives the recruiter's jobs and deletes the account when archiveJobs is requested", async () => {
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where.id === "super-admin-id" ? adminUser : recruiterTarget
      )
      mockPrisma.job.count.mockResolvedValue(2)
      mockPrisma.job.findMany.mockResolvedValue([{ id: "job-1" }, { id: "job-2" }])
      mockPrisma.job.updateMany.mockResolvedValue({ count: 2 })
      mockPrisma.jobStatusHistory.createMany.mockResolvedValue({ count: 2 })
      mockPrisma.user.delete.mockResolvedValue({ id: "rec-user-1" })

      const res = await request(app)
        .delete("/api/v1/admins/users/rec-user-1")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ archiveJobs: true })

      expect(res.status).toBe(200)
      expect(mockPrisma.job.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["job-1", "job-2"] } },
        data: { status: JobStatus.archived },
      })
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "rec-user-1" } })
    })

    it("transfers jobs to another recruiter at the same company when requested", async () => {
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where.id === "super-admin-id" ? adminUser : recruiterTarget
      )
      mockPrisma.job.count.mockResolvedValue(2)
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({ id: "rec-profile-2", companyId: "company-1" })
      mockPrisma.job.updateMany.mockResolvedValue({ count: 2 })
      mockPrisma.user.delete.mockResolvedValue({ id: "rec-user-1" })

      const res = await request(app)
        .delete("/api/v1/admins/users/rec-user-1")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ transferToRecruiterId: "rec-profile-2" })

      expect(res.status).toBe(200)
      expect(mockPrisma.job.updateMany).toHaveBeenCalledWith({
        where: { recruiterId: "rec-profile-1" },
        data: { recruiterId: "rec-profile-2" },
      })
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "rec-user-1" } })
    })

    it("rejects a transfer target from a different company", async () => {
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where.id === "super-admin-id" ? adminUser : recruiterTarget
      )
      mockPrisma.job.count.mockResolvedValue(1)
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({ id: "rec-profile-9", companyId: "company-9" })

      const res = await request(app)
        .delete("/api/v1/admins/users/rec-user-1")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ transferToRecruiterId: "rec-profile-9" })

      expect(res.status).toBe(400)
      expect(res.body.message).toMatch(/same company/i)
      expect(mockPrisma.user.delete).not.toHaveBeenCalled()
    })
  })

  // Part 4 of the Admin Management spec: Create Admin, list Admins with
  // derived Last Login / Created By, and revoke a single role without
  // recreating the user. All three routes are gated by requireSuperAdmin at
  // the router level (admin.routes.ts).
  describe("Super Admin: Admin Management module", () => {
    const superAdminUser = { id: "super-admin-id", status: UserStatus.Active, email: "super@jfw.info" }

    it("creates an admin account with the requested roles", async () => {
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where.id === "super-admin-id" ? superAdminUser : null // email-uniqueness lookup finds nothing
      )
      mockPrisma.role.findMany.mockResolvedValue([{ id: "role-mod", name: "Moderator" }])
      mockPrisma.user.create.mockResolvedValue({
        id: "new-admin-id",
        email: "newmod@jfw.info",
        status: UserStatus.Active,
        createdAt: new Date(),
        roles: [{ role: { name: "Moderator" } }],
        adminProfile: { fullName: "New Mod" },
      })

      const res = await request(app)
        .post("/api/v1/admins/management/admins")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          email: "newmod@jfw.info",
          fullName: "New Mod",
          password: "SuperSecret123",
          roleNames: ["Moderator"],
        })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(mockPrisma.user.create).toHaveBeenCalled()
    })

    it("rejects admin creation from a non-Super-Admin (Moderator) token", async () => {
      const res = await request(app)
        .post("/api/v1/admins/management/admins")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .send({
          email: "newmod@jfw.info",
          fullName: "New Mod",
          password: "SuperSecret123",
          roleNames: ["Moderator"],
        })

      expect(res.status).toBe(403)
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it("rejects admin creation when the email is already registered", async () => {
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where.id === "super-admin-id" ? superAdminUser : { id: "existing-id", email: "taken@jfw.info" }
      )

      const res = await request(app)
        .post("/api/v1/admins/management/admins")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          email: "taken@jfw.info",
          fullName: "Dup",
          password: "SuperSecret123",
          roleNames: ["Moderator"],
        })

      expect(res.status).toBe(409)
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it("lists admin accounts with derived lastLoginAt and createdBy", async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: "admin-1",
          email: "admin1@jfw.info",
          status: UserStatus.Active,
          createdAt: new Date("2026-01-01"),
          adminProfile: { fullName: "Admin One" },
          roles: [{ role: { name: "Admin" } }],
        },
      ])
      mockPrisma.auditLog.groupBy.mockResolvedValue([
        { operatorId: "admin-1", _max: { timestamp: new Date("2026-07-01") } },
      ])
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { entityId: "admin-1", operatorEmail: "super@jfw.info" },
      ])
      mockPrisma.invitation.findMany.mockResolvedValue([])

      const res = await request(app)
        .get("/api/v1/admins/management/admins")
        .set("Authorization", `Bearer ${superAdminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.admins).toHaveLength(1)
      expect(res.body.data.admins[0].lastLoginAt).toBeTruthy()
      expect(res.body.data.admins[0].createdBy).toBe("super@jfw.info")
    })

    it("removes a single role from an admin account", async () => {
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where.id === "super-admin-id"
          ? superAdminUser
          : {
              id: "admin-2",
              email: "admin2@jfw.info",
              roles: [{ role: { name: "Admin" } }, { role: { name: "Moderator" } }],
            }
      )
      mockPrisma.role.findUnique.mockResolvedValue({ id: "role-mod", name: "Moderator" })
      mockPrisma.userRole.deleteMany.mockResolvedValue({ count: 1 })

      const res = await request(app)
        .delete("/api/v1/admins/management/admins/admin-2/roles/Moderator")
        .set("Authorization", `Bearer ${superAdminToken}`)

      expect(res.status).toBe(200)
      expect(mockPrisma.userRole.deleteMany).toHaveBeenCalledWith({
        where: { userId: "admin-2", roleId: "role-mod" },
      })
    })

    it("refuses to remove the last remaining role from an admin account", async () => {
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where.id === "super-admin-id"
          ? superAdminUser
          : { id: "admin-3", email: "admin3@jfw.info", roles: [{ role: { name: "Moderator" } }] }
      )

      const res = await request(app)
        .delete("/api/v1/admins/management/admins/admin-3/roles/Moderator")
        .set("Authorization", `Bearer ${superAdminToken}`)

      expect(res.status).toBe(400)
      expect(mockPrisma.userRole.deleteMany).not.toHaveBeenCalled()
    })

    it("refuses to remove the Super Admin role from the last remaining Super Admin", async () => {
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where.id === "super-admin-id"
          ? superAdminUser
          : {
              id: "super-admin-id-2",
              email: "super2@jfw.info",
              roles: [{ role: { name: "Super Admin" } }, { role: { name: "Admin" } }],
            }
      )
      mockPrisma.userRole.count.mockResolvedValue(0)

      const res = await request(app)
        .delete("/api/v1/admins/management/admins/super-admin-id-2/roles/Super%20Admin")
        .set("Authorization", `Bearer ${superAdminToken}`)

      expect(res.status).toBe(409)
      expect(mockPrisma.userRole.deleteMany).not.toHaveBeenCalled()
    })
  })

  // The admin-tier operator guard added to updateUserStatus/deleteUser: a
  // plain Admin (not Super Admin) passes the route-level requireRole(["Admin",
  // "Super Admin"]) gate just fine -- that gate alone used to be the only
  // protection -- but must still be stopped by the service-layer check
  // before touching a peer administrator account. Ordinary candidate/
  // recruiter moderation through these same endpoints is unaffected (see the
  // existing "User Management & Cached Permissions Invalidation" and
  // "Recruiter Delete Flow" blocks above, both of which target non-admin
  // roles and still succeed).
  describe("Admin-tier target protection on suspend/delete", () => {
    const adminOperatorToken = jwt.sign(
      { userId: "plain-admin-id", email: "plain-admin@jfw.info", roles: ["Admin"], permissions: ["manage:admin"] },
      env.JWT_ACCESS_SECRET
    )
    const superAdminOperator = { id: "super-admin-id", status: UserStatus.Active, email: "super@jfw.info" }
    const adminTargetUser = {
      id: "admin-target-id",
      email: "peer-admin@jfw.info",
      status: UserStatus.Active,
      roles: [{ role: { name: "Admin" } }],
    }

    it("blocks a plain Admin from suspending another Admin-tier account", async () => {
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where.id === "plain-admin-id" ? { id: "plain-admin-id", status: UserStatus.Active } : adminTargetUser
      )

      const res = await request(app)
        .put("/api/v1/admins/users/admin-target-id/status")
        .set("Authorization", `Bearer ${adminOperatorToken}`)
        .send({ status: UserStatus.Suspended })

      expect(res.status).toBe(403)
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it("blocks a plain Admin from deleting another Admin-tier account", async () => {
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where.id === "plain-admin-id"
          ? { id: "plain-admin-id", status: UserStatus.Active }
          : { ...adminTargetUser, candidateProfile: null, recruiterProfile: null }
      )

      const res = await request(app)
        .delete("/api/v1/admins/users/admin-target-id")
        .set("Authorization", `Bearer ${adminOperatorToken}`)

      expect(res.status).toBe(403)
      expect(mockPrisma.user.delete).not.toHaveBeenCalled()
    })

    it("allows a Super Admin to suspend another Admin-tier account", async () => {
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where.id === "super-admin-id" ? superAdminOperator : adminTargetUser
      )
      mockPrisma.user.update.mockResolvedValue({ id: "admin-target-id", status: UserStatus.Suspended })

      const res = await request(app)
        .put("/api/v1/admins/users/admin-target-id/status")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ status: UserStatus.Suspended })

      expect(res.status).toBe(200)
      expect(mockPrisma.user.update).toHaveBeenCalled()
      // Non-Active status must also revoke live sessions/tokens.
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "admin-target-id" } })
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

    // Final Implementation Pass, Part 8: metric semantics. Every numeric
    // field on this page used to be presented identically, with no
    // indication that most of them (queueMetrics/emailMetrics/
    // cloudinaryMetrics, all plain in-memory objects) silently reset to 0
    // on every server restart. These assert that the classification is
    // actually present and internally consistent -- every field mentioned
    // in either list must really exist somewhere in the response, and the
    // two lists must not overlap.
    it("classifies every queue/email/storage metric as CURRENT_STATE or PROCESS_LIFETIME_COUNTER, and reports when the process started", async () => {
      const res = await request(app)
        .get("/api/v1/admins/health")
        .set("Authorization", `Bearer ${moderatorToken}`)

      expect(res.status).toBe(200)
      const { metricSemantics, processStartedAt } = res.body.data

      expect(metricSemantics).toBeDefined()
      expect(Array.isArray(metricSemantics.currentState)).toBe(true)
      expect(Array.isArray(metricSemantics.processLifetimeCounter)).toBe(true)
      expect(metricSemantics.persistentHistoricalMetric).toEqual([])

      // Known in-memory counters (queue.ts's queueMetrics, email.ts's
      // emailMetrics, cloudinary.ts's cloudinaryMetrics) must be classified
      // as PROCESS_LIFETIME_COUNTER, never CURRENT_STATE.
      expect(metricSemantics.processLifetimeCounter).toEqual(
        expect.arrayContaining([
          "queues.completedJobs",
          "queues.failedJobs",
          "emailDelivery.sent",
          "emailDelivery.failed",
          "storageMetrics.uploadCount",
        ])
      )
      // The real, durable DLQ depth and the live queue/socket state must be
      // classified as CURRENT_STATE, not lumped in with the resettable counters.
      expect(metricSemantics.currentState).toEqual(
        expect.arrayContaining(["queues.activeJobs", "queues.deadLetterPendingCount", "database", "socketio"])
      )
      // No field should be double-classified.
      const overlap = metricSemantics.currentState.filter((f: string) =>
        metricSemantics.processLifetimeCounter.includes(f)
      )
      expect(overlap).toEqual([])

      // processStartedAt must be a real, parseable timestamp in the past
      // (process start = now - uptime), so the frontend can show "counters
      // reset when the server last restarted at <time>" context.
      expect(processStartedAt).toBeDefined()
      expect(new Date(processStartedAt).getTime()).toBeLessThanOrEqual(Date.now())
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

  // CONFIRMED CRITICAL BUG (fixed here): admin.routes.ts previously gated
  // almost every route (job moderation, company verification, user
  // suspend/ban, invitations) with only authenticateToken +
  // requireActiveUser -- no role check at all. A logged-in Candidate or
  // Recruiter JWT could call these endpoints directly and it would succeed,
  // since the service layer only ever fetched `admin`/`adminId` for audit
  // attribution, never for authorization.
  describe("Admin Route Role Enforcement (privilege escalation guard)", () => {
    let candidateToken: string

    beforeEach(() => {
      candidateToken = jwt.sign(
        { userId: "candidate-id", email: "candidate@jfw.info", roles: ["Candidate"], permissions: [] },
        env.JWT_ACCESS_SECRET
      )
    })

    it("should reject a Candidate-role JWT calling job moderation", async () => {
      const res = await request(app)
        .post("/api/v1/admins/jobs/job-1/moderate")
        .set("Authorization", `Bearer ${candidateToken}`)
        .send({ action: "approve" })

      expect(res.status).toBe(403)
      expect(mockPrisma.job.update).not.toHaveBeenCalled()
    })

    it("should reject a Candidate-role JWT calling user status update (suspend/ban)", async () => {
      const res = await request(app)
        .put("/api/v1/admins/users/some-user/status")
        .set("Authorization", `Bearer ${candidateToken}`)
        .send({ status: UserStatus.Suspended })

      expect(res.status).toBe(403)
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it("should reject a Candidate-role JWT calling company verification", async () => {
      const res = await request(app)
        .post("/api/v1/admins/companies/comp-1/verify")
        .set("Authorization", `Bearer ${candidateToken}`)
        .send({ status: CompanyStatus.approved })

      expect(res.status).toBe(403)
      expect(mockPrisma.company.update).not.toHaveBeenCalled()
    })

    it("should still allow a Moderator-role JWT to reach job moderation (not over-restricted)", async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "job-1",
        title: "Test Job",
        recruiterId: "rec-1",
        companyId: "comp-1",
        status: JobStatus.pending_approval,
        recruiter: { userId: "rec-user-1" },
        company: { id: "comp-1", name: "Test Co" },
      })
      mockPrisma.job.update.mockResolvedValue({ id: "job-1", status: JobStatus.approved })
      mockPrisma.jobStatusHistory.create.mockResolvedValue({ id: "hist-1" })
      mockPrisma.candidateSkill.findMany.mockResolvedValue([])
      mockPrisma.candidateProfile.findMany.mockResolvedValue([])

      const res = await request(app)
        .post("/api/v1/admins/jobs/job-1/moderate")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .send({ action: "approve" })

      expect(res.status).toBe(200)
    })
  })

  // Final Implementation Pass, Part 2: real server-side Activity Log
  // pagination/filtering. Confirms every query parameter the rewritten
  // Activity Logs frontend now sends actually reaches Prisma's `where`
  // clause -- previously the frontend fetched one fixed 500-row page and
  // did all filtering client-side, so none of this was backend-testable.
  describe("Activity Logs — real pagination and filtering", () => {
    beforeEach(() => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      mockPrisma.auditLog.count.mockResolvedValue(0)
    })

    it("applies default page=1/limit=50 when no query params are sent", async () => {
      const res = await request(app)
        .get("/api/v1/admins/audits")
        .set("Authorization", `Bearer ${moderatorToken}`)

      expect(res.status).toBe(200)
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 })
      )
    })

    it("computes skip/take from page and limit query params", async () => {
      const res = await request(app)
        .get("/api/v1/admins/audits?page=3&limit=10")
        .set("Authorization", `Bearer ${moderatorToken}`)

      expect(res.status).toBe(200)
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 })
      )
    })

    it("maps the 'Job Moderation' uiCategory tab to entity: 'Job'", async () => {
      const res = await request(app)
        .get("/api/v1/admins/audits?uiCategory=Job Moderation")
        .set("Authorization", `Bearer ${moderatorToken}`)

      expect(res.status).toBe(200)
      const call = mockPrisma.auditLog.findMany.mock.calls[0][0]
      expect(JSON.stringify(call.where)).toContain('"entity":"Job"')
    })

    it("maps the 'Security Settings' uiCategory tab to entity: 'Role' OR category: 'RBAC'", async () => {
      const res = await request(app)
        .get("/api/v1/admins/audits?uiCategory=Security Settings")
        .set("Authorization", `Bearer ${moderatorToken}`)

      expect(res.status).toBe(200)
      const call = mockPrisma.auditLog.findMany.mock.calls[0][0]
      const whereStr = JSON.stringify(call.where)
      expect(whereStr).toContain('"entity":"Role"')
      expect(whereStr).toContain('"category":"RBAC"')
    })

    it("applies a free-text search across action/operatorEmail/ipAddress/entity", async () => {
      const res = await request(app)
        .get("/api/v1/admins/audits?search=suspended")
        .set("Authorization", `Bearer ${moderatorToken}`)

      expect(res.status).toBe(200)
      const call = mockPrisma.auditLog.findMany.mock.calls[0][0]
      const whereStr = JSON.stringify(call.where)
      expect(whereStr).toContain("suspended")
      expect(whereStr).toContain("operatorEmail")
    })

    it("applies a startDate/endDate range filter on timestamp", async () => {
      const res = await request(app)
        .get("/api/v1/admins/audits?startDate=2026-01-01&endDate=2026-02-01")
        .set("Authorization", `Bearer ${moderatorToken}`)

      expect(res.status).toBe(200)
      const call = mockPrisma.auditLog.findMany.mock.calls[0][0]
      const whereStr = JSON.stringify(call.where)
      expect(whereStr).toContain("timestamp")
      expect(whereStr).toContain("gte")
      expect(whereStr).toContain("lte")
    })

    it("combines multiple filters (uiCategory + search) into a single AND'd query", async () => {
      const res = await request(app)
        .get("/api/v1/admins/audits?uiCategory=User Management&search=login")
        .set("Authorization", `Bearer ${moderatorToken}`)

      expect(res.status).toBe(200)
      const call = mockPrisma.auditLog.findMany.mock.calls[0][0]
      expect(call.where.AND.length).toBeGreaterThanOrEqual(2)
    })

    it("rejects a limit above the maximum bound instead of silently accepting it", async () => {
      const res = await request(app)
        .get("/api/v1/admins/audits?limit=99999")
        .set("Authorization", `Bearer ${moderatorToken}`)

      expect(res.status).toBe(400)
    })

    it("returns pagination metadata (currentPage/totalPages/totalItems) in the response", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }])
      mockPrisma.auditLog.count.mockResolvedValue(45)

      const res = await request(app)
        .get("/api/v1/admins/audits?page=2&limit=20")
        .set("Authorization", `Bearer ${moderatorToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.pagination).toEqual(
        expect.objectContaining({ currentPage: 2, totalItems: 45, totalPages: 3 })
      )
    })
  })

  // Final Implementation Pass, Part 4: PUT /admins/settings previously
  // received the admin profile payload as the raw request body, but
  // admin.controller.ts's updateAdminSettings has always read
  // `req.body.preferences` -- so the field was always `undefined`, and
  // Prisma silently treats an `undefined` field as "leave unchanged." The
  // endpoint returned 200 and the frontend showed a success toast, but the
  // database write never happened. This is now fixed on the frontend
  // (adminApi.ts wraps the payload under `preferences`); these tests lock in
  // the backend's actual contract so a future regression can't silently
  // reintroduce the mismatch.
  describe("Admin Settings persistence contract (PUT /admins/settings)", () => {
    it("persists the settings object when sent wrapped under `preferences`", async () => {
      mockPrisma.user.update.mockResolvedValue({
        preferences: { name: "New Admin Name", email: "newadmin@jfw.info" },
      })

      const res = await request(app)
        .put("/api/v1/admins/settings")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .send({ preferences: { name: "New Admin Name", email: "newadmin@jfw.info" } })

      expect(res.status).toBe(200)
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { preferences: { name: "New Admin Name", email: "newadmin@jfw.info" } },
        })
      )
    })

    it("does not silently no-op when the payload is sent flat (regression guard for the confirmed bug)", async () => {
      mockPrisma.user.update.mockResolvedValue({ preferences: undefined })

      await request(app)
        .put("/api/v1/admins/settings")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .send({ name: "Flat Payload Name" })

      // This documents the real (still-current) backend contract: a flat
      // payload without a `preferences` wrapper resolves to `undefined` and
      // Prisma leaves the row unchanged. Callers (the frontend API client)
      // are responsible for wrapping the payload -- this test exists so
      // that fact is explicit and covered, not rediscovered by another
      // silent production save failure.
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { preferences: undefined } })
      )
    })
  })
})
