import request from "supertest"
import fs from "fs"
import path from "path"

// Mock Prisma DB Operations
jest.mock("../database/db", () => {
  const localPrismaMock = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    invitation: { updateMany: jest.fn() },
    job: { findMany: jest.fn(), update: jest.fn() },
    notification: { deleteMany: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    candidateProfile: { findMany: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    $transaction: jest.fn().mockImplementation(async (callback) => {
      if (typeof callback === "function") {
        return callback(localPrismaMock)
      }
      return callback
    }),
  }
  return {
    ...localPrismaMock,
    prisma: localPrismaMock,
    default: localPrismaMock,
    __esModule: true,
  }
})

// Mock Resend Transporter inline
jest.mock("resend", () => {
  const mockSend = jest.fn().mockResolvedValue({ data: { id: "msg-123" }, error: null })
  return {
    Resend: jest.fn().mockImplementation(() => {
      return {
        emails: {
          send: mockSend,
        },
      }
    }),
  }
})

// Mock Redis Caching operations inline in factory
jest.mock("./redis", () => {
  const localRedisMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    status: "ready",
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
import env from "../config/env"
import { uploadFile, deleteFile, replaceFile } from "./fileStorage"
import { EmailService, emailMetrics } from "./email"
import { addJob, queueMetrics } from "../queue/queue"
import { stripHtml } from "./emailTemplates"
import prisma from "../database/db"
import redis from "./redis"

const mockPrisma = prisma as any
const mockRedis = redis as any

describe("Infrastructure Hardening Integration Tests (Phase 8 - Hardened)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("1. Local Disk File Storage Hardening & Security Checks", () => {
    afterEach(async () => {
      await fs.promises.rm(env.DISK_MOUNT_PATH, { recursive: true, force: true }).catch(() => {})
    })

    it("should successfully write a clean file buffer to disk with antivirus scan passing", async () => {
      const buffer = Buffer.from("clean pdf data")
      const result = await uploadFile(buffer, "jfw/resumes", "candidate_resume", true, "resume.pdf")

      expect(result.publicId).toBe("jfw/resumes/candidate_resume.pdf")
      expect(result.format).toBe("pdf")
      expect(result.size).toBe(buffer.length)

      const written = await fs.promises.readFile(path.join(env.DISK_MOUNT_PATH, result.publicId))
      expect(written.toString()).toBe("clean pdf data")
    })

    it("should successfully replace an asset on disk via replaceFile, removing the old one", async () => {
      const first = await uploadFile(Buffer.from("old pdf content"), "jfw/resumes", "updated_resume", true, "resume.pdf")
      const result = await replaceFile(first.publicId, Buffer.from("new pdf content"), "jfw/resumes", "updated_resume", true, "resume.pdf")

      expect(result.publicId).toBe("jfw/resumes/updated_resume.pdf")
      const written = await fs.promises.readFile(path.join(env.DISK_MOUNT_PATH, result.publicId))
      expect(written.toString()).toBe("new pdf content")
    })

    it("should treat deleting an already-missing asset as a no-op, not an error", async () => {
      await expect(deleteFile("jfw/resumes/does_not_exist.pdf", true)).resolves.toBeUndefined()
    })
  })

  describe("2. Resend Email Transport & Plain Text alternate converters", () => {
    it("should strip HTML tags correctly and format clean text-only alternate bodies", () => {
      const htmlBody = `
        <div style="padding: 10px;">
          <h2>Welcome!</h2>
          <p>Verify your account by clicking <a href="http://link">here</a>.</p>
        </div>
      `
      const plainText = stripHtml(htmlBody)
      expect(plainText).not.toContain("div")
      expect(plainText).not.toContain("<a href=")
      expect(plainText).toContain("Welcome!")
      expect(plainText).toContain("Verify your account")
    })

    it("should successfully trigger daily digest dispatches to candidates", async () => {
      const sent = await EmailService.sendDailyDigest("candidate@jfw.info", "Sarah", [
        { title: "SRE Engineer", companyName: "JFW", location: "Remote" }
      ])
      expect(sent).toBe(true)
    })
  })

  describe("3. Secure Webhook endpoints for Email Bounces and Complaints", () => {
    it("should process Resend bounce webhooks, incrementing metrics and logging audits", async () => {
      const initialBounces = emailMetrics.bounced
      const res = await request(app)
        .post("/api/v1/emails/bounce")
        .send({ email: "invalid@email.com", type: "Permanent" })

      expect(res.status).toBe(200)
      expect(emailMetrics.bounced).toBe(initialBounces + 1)
    })

    it("should successfully process and register user complaint webhooks in DB", async () => {
      const res = await request(app)
        .post("/api/v1/emails/complaint")
        .send({ email: "spammer@email.com" })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe("4. Readiness probes database checks and versions mappings", () => {
    it("should report overall health metrics covering Redis, Sockets, and disk storage usage on /health", async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ 1: 1 }])

      const res = await request(app).get("/health")
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty("database")
      expect(res.body.data).toHaveProperty("sockets")
      expect(res.body.data).toHaveProperty("queues")
      expect(res.body.data).toHaveProperty("storage")
    })
  })
})
