import request from "supertest"

// Mock Prisma DB Operations inline in factory
jest.mock("../../shared/database/db", () => {
  const localPrismaMock = {
    user: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
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
    interview: { findMany: jest.fn(), create: jest.fn() },
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
import EventBus from "../../shared/eventBus/eventBus"

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

    // Mock Redis checking for JWT credentials. Recruiter is seeded (see
    // backend/src/database/seed.ts rbacMappings) with exactly
    // create/read/update/delete:job -- the job routes below now genuinely
    // check these via requirePermission(), so both tokens need the real
    // seeded permission names here, not the placeholder "post:job"/
    // "manage:applicants" strings this mock used before that check existed.
    mockRedis.get.mockImplementation(async (key: string) => {
      if (key.includes("rec-approved-id") || key.includes("rec-pending-id")) {
        return JSON.stringify(["create:job", "read:job", "update:job", "delete:job"])
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

    it("should notify all active admins when a job is submitted for approval", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-approved",
        userId: "rec-approved-id",
        companyId: "comp-approved",
        company: { id: "comp-approved", status: CompanyStatus.approved, name: "JFW Tech" },
      })
      mockPrisma.department.upsert.mockResolvedValue({ id: "dept-1", name: "Engineering" })
      mockPrisma.skill.upsert.mockResolvedValue({ id: "skill-1", name: "Node.js" })
      mockPrisma.job.create.mockResolvedValue({
        id: "job-submit-1",
        title: "Node.js Developer",
        status: JobStatus.pending_approval,
      })
      mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }])
      mockPrisma.notification.create.mockImplementation(async ({ data }: any) => ({ id: "notif-" + data.recipientId, ...data }))

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
          status: "pending_approval",
        })

      expect(res.status).toBe(201)

      // The domain event's notification-creation runs as a detached async
      // EventBus handler -- it isn't awaited by the HTTP response, so the
      // test has to explicitly wait for it to settle before asserting.
      await EventBus.allSettled()

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "Active",
            roles: { some: { role: { name: { in: ["Admin", "Super Admin"] } } } },
          }),
        })
      )
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2)
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipientId: "admin-1",
            category: "Moderation",
            actionUrl: "/admin/job-moderation",
            dedupeKey: "job-submitted:job-submit-1:admin-1",
          }),
        })
      )
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

    // CONFIRMED PRODUCTION BUG (see recruiter.service.ts lifecycleJob):
    // the "resume"/Activate action used to set a job straight to `approved`
    // with no check on its current status, letting a recruiter self-approve
    // a job that was never reviewed (pending_approval) or that admin
    // explicitly rejected (flagged) -- completely bypassing moderation.
    it("should reject activating (resume) a job still pending admin approval", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-approved",
        userId: "rec-approved-id",
        companyId: "comp-approved",
        company: { id: "comp-approved", status: CompanyStatus.approved },
      })
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "job-pending-1",
        status: JobStatus.pending_approval,
        companyId: "comp-approved",
        recruiter: { userId: "rec-approved-id" },
      })

      const res = await request(app)
        .post("/api/v1/recruiters/jobs/job-pending-1/lifecycle/resume")
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.message).toMatch(/has not been approved by an admin/i)
      expect(mockPrisma.job.update).not.toHaveBeenCalled()
    })

    it("should reject activating (resume) a job that admin rejected (flagged)", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-approved",
        userId: "rec-approved-id",
        companyId: "comp-approved",
        company: { id: "comp-approved", status: CompanyStatus.approved },
      })
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "job-flagged-1",
        status: JobStatus.flagged,
        companyId: "comp-approved",
        recruiter: { userId: "rec-approved-id" },
      })

      const res = await request(app)
        .post("/api/v1/recruiters/jobs/job-flagged-1/lifecycle/resume")
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)

      expect(res.status).toBe(400)
      expect(mockPrisma.job.update).not.toHaveBeenCalled()
    })

    it("should allow the owning recruiter to re-activate a paused job that admin had already approved", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-approved",
        userId: "rec-approved-id",
        companyId: "comp-approved",
        company: { id: "comp-approved", status: CompanyStatus.approved },
      })
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "job-paused-1",
        status: JobStatus.paused,
        companyId: "comp-approved",
        recruiter: { userId: "rec-approved-id" },
      })
      mockPrisma.job.update.mockResolvedValue({ id: "job-paused-1", status: JobStatus.approved })

      const res = await request(app)
        .post("/api/v1/recruiters/jobs/job-paused-1/lifecycle/resume")
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)

      expect(res.status).toBe(200)
      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job-paused-1" },
          data: expect.objectContaining({ status: JobStatus.approved }),
        })
      )
    })

    it("should reject pausing a job that was never approved", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-approved",
        userId: "rec-approved-id",
        companyId: "comp-approved",
        company: { id: "comp-approved", status: CompanyStatus.approved },
      })
      mockPrisma.job.findUnique.mockResolvedValue({
        id: "job-draft-1",
        status: JobStatus.draft,
        companyId: "comp-approved",
        recruiter: { userId: "rec-approved-id" },
      })

      const res = await request(app)
        .post("/api/v1/recruiters/jobs/job-draft-1/lifecycle/pause")
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)

      expect(res.status).toBe(400)
      expect(mockPrisma.job.update).not.toHaveBeenCalled()
    })
  })

  describe("Interview Scheduling", () => {
    it("should schedule an interview, persist it, update application status, and notify the candidate and active admins", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-approved",
        userId: "rec-approved-id",
        fullName: "Sneha Reddy",
        companyId: "comp-approved",
        company: { id: "comp-approved", status: CompanyStatus.approved },
      })
      mockPrisma.application.findUnique.mockResolvedValue({
        id: "app-interview-1",
        status: ApplicationStatus.Shortlisted,
        jobId: "job-9",
        candidateId: "cand-profile-1",
        job: { id: "job-9", companyId: "comp-approved", title: "React Developer" },
        candidate: { id: "cand-profile-1", userId: "cand-user-1", fullName: "Anita Rao" },
      })
      mockPrisma.interview.create.mockResolvedValue({ id: "interview-1" })
      mockPrisma.application.update.mockResolvedValue({
        id: "app-interview-1",
        status: ApplicationStatus.InterviewScheduled,
      })
      mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }])
      mockPrisma.notification.create.mockImplementation(async ({ data }: any) => ({ id: "notif-" + data.recipientId, ...data }))

      const res = await request(app)
        .post("/api/v1/recruiters/applications/app-interview-1/interview")
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)
        .send({
          title: "Technical Round 1",
          scheduledAt: "2026-08-01T10:00:00.000Z",
          location: "Google Meet",
        })

      expect(res.status).toBe(201)
      expect(mockPrisma.interview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ applicationId: "app-interview-1", title: "Technical Round 1" }),
        })
      )
      expect(mockPrisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "app-interview-1" },
          data: expect.objectContaining({ status: ApplicationStatus.InterviewScheduled }),
        })
      )

      await EventBus.allSettled()

      // Candidate notified
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipientId: "cand-user-1",
            title: "Interview Scheduled!",
            dedupeKey: "interview-scheduled-candidate:app-interview-1",
          }),
        })
      )
      // Active admins notified
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipientId: "admin-1",
            title: "Interview Scheduled",
            dedupeKey: "interview-scheduled-admin:app-interview-1:admin-1",
          }),
        })
      )
    })

    // CONFIRMED PRODUCTION BUG (fixed here): neither Applicants.tsx's status
    // dropdown nor CandidatePreview.tsx's quick actions ever expose
    // "Shortlisted" as a settable status -- but the old WorkflowTransitions
    // map required an application to already be Shortlisted before
    // InterviewScheduled was reachable. That made scheduling an interview
    // from the two states a real application actually starts in (Applied,
    // Reviewed/"Under Review") always fail with "Cannot schedule an
    // interview from state: Reviewed", exactly as reported in production.
    // getAllowedTransitions() now allows jumping straight from either state
    // to InterviewScheduled.
    it("allows scheduling an interview directly from 'Reviewed' (Under Review), matching what the recruiter UI actually allows", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-approved",
        userId: "rec-approved-id",
        fullName: "Sneha Reddy",
        companyId: "comp-approved",
        company: { id: "comp-approved", status: CompanyStatus.approved },
      })
      mockPrisma.application.findUnique.mockResolvedValue({
        id: "app-interview-2",
        status: ApplicationStatus.Reviewed,
        jobId: "job-9",
        candidateId: "cand-profile-1",
        job: { id: "job-9", companyId: "comp-approved", title: "React Developer" },
        candidate: { id: "cand-profile-1", userId: "cand-user-1", fullName: "Anita Rao" },
      })
      mockPrisma.interview.create.mockResolvedValue({ id: "interview-2" })
      mockPrisma.application.update.mockResolvedValue({
        id: "app-interview-2",
        status: ApplicationStatus.InterviewScheduled,
      })
      mockPrisma.user.findMany.mockResolvedValue([])

      const res = await request(app)
        .post("/api/v1/recruiters/applications/app-interview-2/interview")
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)
        .send({
          title: "Technical Round 1",
          scheduledAt: "2026-08-01T10:00:00.000Z",
          location: "Google Meet",
        })

      expect(res.status).toBe(201)
      expect(mockPrisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "app-interview-2" },
          data: expect.objectContaining({ status: ApplicationStatus.InterviewScheduled }),
        })
      )
    })

    it("allows scheduling an interview directly from 'Applied'", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-approved",
        userId: "rec-approved-id",
        fullName: "Sneha Reddy",
        companyId: "comp-approved",
        company: { id: "comp-approved", status: CompanyStatus.approved },
      })
      mockPrisma.application.findUnique.mockResolvedValue({
        id: "app-interview-3",
        status: ApplicationStatus.Applied,
        jobId: "job-9",
        candidateId: "cand-profile-1",
        job: { id: "job-9", companyId: "comp-approved", title: "React Developer" },
        candidate: { id: "cand-profile-1", userId: "cand-user-1", fullName: "Anita Rao" },
      })
      mockPrisma.interview.create.mockResolvedValue({ id: "interview-3" })
      mockPrisma.application.update.mockResolvedValue({
        id: "app-interview-3",
        status: ApplicationStatus.InterviewScheduled,
      })
      mockPrisma.user.findMany.mockResolvedValue([])

      const res = await request(app)
        .post("/api/v1/recruiters/applications/app-interview-3/interview")
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)
        .send({
          title: "Screening Call",
          scheduledAt: "2026-08-02T10:00:00.000Z",
          location: "Google Meet",
        })

      expect(res.status).toBe(201)
    })

    it("still blocks scheduling an interview once the application is in a terminal state", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: "profile-approved",
        userId: "rec-approved-id",
        companyId: "comp-approved",
        company: { id: "comp-approved", status: CompanyStatus.approved },
      })
      mockPrisma.application.findUnique.mockResolvedValue({
        id: "app-interview-4",
        status: ApplicationStatus.Rejected,
        job: { companyId: "comp-approved" },
        candidate: { userId: "cand-1" },
      })

      const res = await request(app)
        .post("/api/v1/recruiters/applications/app-interview-4/interview")
        .set("Authorization", `Bearer ${approvedRecruiterToken}`)
        .send({ title: "x", scheduledAt: "2026-08-01T10:00:00.000Z" })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("terminal")
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
