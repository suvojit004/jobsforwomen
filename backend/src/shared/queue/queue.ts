import { Queue, Worker, Job, UnrecoverableError } from "bullmq"
import IORedis from "ioredis"
import env from "../config/env"
import { logger } from "../utils/logger"
import EmailService from "../utils/email"
import prisma from "../database/db"
import { isFeatureEnabled } from "../utils/featureFlags"

const isTest = process.env.NODE_ENV === "test"

const redisConnection = !isTest
  ? new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })
  : null

export const queues: Record<string, Queue | any> = {}
export const workers: Record<string, Worker | any> = {}

const queueNames = ["email", "notifications", "audit", "cleanup", "reports"]

// a real, separate BullMQ queue that
// holds jobs which have exhausted all retry attempts. Deliberately never
// given a Worker (see bottom of this file) -- it exists purely as a
// durable, inspectable holding area for failed jobs, not something that
// gets auto-processed. That also happens to be what fully prevents
// recursive DLQ handling: since nothing ever consumes this queue, a job
// placed here can never itself "fail" and re-trigger dead-letter logic.
const DEAD_LETTER_QUEUE_NAME = "dead-letter"

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
}

// Track queue statistics for dashboard observability
export const queueMetrics = {
  activeJobs: 0,
  completedJobs: 0,
  failedJobs: 0,
}

// In test / no-Redis mode there is no real BullMQ queue to query job counts
// from, so the mock dead-letter "queue" below just tracks entries here.
// Exported (test-only usage) so tests can assert on exactly what got
// recorded and reset state between runs.
export const mockDeadLetterJobs: Array<{
  originalQueue: string
  jobName: string
  data: any
  failureReason: string
  attemptsMade: number
  failedAt: string
}> = []

// Strips likely-sensitive fields (password reset tokens, invitation tokens,
// etc.) out of a failed job's payload before it's persisted to the
// dead-letter queue or the AuditLog -- job.data for things like
// "sendPasswordReset" legitimately contains a raw token, and a failed-job
// record is not the place for that to end up sitting in Redis/DB indefinitely.
const SENSITIVE_KEY_PATTERN = /password|token|secret|apikey|api_key|authorization|otp\b/i

// Exported for direct unit testing: the "failed" worker-event handler that
// normally invokes this only gets attached when `!isTest && redisConnection`
// (see registerWorker below), so under Jest (NODE_ENV=test) that code path
// never runs at all -- exporting these lets Part 7's tests exercise the
// sanitization and dead-letter-push logic directly rather than only being
// able to test it via a live BullMQ worker this sandbox can't run anyway.
export function sanitizeJobData(data: any): any {
  if (!data || typeof data !== "object") return data
  const clone: any = Array.isArray(data) ? [] : {}
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      clone[key] = "[REDACTED]"
    } else if (value && typeof value === "object") {
      clone[key] = sanitizeJobData(value)
    } else {
      clone[key] = value
    }
  }
  return clone
}

// Initialize queues
queueNames.forEach((name) => {
  if (!isTest && redisConnection) {
    queues[name] = new Queue(name, {
      connection: redisConnection as any,
      defaultJobOptions,
    })
  } else {
    // Mock queue for test suite execution
    queues[name] = {
      add: async (jobName: string, data: any) => {
        logger.info(`[MockQueue:${name}] Job '${jobName}' added in memory.`)
        queueMetrics.activeJobs++
        if (isTest) {
          await processJobMock(name, jobName, data)
        }
        queueMetrics.completedJobs++
        return { id: `mock-job-${Date.now()}` }
      },
    }
  }
})

// The dead-letter queue is initialized separately from the loop above --
// it deliberately has no defaultJobOptions (retries/backoff are meaningless
// for a queue nothing ever processes) and, unlike the others, its mock-mode
// stand-in actually records entries (into mockDeadLetterJobs) instead of
// just logging, so getDeadLetterQueueStats() has something real to count in
// tests / when Redis isn't configured.
if (!isTest && redisConnection) {
  queues[DEAD_LETTER_QUEUE_NAME] = new Queue(DEAD_LETTER_QUEUE_NAME, {
    connection: redisConnection as any,
  })
} else {
  queues[DEAD_LETTER_QUEUE_NAME] = {
    add: async (_jobName: string, data: any) => {
      mockDeadLetterJobs.push(data)
      return { id: `mock-dlq-${Date.now()}` }
    },
  }
}

