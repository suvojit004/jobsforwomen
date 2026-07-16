// Focused tests for the "email_automation" feature flag enforcement inside
// addJob() (Final Implementation Pass, Part 3 verification). The flag was
// already real, DB-persisted, and wired into this exact chokepoint in a
// prior pass -- this file is new because no test previously existed to
// prove that enforcement, only the ConversationService/chat_enabled side
// had regression coverage (see conversation.service.test.ts).

jest.mock("../database/db", () => {
  const localPrismaMock = {
    featureFlag: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    invitation: { updateMany: jest.fn() },
    job: { findMany: jest.fn(), update: jest.fn() },
    notification: { deleteMany: jest.fn() },
    candidateProfile: { findMany: jest.fn() },
  }
  return {
    ...localPrismaMock,
    prisma: localPrismaMock,
    default: localPrismaMock,
    __esModule: true,
  }
})

jest.mock("../utils/email", () => ({
  __esModule: true,
  default: {
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    sendDailyDigest: jest.fn().mockResolvedValue(true),
    sendWeeklyDigest: jest.fn().mockResolvedValue(true),
  },
}))

import prisma from "../database/db"
import EmailService from "../utils/email"
import { invalidateFeatureFlagCache } from "../utils/featureFlags"
import {
  addJob,
  sanitizeJobData,
  pushToDeadLetterQueue,
  getDeadLetterQueueStats,
  mockDeadLetterJobs,
} from "./queue"

const mockPrisma = prisma as any
const mockEmail = EmailService as any

describe("Queue email_automation feature-flag enforcement (addJob)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    invalidateFeatureFlagCache()
  })

  it("skips a non-critical email job when email_automation is OFF", async () => {
    mockPrisma.featureFlag.findUnique.mockResolvedValue({ key: "email_automation", value: false })

    const result = await addJob("email", "sendDailyDigest", { to: "cand@jfw.info", recipientName: "A", jobs: [] })

    expect(result).toBeNull()
    expect(mockEmail.sendDailyDigest).not.toHaveBeenCalled()
  })

  it("queues (and, in test mode, immediately processes) a non-critical email job when email_automation is ON", async () => {
    mockPrisma.featureFlag.findUnique.mockResolvedValue({ key: "email_automation", value: true })

    const result = await addJob("email", "sendWeeklyDigest", { to: "cand@jfw.info", recipientName: "A", jobs: [] })

    expect(result).not.toBeNull()
    expect(mockEmail.sendWeeklyDigest).toHaveBeenCalledWith("cand@jfw.info", "A", [])
  })

  it("still sends a security-critical email (sendWelcome) even when email_automation is OFF", async () => {
    mockPrisma.featureFlag.findUnique.mockResolvedValue({ key: "email_automation", value: false })

    const result = await addJob("email", "sendWelcome", { to: "new@jfw.info", token: "tok-1" })

    expect(result).not.toBeNull()
    expect(mockEmail.sendWelcomeEmail).toHaveBeenCalledWith("new@jfw.info", "tok-1")
    // The flag should never even be consulted for an exempt job.
    expect(mockPrisma.featureFlag.findUnique).not.toHaveBeenCalled()
  })

  it("still sends a security-critical email (sendPasswordReset) even when email_automation is OFF", async () => {
    mockPrisma.featureFlag.findUnique.mockResolvedValue({ key: "email_automation", value: false })

    const result = await addJob("email", "sendPasswordReset", { to: "user@jfw.info", token: "tok-2" })

    expect(result).not.toBeNull()
    expect(mockEmail.sendPasswordResetEmail).toHaveBeenCalledWith("user@jfw.info", "tok-2")
  })

  it("queues normal (non-email) jobs regardless of the email_automation flag", async () => {
    mockPrisma.featureFlag.findUnique.mockResolvedValue({ key: "email_automation", value: false })
    mockPrisma.invitation.updateMany.mockResolvedValue({ count: 0 })

    const result = await addJob("cleanup", "invitationExpiry", {})

    expect(result).not.toBeNull()
    expect(mockPrisma.invitation.updateMany).toHaveBeenCalled()
  })
})

