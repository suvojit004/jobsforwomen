import EventBus from "../eventBus/eventBus"
import prisma from "../database/db"
import { logger } from "../utils/logger"
import { addJob } from "../queue/queue"

/**
 * Checks if email type notifications are enabled in user's preferences JSON.
 */
async function shouldSendEmail(userId: string, preferenceKey: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    })
    if (!user) return false
    const prefs = (user.preferences as any) || {}
    // If the preference key is not defined, default to true
    return prefs[preferenceKey] !== false
  } catch (err) {
    return true
  }
}

export function initEmailListener() {
  // 1. Verify Email & Welcome Email triggers (always send, transactional)
  EventBus.subscribe("UserRegistered", async (payload: any) => {
    logger.info(`[EmailListener] Enqueueing Welcome & Verification email to: ${payload.email}`)
    await addJob("email", "sendWelcome", {
      to: payload.email,
      token: payload.verificationToken,
    })
  })

  // 2. Company Approved trigger
  EventBus.subscribe("CompanyApproved", async (payload: any) => {
    try {
      const company = await prisma.company.findUnique({
        where: { id: payload.companyId },
        include: { recruiters: { include: { user: true } } },
      })
      if (company) {
        const recruiter = company.recruiters?.[0]
        const recruiterUserId = recruiter?.userId
        const toEmail = recruiter?.user?.email || "recruiter@jobsforwomen.info"
        const isEnabled = recruiterUserId ? await shouldSendEmail(recruiterUserId, "applicationUpdates") : true

        if (isEnabled && toEmail) {
          logger.info(`[EmailListener] Enqueueing Company Approved email to: ${toEmail}`)
          await addJob("email", "sendCompanyVerification", {
            to: toEmail,
            companyName: company.name,
            status: "Approved",
          })
        }
      }
    } catch (err: any) {
      logger.error(`[EmailListener] CompanyApproved trigger failed: ${err.message}`)
    }
  })

  // 3. Company Rejected trigger
  EventBus.subscribe("CompanyRejected", async (payload: any) => {
    try {
      const company = await prisma.company.findUnique({
        where: { id: payload.companyId },
        include: { recruiters: { include: { user: true } } },
      })
      if (company) {
        const recruiter = company.recruiters?.[0]
        const recruiterUserId = recruiter?.userId
        const toEmail = recruiter?.user?.email || "recruiter@jobsforwomen.info"
        const isEnabled = recruiterUserId ? await shouldSendEmail(recruiterUserId, "applicationUpdates") : true

        if (isEnabled && toEmail) {
          logger.info(`[EmailListener] Enqueueing Company Rejected email to: ${toEmail}`)
          await addJob("email", "sendCompanyVerification", {
            to: toEmail,
            companyName: company.name,
            status: "Rejected",
            notes: payload.notes || "Documents failed verification criteria.",
          })
        }
      }
    } catch (err: any) {
      logger.error(`[EmailListener] CompanyRejected trigger failed: ${err.message}`)
    }
  })

  // 3b. Company More-Information-Required trigger -- confirmed gap fix.
  // admin.service.ts's verifyCompany() previously only published an event
  // for the approved/rejected branches; setting a company to info_requested
  // (the "Request Documentation" admin action) fired nothing at all, so the
  // recruiter never received any email. Per spec, this state is communicated
  // by email only, reusing the same generic sendCompanyVerification job as
  // Approved/Rejected above.
  EventBus.subscribe("CompanyInfoRequested", async (payload: any) => {
    try {
      const company = await prisma.company.findUnique({
        where: { id: payload.companyId },
        include: { recruiters: { include: { user: true } } },
      })
      if (company) {
        const recruiter = company.recruiters?.[0]
        const recruiterUserId = recruiter?.userId
        const toEmail = recruiter?.user?.email || "recruiter@jobsforwomen.info"
        const isEnabled = recruiterUserId ? await shouldSendEmail(recruiterUserId, "applicationUpdates") : true

        if (isEnabled && toEmail) {
          logger.info(`[EmailListener] Enqueueing Company Info Requested email to: ${toEmail}`)
          const baseUrl = process.env.FRONTEND_URL || "https://jobsforwomen.info"
          await addJob("email", "sendCompanyVerification", {
            to: toEmail,
            companyName: company.name,
            status: "More Information Required",
            notes: payload.notes || "Please provide the requested documentation to continue verification.",
            actionLink: payload.verificationToken ? `${baseUrl}/company-verification/${payload.verificationToken}` : undefined,
            actionLabel: "Update Company Details",
          })
        }
      }
    } catch (err: any) {
      logger.error(`[EmailListener] CompanyInfoRequested trigger failed: ${err.message}`)
    }
  })

  // 3c. Perk request reviewed (Parts 6/7) -- email is the SECOND channel
  // here (notification.listener.ts's PerkReviewed subscriber handles the
  // dashboard notification); per spec, perks are communicated via both,
  // unlike company registration which is email-only.
  EventBus.subscribe("PerkReviewed", async (payload: any) => {
    try {
      const company = await prisma.company.findUnique({
        where: { id: payload.companyId },
        include: { recruiters: { include: { user: true } } },
      })
      if (company) {
        const recruiter = company.recruiters?.[0]
        const recruiterUserId = recruiter?.userId
        const toEmail = recruiter?.user?.email || "recruiter@jobsforwomen.info"
        const isEnabled = recruiterUserId ? await shouldSendEmail(recruiterUserId, "applicationUpdates") : true

        if (isEnabled && toEmail) {
          logger.info(`[EmailListener] Enqueueing Perk Reviewed email to: ${toEmail}`)
          const baseUrl = process.env.FRONTEND_URL || "https://jobsforwomen.info"
          await addJob("email", "sendPerkVerification", {
            to: toEmail,
            companyName: company.name,
            perkName: payload.perkName,
            status: payload.status,
            comment: payload.comment,
            actionLink: `${baseUrl}/recruiter/perks`,
          })
        }
      }
    } catch (err: any) {
      logger.error(`[EmailListener] PerkReviewed trigger failed: ${err.message}`)
    }
  })

  // 4. Job Approved trigger
  EventBus.subscribe("JobApproved", async (payload: any) => {
    try {
      const job = await prisma.job.findUnique({
        where: { id: payload.jobId },
        include: { recruiter: { include: { user: true } } },
      })
      if (job) {
        const recruiter = job.recruiter
        const recruiterUserId = recruiter?.userId
        const toEmail = recruiter?.user?.email || "recruiter@jobsforwomen.info"
        const isEnabled = recruiterUserId ? await shouldSendEmail(recruiterUserId, "newJobAlerts") : true

        if (isEnabled && toEmail) {
          logger.info(`[EmailListener] Enqueueing Job Approved email to: ${toEmail}`)
          await addJob("email", "sendJobModeration", {
            to: toEmail,
            jobTitle: job.title,
            status: "approved",
          })
        }
      }
    } catch (err: any) {
      logger.error(`[EmailListener] JobApproved trigger failed: ${err.message}`)
    }
  })

  // 5. Job Rejected trigger
  EventBus.subscribe("JobUpdated", async (payload: any) => {
    if (payload.status === "flagged") {
      try {
        const job = await prisma.job.findUnique({
          where: { id: payload.jobId },
          include: { recruiter: { include: { user: true } } },
        })
        if (job) {
          const recruiter = job.recruiter
          const recruiterUserId = recruiter?.userId
          const toEmail = recruiter?.user?.email || "recruiter@jobsforwomen.info"
          const isEnabled = recruiterUserId ? await shouldSendEmail(recruiterUserId, "newJobAlerts") : true

          if (isEnabled && toEmail) {
            logger.info(`[EmailListener] Enqueueing Job Rejected email to: ${toEmail}`)
            await addJob("email", "sendJobModeration", {
              to: toEmail,
              jobTitle: job.title,
              status: "rejected",
              notes: payload.notes || "Does not comply with job posting criteria.",
            })
          }
        }
      } catch (err: any) {
        logger.error(`[EmailListener] JobRejected trigger failed: ${err.message}`)
      }
    }
  })

  // 6. Employee Onboarding Invitation (always send, transactional)
  EventBus.subscribe("EmployeeInvited", async (payload: any) => {
    logger.info(`[EmailListener] Enqueueing Employee Invitation email to: ${payload.email}`)
    await addJob("email", "sendEmployeeInvitation", {
      to: payload.email,
      token: payload.token,
      roleName: payload.roleName || "Staff Member",
    })
  })

  // 7. Password Reset Token Dispatch (always send, transactional)
  EventBus.subscribe("PasswordResetRequested", async (payload: any) => {
    logger.info(`[EmailListener] Enqueueing Password Reset email to: ${payload.email}`)
    await addJob("email", "sendPasswordReset", {
      to: payload.email,
      token: payload.token,
    })
  })

  // 8. Interview Scheduled trigger
  EventBus.subscribe("InterviewScheduled", async (payload: any) => {
    try {
      const isEnabled = await shouldSendEmail(payload.candidateUserId, "applicationUpdates")
      if (!isEnabled) return

      const user = await prisma.user.findUnique({
        where: { id: payload.candidateUserId },
        include: { candidateProfile: true },
      })
      const job = payload.jobId
        ? await prisma.job.findUnique({ where: { id: payload.jobId }, include: { company: true } })
        : null

      if (user?.email) {
        await addJob("email", "sendInterviewScheduled", {
          to: user.email,
          recipientName: user.candidateProfile?.fullName || "Candidate",
          jobTitle: job?.title || "your application",
          companyName: job?.company?.name || "the company",
          scheduledAt: payload.scheduledAt
            ? new Date(payload.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
            : "the scheduled time (check your dashboard)",
          location: payload.location,
        })
      }
    } catch (err: any) {
      logger.error(`[EmailListener] InterviewScheduled trigger failed: ${err.message}`)
    }
  })

  // 9. Offer Released trigger
  EventBus.subscribe("OfferReleased", async (payload: any) => {
    try {
      const isEnabled = await shouldSendEmail(payload.candidateUserId, "applicationUpdates")
      if (!isEnabled) return

      const user = await prisma.user.findUnique({
        where: { id: payload.candidateUserId },
        include: { candidateProfile: true },
      })
      const job = payload.jobId
        ? await prisma.job.findUnique({ where: { id: payload.jobId }, include: { company: true } })
        : null

      if (user?.email) {
        await addJob("email", "sendOfferReleased", {
          to: user.email,
          recipientName: user.candidateProfile?.fullName || "Candidate",
          jobTitle: job?.title || "your application",
          companyName: job?.company?.name || "the company",
          offerDetails: payload.offerDetails || "Please log in to view your offer details.",
        })
      }
    } catch (err: any) {
      logger.error(`[EmailListener] OfferReleased trigger failed: ${err.message}`)
    }
  })
}

export default initEmailListener