// Moves a permanently-failed job into the dead-letter queue, preserving the
// original queue name, job name, sanitized data, failure reason, and
// attemptsMade -- everything an operator needs to understand what failed
// and decide whether to manually replay it. Guards explicitly against
// recursion (see DEAD_LETTER_QUEUE_NAME comment above) even though no
// worker is ever attached to this queue, as defense in depth against a
// future code change accidentally adding one.
export async function pushToDeadLetterQueue(originalQueueName: string, job: Job, err: Error) {
  if (originalQueueName === DEAD_LETTER_QUEUE_NAME) {
    logger.error(
      `[DLQ] Refusing to recurse -- a failure was reported from the dead-letter queue itself (job ${job.id}).`
    )
    return
  }

  try {
    const dlq = queues[DEAD_LETTER_QUEUE_NAME]
    if (!dlq) return
    await dlq.add("failed-job", {
      originalQueue: originalQueueName,
      jobName: job.name,
      data: sanitizeJobData(job.data),
      failureReason: err.message,
      attemptsMade: job.attemptsMade,
      failedAt: new Date().toISOString(),
    })
    logger.warn(
      `[DLQ] Job ${job.id} ("${job.name}" on queue "${originalQueueName}") exhausted all retry attempts and was moved to the dead-letter queue.`
    )
  } catch (dlqErr: any) {
    logger.error(`[DLQ] Failed to record dead-letter entry for job ${job.id}: ${dlqErr.message}`)
  }
}

// Real pending-count read for System Health -- queries actual BullMQ job
// counts (waiting/delayed/active -- a dead-letter job is never "completed"
// in the processed sense since nothing consumes this queue) rather than
// exposing an in-memory counter that would reset on every server restart.
export async function getDeadLetterQueueStats(): Promise<{ pendingCount: number }> {
  if (!isTest && redisConnection) {
    try {
      const dlq = queues[DEAD_LETTER_QUEUE_NAME]
      const counts = await dlq.getJobCounts("wait", "delayed", "active", "paused")
      const pendingCount = Object.values(counts).reduce((sum: number, c: any) => sum + (c || 0), 0)
      return { pendingCount }
    } catch (err: any) {
      logger.error(`[DLQ] Failed to fetch dead-letter queue counts: ${err.message}`)
      return { pendingCount: 0 }
    }
  }
  return { pendingCount: mockDeadLetterJobs.length }
}

// Single chokepoint every outbound email funnels through, so gating
// "email_automation" here covers the whole EventBus -> EmailListener ->
// BullMQ -> SES chain without touching each listener individually.
// Account-security mail (verification, password reset) is exempt -- turning
// off automated status-update blasts must not lock users out of their
// accounts.
const SECURITY_CRITICAL_EMAIL_JOBS = new Set([
  "sendWelcome",
  "sendPasswordReset",
  "sendRaw",
  "sendAdminAccountCreated",
  // A candidate/recruiter needs to know their account was suspended, blocked,
  // or deleted regardless of the email_automation flag -- these aren't
  // promotional/digest mail, they're the only notice the account holder gets
  // that something happened to their account at all.
  "sendAccountStatusChanged",
  "sendAccountDeleted",
  "sendAccountReactivated",
])

export async function addJob(queueName: string, jobName: string, data: any) {
  try {
    if (queueName === "email" && !SECURITY_CRITICAL_EMAIL_JOBS.has(jobName)) {
      const automationEnabled = await isFeatureEnabled("email_automation")
      if (!automationEnabled) {
        logger.info(`[Queue] Skipped email job "${jobName}" -- email_automation feature flag is disabled.`)
        return null
      }
    }

    const queue = queues[queueName]
    if (queue) {
      return await queue.add(jobName, data)
    }
  } catch (err: any) {
    logger.error(`[Queue] Failed to add job to queue ${queueName}: ${err.message}`)
  }
}

// ==========================================
// BACKGROUND WORKERS PROCESSING
// ==========================================
async function processJobMock(queueName: string, jobName: string, data: any) {
  try {
    if (queueName === "email") {
      await handleEmailJob(jobName, data)
    } else if (queueName === "cleanup") {
      await handleCleanupJob(jobName, data)
    }
  } catch (err: any) {
    queueMetrics.failedJobs++
    logger.error(`[MockWorker] Job error on ${queueName}:${jobName}: ${err.message}`)
  }
}