// Final Implementation Pass, Part 7: real BullMQ dead-letter queue. The
// "failed" worker-event handler that normally calls pushToDeadLetterQueue()
// only gets attached when `!isTest && redisConnection` (see queue.ts) -- so
// under Jest (NODE_ENV=test) that event listener never fires at all. These
// tests exercise the exported sanitizeJobData/pushToDeadLetterQueue/
// getDeadLetterQueueStats functions directly instead, against the in-memory
// mockDeadLetterJobs array that stands in for a real BullMQ queue in test
// mode.
describe("Dead-letter queue (Part 7)", () => {
  beforeEach(() => {
    mockDeadLetterJobs.length = 0
  })

  describe("sanitizeJobData", () => {
    it("redacts common sensitive keys (password/token/secret/apiKey/authorization/otp)", () => {
      const result = sanitizeJobData({
        to: "user@jfw.info",
        password: "hunter2",
        token: "raw-reset-token",
        secret: "shh",
        apiKey: "sk-live-abc",
        authorization: "Bearer xyz",
        otp: "123456",
      })

      expect(result).toEqual({
        to: "user@jfw.info",
        password: "[REDACTED]",
        token: "[REDACTED]",
        secret: "[REDACTED]",
        apiKey: "[REDACTED]",
        authorization: "[REDACTED]",
        otp: "[REDACTED]",
      })
    })

    it("recurses into nested objects and redacts sensitive keys at any depth", () => {
      const result = sanitizeJobData({
        to: "user@jfw.info",
        meta: { resetToken: "deep-token", nested: { apiSecret: "deep-secret" } },
      })

      expect(result.meta.resetToken).toBe("[REDACTED]")
      expect(result.meta.nested.apiSecret).toBe("[REDACTED]")
      expect(result.to).toBe("user@jfw.info")
    })

    it("leaves non-sensitive fields and primitive/non-object input untouched", () => {
      expect(sanitizeJobData({ recipientName: "Asha", jobs: [{ title: "Engineer" }] })).toEqual({
        recipientName: "Asha",
        jobs: [{ title: "Engineer" }],
      })
      expect(sanitizeJobData(null)).toBeNull()
      expect(sanitizeJobData("plain string")).toBe("plain string")
    })
  })

  describe("pushToDeadLetterQueue", () => {
    it("records a sanitized entry with queue name, job name, failure reason, and attemptsMade", async () => {
      const job = {
        id: "job-1",
        name: "sendPasswordReset",
        data: { to: "user@jfw.info", token: "raw-token" },
        attemptsMade: 3,
        opts: { attempts: 3 },
      } as any

      await pushToDeadLetterQueue("email", job, new Error("SMTP timeout"))

      expect(mockDeadLetterJobs).toHaveLength(1)
      expect(mockDeadLetterJobs[0]).toMatchObject({
        originalQueue: "email",
        jobName: "sendPasswordReset",
        data: { to: "user@jfw.info", token: "[REDACTED]" },
        failureReason: "SMTP timeout",
        attemptsMade: 3,
      })
      expect(mockDeadLetterJobs[0].failedAt).toEqual(expect.any(String))
    })

    it("refuses to recurse -- a failure reported from the dead-letter queue itself is dropped, not re-queued", async () => {
      const job = { id: "dlq-job-1", name: "failed-job", data: {}, attemptsMade: 1, opts: {} } as any

      await pushToDeadLetterQueue("dead-letter", job, new Error("should never happen"))

      expect(mockDeadLetterJobs).toHaveLength(0)
    })
  })

  describe("getDeadLetterQueueStats", () => {
    it("reports a real pending count reflecting exactly what was pushed", async () => {
      expect(await getDeadLetterQueueStats()).toEqual({ pendingCount: 0 })

      const job = { id: "job-2", name: "sendWeeklyDigest", data: {}, attemptsMade: 3, opts: {} } as any
      await pushToDeadLetterQueue("email", job, new Error("boom"))
      await pushToDeadLetterQueue("cleanup", { ...job, id: "job-3" }, new Error("boom again"))

      expect(await getDeadLetterQueueStats()).toEqual({ pendingCount: 2 })
    })
  })
})
