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
          const baseUrl = process.env.FRONTEND_URL || "https://jobsforwomen.info"
          await addJob("email", "sendCompanyVerification", {
            to: toEmail,
            companyName: company.name,
            status: "Approved",
            // Lets the recruiter go straight from the approval email to the
            // sign-in page instead of having to navigate to the site
            // themselves and remember/find the login URL.
            actionLink: `${baseUrl}/auth/login`,
            actionLabel: "Log In Now",
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

  // 3b. Company More-Information-Required trigger -- fix.
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

  // 3c. Perk request reviewed -- email is the SECOND channel
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

  // 6b. Admin/Moderator account created by a Super Admin (always send,
  // transactional). This account has no password until the recipient sets
  // one themselves -- admin.service.ts's createAdmin issues a PasswordReset
  // token and this email carries the set-password link, not a secret.
  EventBus.subscribe("AdminAccountCreated", async (payload: any) => {
    logger.info(`[EmailListener] Enqueueing Admin Account Created email to: ${payload.email}`)
    await addJob("email", "sendAdminAccountCreated", {
      to: payload.email,
      fullName: payload.fullName,
      setPasswordToken: payload.setPasswordToken,
      roleNames: payload.roleNames || [],
    })
  })

  // 6c. Candidate/recruiter account suspended or blocked by an admin.
  // Distinct from AdminAccountStatusChanged (admin-tier targets only, in-app
  // notification only, no email) -- this is the ordinary-user counterpart
  // that previously sent nothing at all, so a suspended candidate/recruiter
  // had no way to know why they suddenly couldn't log in.
  EventBus.subscribe("UserAccountStatusChanged", async (payload: any) => {
    logger.info(`[EmailListener] Enqueueing Account ${payload.status} email to: ${payload.email}`)
    await addJob("email", "sendAccountStatusChanged", {
      to: payload.email,
      fullName: payload.fullName,
      status: payload.status,
    })
  })

  // 6c-2. Candidate/recruiter account reactivated (Suspended/Blocked ->
  // Active) by an admin. Previously reactivation fired no email at all --
  // only suspend/block did -- so a restored account had no way to know they
  // could log back in again except by trying.
  EventBus.subscribe("UserAccountReactivated", async (payload: any) => {
    logger.info(`[EmailListener] Enqueueing Account Reactivated email to: ${payload.email}`)
    await addJob("email", "sendAccountReactivated", {
      to: payload.email,
      fullName: payload.fullName,
    })
  })

  // 6d. Candidate/recruiter account permanently deleted by an admin.
  // admin.service.ts's deleteUser previously published only an audit log
  // entry -- the account owner never learned their account was gone.
  EventBus.subscribe("UserAccountDeleted", async (payload: any) => {
    logger.info(`[EmailListener] Enqueueing Account Deleted email to: ${payload.email}`)
    await addJob("email", "sendAccountDeleted", {
      to: payload.email,
      fullName: payload.fullName,
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
          timezone: payload.timezone,
          mode: payload.mode,
          notes: payload.notes,
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

  // 10. Generic Application Status Change trigger -- the
  // Reviewed/Shortlisted/Hired/Rejected transitions handled by
  // RecruiterService.progressApplicant() previously sent no email at all.
  const STATUS_EMAIL_COPY: Record<string, { heading: string; message: (jobTitle: string, companyName: string) => string }> = {
    Reviewed: {
      heading: "Application Under Review",
      message: (jobTitle, companyName) => `Your application for ${jobTitle} at ${companyName} is now under review.`,
    },
    Shortlisted: {
      heading: "You've Been Shortlisted!",
      message: (jobTitle, companyName) => `Great news -- you've been shortlisted for ${jobTitle} at ${companyName}.`,
    },
    Hired: {
      heading: "Congratulations -- You're Selected!",
      message: (jobTitle, companyName) => `You've been selected for ${jobTitle} at ${companyName}! The recruiter will be in touch with next steps.`,
    },
    Rejected: {
      heading: "Application Update",
      message: (jobTitle, companyName) =>
        `Thank you for your interest in ${jobTitle} at ${companyName}. The recruiter has decided not to move forward with your application at this time.`,
    },
  }

  EventBus.subscribe("ApplicationStatusChanged", async (payload: any) => {
    try {
      const copy = STATUS_EMAIL_COPY[payload.status]
      if (!copy) return

      const isEnabled = await shouldSendEmail(payload.candidateUserId, "applicationUpdates")
      if (!isEnabled) return

      const user = await prisma.user.findUnique({
        where: { id: payload.candidateUserId },
        include: { candidateProfile: true },
      })
      const job = payload.jobId
        ? await prisma.job.findUnique({ where: { id: payload.jobId }, include: { company: true } })
        : null
      const jobTitle = job?.title || payload.jobTitle || "your application"
      const companyName = job?.company?.name || "the company"

      if (user?.email) {
        await addJob("email", "sendApplicationStatusUpdate", {
          to: user.email,
          recipientName: user.candidateProfile?.fullName || "Candidate",
          jobTitle,
          companyName,
          statusHeading: copy.heading,
          statusMessage: copy.message(jobTitle, companyName),
          notes: payload.notes || undefined,
        })
      }
    } catch (err: any) {
      logger.error(`[EmailListener] ApplicationStatusChanged trigger failed: ${err.message}`)
    }
  })
}

export default initEmailListener
