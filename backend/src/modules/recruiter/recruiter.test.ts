import request from "supertest"

// Mock Prisma DB Operations inline in factory
jest.mock("../../shared/database/db", () => {
  const localPrismaMock = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    role: { findUnique: jest.fn() },
    recruiterProfile: { findUnique: jest.fn() },
    company: { findUnique: jest.fn(), update: jest.fn() },
    industry: { upsert: jest.fn() },
    department: { upsert: jest.fn() },
    job: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    skill: { upsert: jest.fn() },
    jobSkill: { createMany: jest.fn(), deleteMany: jest.fn() },
    companyBenefit: { deleteMany: jest.fn(), createMany: jest.fn() },
    application: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    interview: { findMany: jest.fn() },
    notification: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    auditLog: { create: jest.fn() },
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
import { UserStatus, CompanyStatus, JobStatus, ApplicationStatus } from "@prisma/client"
import prisma from "../../shared/database/db"
import redis from "../../shared/utils/redis"

const mockPrisma = prisma as any
const mockRedis = redis as any

describe("Recruiter Module Integration Tests (Phase 6)", () => {
  let approvedRecruiterToken: string
  let pendingRecruiterToken: string

  beforeEach(() => {
    jest.clearAllMocks()

    approvedRecruiterToken = jwt.sign(
      { userId: "rec-approved-id", email: "approved@company.com", roles: ["Recruiter"], permissions: ["post:job", "manage:applicants"] },
      env.JWT_ACCESS_SECRET
    )

    pendingRecruiterToken = jwt.sign(
      { userId: "rec-pending-id", email: "pending@company.com", roles: ["Recruiter"], permissions: ["post:job"] },
      env.JWT_ACCESS_SECRET
    )

    // Mock Redis checking for JWT credentials
    mockRedis.get.mockImplementation(async (key: string) => {
      if (key.includes("rec-approved-id")) {
        return JSON.stringify(["post:job", "manage:applicants"])
      }
      if (key.includes("rec-pending-id")) {
        return JSON.stringify(["post:job"])
      }
      return null
    })

    // Mock User status checks
    mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
      return {
        id: args.where.id,
        status: UserStatus.Active,
      }
    })
  })

  describe("Recruiter Dashboard Stats & Onboarding", () => {
    it("should fetch dashboard statistics mapping complete fields", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-123",
        userId: "rec-approved-id",
        fullName: "Sneha Reddy",
        phone: "9876543210",
        companyId: "comp-1",
        company: {
          id: "comp-1",
          name: "JFW Tech",
          website: "https://jfw.io",
          location: "Bengaluru, IN",
          industryId: "ind-1",
          status: CompanyStatus.approved,
          logoUrl: "https://cloudinary.com/logo.png",
          verificationDocuments: [{ url: "https://cloudinary.com/doc.pdf", publicId: "doc-1", size: 1024, mimetype: "application/pdf", category: "TaxRegistration" }],
        },
      })

      mockPrisma.job.groupBy.mockResolvedValue([
        { status: JobStatus.approved, _count: { id: 3 } },
      ])
      mockPrisma.application.groupBy.mockResolvedValue([
        { status: ApplicationStatus.Applied, _count: { id: 5 } },
      ])
      mockPrisma.interview.findMany.mockResolvedValue([])
      mockPrisma.notification.findMany.mockResolvedValue([])
      mockPrisma.notification.count.mockResolvedValue(0)
      mockPrisma.application.findMany.mockResolvedValue([])

      const res = await request(app)
        .get("/api/v1/recruiters/dashboard")
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.profileCompletion).toBe(100) // All 8 fields mapped
      expect(res.body.data.verificationStatus).toBe("approved")
      expect(res.body.data.jobStatistics.approved).toBe(3)
    })

    it("should onboard company through wizard progressing status states", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-123",
        companyId: "comp-1",
        company: { id: "comp-1", status: CompanyStatus.draft },
      })
      mockPrisma.industry.upsert.mockResolvedValue({ id: "ind-1", name: "Technology" })
      mockPrisma.company.update.mockResolvedValue({
        id: "comp-1",
        status: CompanyStatus.submitted,
      })

      const res = await request(app)
        .post("/api/v1/recruiters/company/onboard")
        .set("Authorization", `Bearer approvedRecruiterToken`) // supertest auth
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)
        .send({
          website: "https://newcompany.io",
          location: "Mumbai, IN",
          industryName: "Technology",
          logo: { url: "https://logo.png", publicId: "logo-1" },
          verificationDocuments: [
            { url: "https://license.pdf", publicId: "license", size: 5000, mimetype: "application/pdf", category: "BusinessLicense" },
          ],
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.status).toBe("submitted")
    })
  })

  describe("Middlewares Approval Restrictions", () => {
    it("should deny posting job listing if company status is not approved", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-pending",
        userId: "rec-pending-id",
        companyId: "comp-pending",
        company: { id: "comp-pending", status: CompanyStatus.pending_verification },
      })

      const res = await request(app)
        .post("/api/v1/recruiters/jobs")
        .set("Authorization", `Bearer ${pendingRecruiterToken}`)
        .send({
          title: "DevOps Engineer",
          location: "Remote",
          type: "Full-time",
          workMode: "Remote",
          description: "Maintain scalable infrastructure cloud instances.",
          responsibilities: "Maintain systems servers pipelines.",
          requirements: "Experience with Terraform and AWS.",
          benefits: "Menstrual leave and flexible hours.",
          deadline: "31/12/2026",
          salaryDisplay: "INR 12 - 18 LPA",
          salaryMin: 1200000,
          salaryMax: 1800000,
          experienceMin: 2,
          experienceMax: 5,
          departmentName: "Engineering",
          skills: ["AWS", "Terraform"],
        })

      expect(res.status).toBe(403)
      expect(res.body.message).toContain("company approval is pending/rejected")
    })
  })

  describe("Job Postings & Lifecycle Operations", () => {
    it("should allow approved company recruiters to create job postings", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-approved",
        userId: "rec-approved-id",
        companyId: "comp-approved",
        company: { id: "comp-approved", status: CompanyStatus.approved },
      })
      mockPrisma.department.upsert.mockResolvedValue({ id: "dept-1", name: "Engineering" })
      mockPrisma.skill.upsert.mockResolvedValue({ id: "skill-1", name: "Node.js" })
      mockPrisma.job.create.mockResolvedValue({
        id: "job-123",
        title: "Node.js Developer",
        status: JobStatus.draft,
      })

      const res = await request(app)
        .post("/api/v1/recruiters/jobs")
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)
        .send({
          title: "Node.js Developer",
          location: "Bengaluru, IN",
          type: "Full-time",
          workMode: "Hybrid",
          description: "Build API microservices modules monolith endpoints.",
          responsibilities: "Write tests compile logic write schemas.",
          requirements: "Expert knowledge of TypeScript and SQL.",
          benefits: "Work from home allowance flexible hours.",
          deadline: "01/10/2026",
          salaryDisplay: "₹80,000 - ₹120,000 / month",
          salaryMin: 80000,
          salaryMax: 120000,
          experienceMin: 1,
          experienceMax: 3,
          departmentName: "Engineering",
          skills: ["Node.js", "TypeScript"],
        })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBe("job-123")
    })

    it("should duplicate existing job reset to draft status", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-approved",
        userId: "rec-approved-id",
        companyId: "comp-approved",
        company: { id: "comp-approved", status: CompanyStatus.approved },
      })
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "job-1",
        title: "Original Job",
        location: "Remote",
        type: "Full-time",
        companyId: "comp-approved",
        recruiter: { userId: "rec-approved-id" },
        skills: [],
      })
      mockPrisma.job.create.mockResolvedValue({
        id: "job-2",
        title: "Copy of Original Job",
        status: JobStatus.draft,
      })

      const res = await request(app)
        .post("/api/v1/recruiters/jobs/job-1/duplicate")
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)

      expect(res.status).toBe(201)
      expect(res.body.data.title).toBe("Copy of Original Job")
      expect(res.body.data.status).toBe("draft")
    })
  })

  describe("Applicant pipeline status workflow and invalid transitions", () => {
    it("should prevent progressing application status if current status is terminal", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-approved",
        userId: "rec-approved-id",
        companyId: "comp-approved",
        company: { id: "comp-approved", status: CompanyStatus.approved },
      })
      mockPrisma.application.findUnique.mockResolvedValue({
        id: "app-123",
        status: ApplicationStatus.Rejected, // terminal state
        job: { companyId: "comp-approved", recruiter: { userId: "rec-approved-id" } },
        candidate: { userId: "cand-1" },
      })

      const res = await request(app)
        .put("/api/v1/recruiters/applications/app-123/status")
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)
        .send({
          status: "Reviewed",
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("terminal state")
    })

    it("should prevent invalid status jumps (e.g. from Applied directly to Hired)", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-approved",
        userId: "rec-approved-id",
        companyId: "comp-approved",
        company: { id: "comp-approved", status: CompanyStatus.approved },
      })
      mockPrisma.application.findUnique.mockResolvedValue({
        id: "app-123",
        status: ApplicationStatus.Applied,
        job: { companyId: "comp-approved", recruiter: { userId: "rec-approved-id" } },
        candidate: { userId: "cand-1" },
      })

      const res = await request(app)
        .put("/api/v1/recruiters/applications/app-123/status")
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)
        .send({
          status: "Hired",
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("Invalid status transition")
    })
  })
})
