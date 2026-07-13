import request from "supertest"

// Mock Prisma DB Operations inline in factory
jest.mock("../../shared/database/db", () => {
  const localPrismaMock = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    role: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    permission: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    rolePermission: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    userRole: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    candidateProfile: { findUnique: jest.fn(), update: jest.fn() },
    recruiterProfile: { findUnique: jest.fn() },
    company: { findUnique: jest.fn() },
    job: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
    savedJob: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn(), delete: jest.fn() },
    application: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    applicationStatusHistory: { create: jest.fn() },
    interview: { findMany: jest.fn() },
    notification: { findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
    conversation: { findMany: jest.fn() },
    conversationParticipant: { findUnique: jest.fn() },
    message: { findMany: jest.fn(), create: jest.fn() },
    jobReport: { create: jest.fn() },
    auditLog: { create: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (callback) => await callback(localPrismaMock)),
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
import { UserStatus, JobStatus, ApplicationStatus } from "@prisma/client"
import prisma from "../../shared/database/db"
import redis from "../../shared/utils/redis"

const mockPrisma = prisma as any
const mockRedis = redis as any

describe("Candidate Module Integration Tests (Phase 5)", () => {
  let candidateToken: string
  let unverifiedCandidateToken: string

  beforeEach(() => {
    jest.clearAllMocks()

    candidateToken = jwt.sign(
      { userId: "candidate-id", email: "candidate@email.com", roles: ["Candidate"], permissions: ["read:job", "apply:job"] },
      env.JWT_ACCESS_SECRET
    )

    unverifiedCandidateToken = jwt.sign(
      { userId: "unverified-id", email: "unverified@email.com", roles: ["Candidate"], permissions: ["read:job"] },
      env.JWT_ACCESS_SECRET
    )

    // Redis mock implementation for authorization permissions checks
    mockRedis.get.mockImplementation(async (key: string) => {
      if (key.includes("candidate-id")) {
        return JSON.stringify(["read:job", "apply:job"])
      }
      if (key.includes("unverified-id")) {
        return JSON.stringify(["read:job"])
      }
      return null
    })

    // Default mock user profile resolver to satisfy requireActiveUser
    mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
      const id = args.where.id
      if (id === "candidate-id") {
        return {
          id: "candidate-id",
          email: "candidate@email.com",
          status: UserStatus.Active,
          candidateProfile: {
            id: "cand-1",
            fullName: "Priya Sharma",
            title: "Software Engineer",
            skills: [],
            experience: [],
            education: [],
          },
        }
      }
      if (id === "unverified-id") {
        return {
          id: "unverified-id",
          email: "unverified@email.com",
          status: UserStatus.PendingVerification,
          candidateProfile: {
            id: "cand-2",
            fullName: "Unverified User",
          },
        }
      }
      return null
    })
  })

  describe("Candidate Profile & Dashboard", () => {
    it("should fetch candidate profile successfully", async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue({
        id: "cand-1",
        userId: "candidate-id",
        fullName: "Priya Sharma",
        title: "Software Engineer",
        skills: [],
        experience: [],
        education: [],
      })

      const res = await request(app)
        .get("/api/v1/candidates/profile")
        .set("Authorization", `Bearer ${candidateToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.profile.fullName).toBe("Priya Sharma")
    })

    it("should retrieve consolidated candidate dashboard summary", async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue({
        id: "cand-1",
        userId: "candidate-id",
        fullName: "Priya Sharma",
        title: "Software Engineer",
        skills: [],
      })
      mockPrisma.application.findMany.mockResolvedValue([])
      mockPrisma.savedJob.findMany.mockResolvedValue([])
      mockPrisma.job.findMany.mockResolvedValue([])
      mockPrisma.notification.findMany.mockResolvedValue([])
      mockPrisma.interview.findMany.mockResolvedValue([])
      mockPrisma.auditLog.findMany.mockResolvedValue([])

      const res = await request(app)
        .get("/api/v1/candidates/dashboard")
        .set("Authorization", `Bearer ${candidateToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.profileSummary.fullName).toBe("Priya Sharma")
      expect(res.body.data).toHaveProperty("profileCompletePercent")
    })
  })

  describe("Resume Management APIs", () => {
    it("should update resume metadata upon upload", async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue({
        id: "cand-1",
        userId: "candidate-id",
      })
      mockPrisma.candidateProfile.update.mockResolvedValue({
        id: "cand-1",
        resumeUrl: "https://cloudinary.com/resume.pdf",
      })

      const res = await request(app)
        .post("/api/v1/candidates/resume")
        .set("Authorization", `Bearer ${candidateToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.profile.resumeUrl).toBe("https://cloudinary.com/resume.pdf")
    })
  })

  describe("Saved Jobs / Bookmarks", () => {
    it("should allow candidate to save/bookmark a job posting", async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue({ id: "cand-1" })
      mockPrisma.job.findUnique.mockResolvedValue({ id: "job-1" })
      mockPrisma.savedJob.upsert.mockResolvedValue({ jobId: "job-1", candidateId: "cand-1" })

      const res = await request(app)
        .post("/api/v1/candidates/saved-jobs/job-1")
        .set("Authorization", `Bearer ${candidateToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe("Job Applications & Completeness Safeguard Middleware", () => {
    it("should submit job application if candidate profile is complete and email verified", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "candidate-id",
        status: UserStatus.Active,
        candidateProfile: {
          id: "cand-1",
          fullName: "Priya Sharma",
          title: "Senior Engineer",
          bio: "Passionate coder",
          phone: "+91 98765 43210",
          location: "Bengaluru, IN",
          totalExperience: "3 Years",
          noticePeriod: "1 Month",
          expectedSalary: "₹12,00,000",
          availability: "Immediate",
          resumeUrl: "https://cloudinary.com/resume.pdf",
          skills: [{ skill: { name: "TypeScript" } }],
          experience: [{ company: "JFW" }],
          education: [{ institution: "IIT" }],
        },
      })
      mockPrisma.candidateProfile.findUnique.mockResolvedValue({
        id: "cand-1",
        userId: "candidate-id",
        fullName: "Priya Sharma",
        user: { status: UserStatus.Active },
      })
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "job-1",
        title: "Developer",
        recruiter: { userId: "rec-1" },
      })
      mockPrisma.application.findFirst.mockResolvedValue(null)
      mockPrisma.application.create.mockResolvedValue({
        id: "app-1",
        status: ApplicationStatus.Applied,
      })

      const res = await request(app)
        .post("/api/v1/candidates/jobs/job-1/apply")
        .set("Authorization", `Bearer ${candidateToken}`)

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
    })

    it("should reject job application if candidate profile completion is below threshold", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "candidate-id",
        status: UserStatus.Active,
        candidateProfile: {
          id: "cand-1",
          fullName: "Priya Sharma",
          title: null,
          bio: null,
          resumeUrl: null,
          skills: [],
          experience: [],
          education: [],
        },
      })

      const res = await request(app)
        .post("/api/v1/candidates/jobs/job-1/apply")
        .set("Authorization", `Bearer ${candidateToken}`)

      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain("Profile incomplete")
    })
  })
})