async function handleEmailJob(jobName: string, data: any) {
  // Generic passthrough for one-off mail that has no dedicated template
  // (currently the admin "Contact Support" ticket). Exists so such callers go
  // through the queue -- and therefore the SES rate limiter, retry policy and
  // dead-letter queue -- instead of calling EmailService.sendMail directly
  // from a request handler and racing the worker's send budget.
  if (jobName === "sendRaw") {
    await EmailService.sendMail(data.to, data.subject, data.html)
    return
  }

  const { to, token, roleName, roleNames, fullName, password, companyName, status, notes, jobTitle, recipientName, jobs, scheduledAt, location, timezone, mode, offerDetails, actionLink, actionLabel, perkName, comment, statusHeading, statusMessage } = data
  if (jobName === "sendWelcome") {
    await EmailService.sendWelcomeEmail(to, token)
  } else if (jobName === "sendEmployeeInvitation") {
    await EmailService.sendEmployeeInvitation(to, token, roleName)
  } else if (jobName === "sendAdminAccountCreated") {
    await EmailService.sendAdminAccountCreatedEmail(to, fullName, password, roleNames || [])
  } else if (jobName === "sendCompanyVerification") {
    await EmailService.sendCompanyVerificationEmail(to, companyName, status, notes, actionLink, actionLabel)
  } else if (jobName === "sendPerkVerification") {
    await EmailService.sendPerkVerificationEmail(to, companyName, perkName, status, comment, actionLink)
  } else if (jobName === "sendJobModeration") {
    await EmailService.sendJobModerationEmail(to, jobTitle, status, notes)
  } else if (jobName === "sendPasswordReset") {
    await EmailService.sendPasswordResetEmail(to, token)
  } else if (jobName === "sendDailyDigest") {
    await EmailService.sendDailyDigest(to, recipientName, jobs)
  } else if (jobName === "sendWeeklyDigest") {
    await EmailService.sendWeeklyDigest(to, recipientName, jobs)
  } else if (jobName === "sendInterviewScheduled") {
    await EmailService.sendInterviewScheduledEmail(to, recipientName, jobTitle, companyName, scheduledAt, location, timezone, mode, notes)
  } else if (jobName === "sendOfferReleased") {
    await EmailService.sendOfferReleasedEmail(to, recipientName, jobTitle, companyName, offerDetails)
  } else if (jobName === "sendApplicationStatusUpdate") {
    await EmailService.sendApplicationStatusUpdateEmail(to, recipientName, jobTitle, companyName, statusHeading, statusMessage, notes)
  } else if (jobName === "sendAccountStatusChanged") {
    await EmailService.sendAccountStatusChangedEmail(to, fullName, status)
  } else if (jobName === "sendAccountDeleted") {
    await EmailService.sendAccountDeletedEmail(to, fullName)
  } else if (jobName === "sendAccountReactivated") {
    await EmailService.sendAccountReactivatedEmail(to, fullName)
  }
}

async function handleCleanupJob(jobName: string, data: any) {
  const now = new Date()
  if (jobName === "invitationExpiry") {
    await prisma.invitation.updateMany({
      where: {
        expiresAt: { lte: now },
        acceptedAt: null,
      },
      data: { expiresAt: new Date(0) },
    })
    logger.info("[SchedulerWorker] Cleaned expired invitations.")
  } else if (jobName === "jobExpiry") {
    const jobs = await prisma.job.findMany({
      where: { status: { in: ["approved", "pending_approval"] } },
    })
    let closedCount = 0
    for (const job of jobs) {
      const parts = job.deadline.split("/")
      if (parts.length === 3) {
        const deadlineDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        if (deadlineDate <= now) {
          await prisma.job.update({
            where: { id: job.id },
            data: { status: "closed", visibility: "hidden" },
          })
          closedCount++
        }
      }
    }
    logger.info(`[SchedulerWorker] Closed ${closedCount} expired jobs.`)
  } else if (jobName === "notificationCleanup") {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    await prisma.notification.deleteMany({
      where: {
        createdAt: { lte: thirtyDaysAgo },
        read: true,
      },
    })
    logger.info("[SchedulerWorker] Cleaned read notifications older than 30 days.")
  } else if (jobName === "compileDailyDigests") {
    // Query approved jobs posted in last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentJobs = await prisma.job.findMany({
      where: { status: "approved", postedOn: { gte: yesterday } },
      include: { company: true },
      take: 5,
    })

    if (recentJobs.length > 0) {
      // Find active candidates who enabled daily digest
      const candidates = await prisma.candidateProfile.findMany({
        include: { user: true },
      })
      for (const cand of candidates) {
        const prefs = (cand.user.preferences as any) || {}
        if (prefs.dailyDigestEnabled !== false && cand.user.email) {
          await addJob("email", "sendDailyDigest", {
            to: cand.user.email,
            recipientName: cand.fullName,
            jobs: recentJobs.map(j => ({ title: j.title, companyName: j.company.name, location: j.location })),
          })
        }
      }
    }
  } else if (jobName === "compileWeeklyDigests") {
    // Query approved jobs posted in last 7 days
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentJobs = await prisma.job.findMany({
      where: { status: "approved", postedOn: { gte: lastWeek } },
      include: { company: true },
      take: 10,
    })

    if (recentJobs.length > 0) {
      const candidates = await prisma.candidateProfile.findMany({
        include: { user: true },
      })
      for (const cand of candidates) {
        const prefs = (cand.user.preferences as any) || {}
        if (prefs.weeklyDigestEnabled !== false && cand.user.email) {
          await addJob("email", "sendWeeklyDigest", {
            to: cand.user.email,
            recipientName: cand.fullName,
            jobs: recentJobs.map(j => ({ title: j.title, companyName: j.company.name, location: j.location })),
          })
        }
      }
    }
  }
}

