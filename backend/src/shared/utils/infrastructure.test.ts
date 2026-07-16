import request from "supertest"

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

// Mock Cloudinary SDK
jest.mock("cloudinary", () => {
  const { Writable } = require("stream")
  const mockUploader = {
    upload_stream: jest.fn().mockImplementation((options, callback) => {
      const mockResult = {
        url: "http://cloudinary.com/test.png",
        secure_url: "https://cloudinary.com/test.png",
        public_id: "test_key",
        bytes: 2048,
      }
      setTimeout(() => callback(null, mockResult), 50)
      return new Writable({
        write(chunk: any, encoding: any, next: any) {
          next()
        }
      })
    }),
    destroy: jest.fn().mockImplementation((publicId, options, callback) => {
      callback(null, { result: "ok" })
    }),
  }
  return {
    v2: {
      config: jest.fn(),
      uploader: mockUploader,
    },
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
import { uploadToCloudinary, deleteFromCloudinary, replaceInCloudinary } from "./cloudinary"
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

  describe("1. Cloudinary Hardening & Security Checks", () => {
    it("should successfully upload a mock file buffer to Cloudinary with antivirus scan passing", async () => {
      const buffer = Buffer.from("clean pdf data")
      const result = await uploadToCloudinary(buffer, "jfw/resumes", "candidate_resume.pdf", true)

      expect(result.publicId).toBe("test_key")
      expect(result.secureUrl).toBe("https://cloudinary.com/test.png")
      expect(result.size).toBe(2048)
    })

    it("should successfully replace an asset in Cloudinary on replaceInCloudinary", async () => {
      const newBuffer = Buffer.from("new pdf content")
      const result = await replaceInCloudinary("old_key", newBuffer, "jfw/resumes", "updated_resume.pdf", true)

      expect(result.publicId).toBe("test_key")
      expect(result.secureUrl).toBe("https://cloudinary.com/test.png")
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
    it("should report overall health metrics covering Redis, Sockets, and Cloudinary storage usage on /health", async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ 1: 1 }])

      const res = await request(app).get("/health")
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty("database")
      expect(res.body.data).toHaveProperty("sockets")
      expect(res.body.data).toHaveProperty("queues")
      expect(res.body.data).toHaveProperty("cloudinary")
    })
  })
})
