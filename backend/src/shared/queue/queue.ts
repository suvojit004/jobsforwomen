import { Queue, Worker, Job } from "bullmq"
import IORedis from "ioredis"
import env from "../config/env"
import { logger } from "../utils/logger"
import EmailService from "../utils/email"
import prisma from "../database/db"

const isTest = process.env.NODE_ENV === "test"

const redisConnection = !isTest
  ? new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })
  : null

export const queues: Record<string, Queue | any> = {}
export const workers: Record<string, Worker | any> = {}

const queueNames = ["email", "notifications", "audit", "cleanup", "reports"]

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

export async function addJob(queueName: string, jobName: string, data: any) {
  try {
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
  const { to, token, roleName, companyName, status, notes, jobTitle, recipientName, jobs, scheduledAt, location, offerDetails } = data
  if (jobName === "sendWelcome") {
    await EmailService.sendWelcomeEmail(to, token)
  } else if (jobName === "sendEmployeeInvitation") {
    await EmailService.sendEmployeeInvitation(to, token, roleName)
  } else if (jobName === "sendCompanyVerification") {
    await EmailService.sendCompanyVerificationEmail(to, companyName, status, notes)
  } else if (jobName === "sendJobModeration") {
    await EmailService.sendJobModerationEmail(to, jobTitle, status, notes)
  } else if (jobName === "sendPasswordReset") {
    await EmailService.sendPasswordResetEmail(to, token)
  } else if (jobName === "sendDailyDigest") {
    await EmailService.sendDailyDigest(to, recipientName, jobs)
  } else if (jobName === "sendWeeklyDigest") {
    await EmailService.sendWeeklyDigest(to, recipientName, jobs)
  } else if (jobName === "sendInterviewScheduled") {
    await EmailService.sendInterviewScheduledEmail(to, recipientName, jobTitle, companyName, scheduledAt, location)
  } else if (jobName === "sendOfferReleased") {
    await EmailService.sendOfferReleasedEmail(to, recipientName, jobTitle, companyName, offerDetails)
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
  const registerWorker = (name: string, handler: (job: Job) => Promise<void>) => {
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
      { connection: redisConnection as any }
    )

    // DLQ Fallback logger on exhausting max attempts
    workers[name].on("failed", (job: Job | undefined, err: Error) => {
      logger.error(`[Worker:${name}] Job ${job?.id} failed: ${err.message}`)
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        // Enqueue DLQ log into platform Audit logs
        prisma.auditLog.create({
          data: {
            category: "SYSTEM",
            action: "QUEUE_JOB_FAILED_DLQ",
            entity: "QueueJob",
            entityId: job.id || "unknown",
            metadata: {
              queueName: name,
              jobName: job.name,
              error: err.message,
              attempts: job.attemptsMade,
              data: job.data,
            },
            timestamp: new Date(),
          },
        }).catch((dbErr) => logger.error(`Failed to register DLQ failure in DB: ${dbErr.message}`))
      }
    })
  }

  // Bind workers
  registerWorker("email", async (job) => {
    await handleEmailJob(job.name, job.data)
  })

  registerWorker("cleanup", async (job) => {
    await handleCleanupJob(job.name, job.data)
  })
}

export default {
  queues,
  workers,
  addJob,
  queueMetrics,
}