// Bootstrap workers in non-test mode
if (!isTest && redisConnection) {
  const registerWorker = (
    name: string,
    handler: (job: Job) => Promise<void>,
    workerOptions: Record<string, any> = {}
  ) => {
    workers[name] = new Worker(
      name,
      async (job: Job) => {
        queueMetrics.activeJobs++
        try {
          await handler(job)
          queueMetrics.completedJobs++
        } catch (err) {
          queueMetrics.failedJobs++
          throw err
        } finally {
          queueMetrics.activeJobs = Math.max(0, queueMetrics.activeJobs - 1)
        }
      },
      { connection: redisConnection as any, ...workerOptions }
    )

    // real dead-letter queue. Previously
    // this only wrote an AuditLog row labeled "QUEUE_JOB_FAILED_DLQ" -- there
    // was no actual DLQ (no queue, no table) anywhere to inspect, replay, or
    // even count; the label was aspirational, not real. This now also pushes
    // the failed job into a genuine, separate BullMQ queue (see
    // pushToDeadLetterQueue above) that preserves queue name/job name/
    // sanitized data/failure reason/attemptsMade. The AuditLog write is kept
    // (now storing sanitized data too, not a raw token dump) so the event
    // still surfaces in the Admin Activity Log for visibility.
    workers[name].on("failed", (job: Job | undefined, err: Error) => {
      logger.error(`[Worker:${name}] Job ${job?.id} failed: ${err.message}`)
      // Route to the DLQ once retries are exhausted OR immediately for an
      // unrecoverable failure -- without the second condition a permanently
      // rejected email would fail on attempt 1 of 3, never satisfy the
      // exhausted-retries check, and disappear with no durable record.
      const isUnrecoverable = err?.name === "UnrecoverableError"
      if (job && (isUnrecoverable || job.attemptsMade >= (job.opts.attempts || 3))) {
        pushToDeadLetterQueue(name, job, err)

        prisma.auditLog.create({
          data: {
            category: "SYSTEM",
            action: "QUEUE_JOB_FAILED_DLQ",
            entity: "QueueJob",
            entityId: job.id || "unknown",
            // AuditLog exposes oldValue/newValue, not `metadata` -- the
            // previous key threw PrismaClientValidationError at runtime and
            // was swallowed by the .catch() below, so the DLQ audit trail
            // silently never existed.
            newValue: {
              queueName: name,
              jobName: job.name,
              error: err.message,
              attempts: job.attemptsMade,
              data: sanitizeJobData(job.data),
            },
            timestamp: new Date(),
          },
        }).catch((dbErr) => logger.error(`Failed to register DLQ failure in DB: ${dbErr.message}`))
      }
    })
  }

  // Bind workers
  //
  // The email worker is rate-limited to match the AWS SES sending quota.
  // SES enforces a hard per-second send rate (1/sec on a sandbox account) and
  // rejects anything above it with TooManyRequestsException -- which would
  // otherwise burn retry attempts and, in a sandbox, a meaningful slice of the
  // 240/24h allowance. Throttling client-side keeps sends inside the quota
  // instead of discovering the ceiling by failing.
  //
  // `concurrency: 1` matters as much as the limiter: BullMQ's limiter caps the
  // rate at which jobs START, so allowing parallel workers could still put
  // several requests in flight within the same second.
  registerWorker(
    "email",
    async (job) => {
      try {
        await handleEmailJob(job.name, job.data)
      } catch (err: any) {
        // A permanent SES rejection (unverified recipient in sandbox, a
        // suppressed address, a suspended account) can never succeed on retry.
        // Re-throwing it as UnrecoverableError tells BullMQ to fail the job
        // immediately instead of burning two more attempts -- and, in a
        // sandbox account, two more of the 240 daily sends.
        if (err?.permanent === true || err?.name === "PermanentEmailError") {
          throw new UnrecoverableError(err.message || "Permanent email rejection")
        }
        throw err
      }
    },
    {
      concurrency: 1,
      limiter: {
        max: env.SES_MAX_SEND_RATE_PER_SEC,
        duration: 1000,
      },
    }
  )

  registerWorker("cleanup", async (job) => {
    await handleCleanupJob(job.name, job.data)
  })
}

export default {
  queues,
  workers,
  addJob,
  queueMetrics,
  getDeadLetterQueueStats,
}
