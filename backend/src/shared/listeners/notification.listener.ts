import EventBus from "../eventBus/eventBus"
import prisma from "../database/db"
import { logger } from "../utils/logger"
import { sendRealTimeNotification } from "../socket/socket"

async function createAndEmitNotification(data: {
  recipientId: string
  title: string
  message: string
  category: string
  actionUrl?: string
  // Optional idempotency key (see Notification.dedupeKey). When provided
  // and a notification with this exact key already exists (e.g. because the
  // triggering domain event was published twice -- a retried request, a
  // double-clicked admin action), this silently returns the existing row
  // instead of creating and re-emitting a duplicate.
  dedupeKey?: string
}) {
  let notification
  try {
    notification = await prisma.notification.create({ data })
  } catch (err: any) {
    if (data.dedupeKey && err?.code === "P2002") {
      logger.debug(`[NotificationListener] Duplicate suppressed for dedupeKey: ${data.dedupeKey}`)
      return prisma.notification.findUnique({ where: { dedupeKey: data.dedupeKey } })
    }
    throw err
  }
  try {
    sendRealTimeNotification(data.recipientId, notification)
  } catch (err: any) {
    logger.warn(`[NotificationListener] Real-time emit failed: ${err.message}`)
  }
  return notification
}

export function initNotificationListener() {
  // 1. Applications Submission Handler
  EventBus.subscribe("ApplicationSubmitted", async (payload: any) => {
    logger.debug(`[NotificationListener] Creating notification for recruiter on Application: ${payload.applicationId}`)
    
    // Create Recruiter Notification
    await createAndEmitNotification({
      recipientId: payload.recruiterUserId,
      title: "New Application Received",
      message: `${payload.candidateName} has applied for ${payload.jobTitle}`,
      category: "Application",
      // Real recruiter route is "applicants/:id" (CandidatePreview page),
      // not "applications/:id" -- there is no such route, so this link
      // previously 404'd via RecruiterRoutes' catch-all every time.
      actionUrl: `/recruiter/applicants/${payload.applicationId}`,
    })

    // Dispatch corresponding Audit Event
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "CANDIDATE",
      action: "SUBMIT_APPLICATION",
      entity: "Application",
      entityId: payload.applicationId,
    })
  })

  // 2. Applications Withdrawal Handler
  EventBus.subscribe("ApplicationWithdrawn", async (payload: any) => {
    logger.debug(`[NotificationListener] Creating notification for recruiter on application withdrawal: ${payload.applicationId}`)

    await createAndEmitNotification({
      recipientId: payload.recruiterUserId,
      title: "Application Withdrawn",
      message: `${payload.candidateName} has withdrawn their application for ${payload.jobTitle}`,
      category: "Application",
      // Real recruiter route is "applicants/:id" (CandidatePreview page),
      // not "applications/:id" -- there is no such route, so this link
      // previously 404'd via RecruiterRoutes' catch-all every time.
      actionUrl: `/recruiter/applicants/${payload.applicationId}`,
    })

    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "CANDIDATE",
      action: "WITHDRAW_APPLICATION",
      entity: "Application",
      entityId: payload.applicationId,
    })
  })

  // 3. Profile Updates Audits
  EventBus.subscribe("CandidateProfileUpdated", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "CANDIDATE",
      action: "UPDATE_PROFILE",
      entity: "CandidateProfile",
      entityId: payload.candidateId,
      oldValue: payload.oldValue,
      newValue: payload.newValue,
    })
  })

  // 4. Resume Actions Audits
  EventBus.subscribe("ResumeUploaded", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "CANDIDATE",
      action: "UPDATE_RESUME",
      entity: "CandidateProfile",
      entityId: payload.candidateId,
      newValue: { resumeUrl: payload.url },
    })
  })

  EventBus.subscribe("ResumeDeleted", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "CANDIDATE",
      action: "DELETE_RESUME",
      entity: "CandidateProfile",
      entityId: payload.candidateId,
    })
  })

  // 5. Job Reporting Audits
  EventBus.subscribe("JobReported", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "CANDIDATE",
      action: "REPORT_JOB",
      entity: "Job",
      entityId: payload.jobId,
      newValue: { reason: payload.reason },
    })
  })

  // 6. Settings Change Audits
  EventBus.subscribe("FeatureFlagUpdated", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "CANDIDATE",
      action: "UPDATE_SETTINGS",
      entity: "User",
      entityId: payload.userId,
      newValue: payload.settings,
    })
  })

  // 6b. Admin feature-flag change audits -- a distinct event from the
  // candidate-settings "FeatureFlagUpdated" above (they used to share the
  // same event name and got mislabeled as candidate settings updates; see
  // admin.service.ts's createFeatureFlag/updateFeatureFlag).
  EventBus.subscribe("AdminFeatureFlagUpdated", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      operatorId: payload.adminId,
      category: "ADMIN",
      action: "UPDATE_FEATURE_FLAG",
      entity: "FeatureFlag",
      entityId: payload.flagId,
      newValue: { [payload.flagKey]: payload.flagValue },
    })
  })

  // 7. Login Audit logs dispatch
  EventBus.subscribe("UserLoggedIn", (payload: any) => {
    EventBus.publish("AuditCreated", {
      operatorId: payload.userId,
      operatorEmail: payload.email,
      ipAddress: payload.ipAddress,
      browser: payload.userAgent,
      category: "AUTH",
      action: "USER_LOGIN",
    })
  })

  // 8. Email Verification Audits
  EventBus.subscribe("EmailVerified", (payload: any) => {
    EventBus.publish("AuditCreated", {
      operatorId: payload.userId,
      operatorEmail: payload.email,
      category: "AUTH",
      action: "EMAIL_VERIFICATION",
      oldValue: { status: "PendingVerification" },
      newValue: { status: payload.status },
    })
  })

  // 9. Staff Acceptance Audits
  EventBus.subscribe("EmployeeInvitationAccepted", (payload: any) => {
    EventBus.publish("AuditCreated", {
      operatorId: payload.userId,
      operatorEmail: payload.email,
      category: "AUTH",
      action: "ACCEPT_INVITATION",
      newValue: { roleId: payload.roleId },
    })
  })

  // 10. Recruiter Company Submissions / Audits
  EventBus.subscribe("CompanySubmitted", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "RECRUITER",
      action: "SUBMIT_COMPANY",
      entity: "Company",
      entityId: payload.companyId,
    })
  })

  EventBus.subscribe("CompanyApproved", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "RECRUITER",
      action: "APPROVE_COMPANY",
      entity: "Company",
      entityId: payload.companyId,
    })
  })

  EventBus.subscribe("CompanyRejected", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "RECRUITER",
      action: "REJECT_COMPANY",
      entity: "Company",
      entityId: payload.companyId,
    })
  })

  // 11. Recruiter Job Lifecycle updates
  EventBus.subscribe("JobUpdated", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "RECRUITER",
      action: "UPDATE_JOB",
      entity: "Job",
      entityId: payload.jobId,
      oldValue: payload.oldValue,
      newValue: payload.newValue,
    })
  })

  EventBus.subscribe("JobPaused", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "RECRUITER",
      action: "PAUSE_JOB",
      entity: "Job",
      entityId: payload.jobId,
    })
  })

  EventBus.subscribe("JobResumed", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "RECRUITER",
      action: "RESUME_JOB",
      entity: "Job",
      entityId: payload.jobId,
    })
  })

  EventBus.subscribe("JobClosed", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "RECRUITER",
      action: "CLOSE_JOB",
      entity: "Job",
      entityId: payload.jobId,
    })
  })

  // 12. Interview Scheduled Notifications & Audits
  EventBus.subscribe("InterviewScheduled", async (payload: any) => {
    logger.debug(`[NotificationListener] Creating interview notification for candidate: ${payload.candidateUserId}`)
    await createAndEmitNotification({
      recipientId: payload.candidateUserId,
      title: "Interview Scheduled!",
      message: `Your interview for job ID ${payload.jobId} has been scheduled.`,
      category: "Application",
      // CandidateRoutes has no "applications/:id" sub-route (Applications.tsx
      // is a flat list with no per-row deep link support) -- link to the
      // real list page instead of a route that doesn't exist.
      actionUrl: "/candidate/applications",
    })

    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "RECRUITER",
      action: "SCHEDULE_INTERVIEW",
      entity: "Application",
      entityId: payload.applicationId,
    })
  })

  // 13. Offer Released Notifications & Audits
  EventBus.subscribe("OfferReleased", async (payload: any) => {
    logger.debug(`[NotificationListener] Creating offer notification for candidate: ${payload.candidateUserId}`)
    await createAndEmitNotification({
      recipientId: payload.candidateUserId,
      title: "Job Offer Released!",
      message: `Congratulations! You have received a job offer for job ID ${payload.jobId}.`,
      category: "Application",
      // CandidateRoutes has no "applications/:id" sub-route (Applications.tsx
      // is a flat list with no per-row deep link support) -- link to the
      // real list page instead of a route that doesn't exist.
      actionUrl: "/candidate/applications",
    })

    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "RECRUITER",
      action: "RELEASE_OFFER",
      entity: "Application",
      entityId: payload.applicationId,
    })
  })

  // 14. Job Submitted For Approval -- notify active admins
  EventBus.subscribe("JobSubmittedForApproval", async (payload: any) => {
    logger.debug(`[NotificationListener] Job ${payload.jobId} submitted for approval -- notifying admins`)
    const admins = await prisma.user.findMany({
      where: {
        status: "Active",
        roles: { some: { role: { name: { in: ["Admin", "Super Admin"] } } } },
      },
      select: { id: true },
    })

    await Promise.all(
      admins.map((admin) =>
        createAndEmitNotification({
          recipientId: admin.id,
          title: "New Job Pending Approval",
          message: `${payload.companyName || "A recruiter"} submitted "${payload.jobTitle}" for review.`,
          category: "Moderation",
          // AdminRoutes only has a single "job-moderation" list route -- no
          // per-job detail page exists to deep-link into.
          actionUrl: "/admin/job-moderation",
          dedupeKey: `job-submitted:${payload.jobId}:${admin.id}`,
        })
      )
    )
  })

  // 15. Admin Job Approved Event -- notify the owning recruiter and matched candidates
  EventBus.subscribe("JobApproved", async (payload: any) => {
    // 1. Audit log
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "ADMIN",
      action: "APPROVE_JOB",
      entity: "Job",
      entityId: payload.jobId,
    })

    if (payload.recruiterUserId) {
      await createAndEmitNotification({
        recipientId: payload.recruiterUserId,
        title: "Job Posting Approved",
        message: `Your job posting "${payload.jobTitle}" has been approved and is now live.`,
        category: "Moderation",
        actionUrl: `/recruiter/jobs/${payload.jobId}`,
        dedupeKey: `job-approved-recruiter:${payload.jobId}`,
      })
    }

    const candidateUserIds = await findMatchedCandidateUserIds(payload.jobId, payload.jobLocation)
    logger.debug(`[NotificationListener] Job ${payload.jobId} approved -- notifying ${candidateUserIds.length} matched candidate(s)`)

    await Promise.all(
      candidateUserIds.map((userId) =>
        createAndEmitNotification({
          recipientId: userId,
          title: "New Job Match",
          message: `A new opportunity matching your profile is open: "${payload.jobTitle}".`,
          category: "Job",
          actionUrl: `/candidate/jobs/${payload.jobId}`,
          dedupeKey: `job-approved-candidate:${payload.jobId}:${userId}`,
        })
      )
    )
  })

  // 16. Admin Job Rejected Event -- notify the owning recruiter with the reason
  EventBus.subscribe("JobRejected", async (payload: any) => {
    if (payload.recruiterUserId) {
      await createAndEmitNotification({
        recipientId: payload.recruiterUserId,
        title: "Job Posting Rejected",
        message: payload.reason
          ? `Your job posting "${payload.jobTitle}" was rejected: ${payload.reason}`
          : `Your job posting "${payload.jobTitle}" was rejected.`,
        category: "Moderation",
        actionUrl: `/recruiter/jobs/${payload.jobId}`,
        dedupeKey: `job-rejected:${payload.jobId}`,
      })
    }

    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "ADMIN",
      action: "REJECT_JOB",
      entity: "Job",
      entityId: payload.jobId,
      newValue: { reason: payload.reason },
    })
  })
}

// Case-insensitive, whitespace-trimmed substring containment. This is a
// deliberately conservative choice, not a fuzzy/geocoded matcher: it will
// match "Bangalore" against "Bangalore, India" or "bangalore ", but it will
// NOT match city aliases ("Bengaluru"), typos, or nearby-but-different
// locations. Job.location and CandidateProfile.location/preferredLocations
// are free-text fields with no shared normalized vocabulary (unlike skills,
// which are backed by a real, upserted Skill entity both sides join
// against) -- there is nothing more reliable to match on without adding a
// geocoding/city-alias table, which is out of scope here.
function normalizeLocation(value?: string | null): string {
  return (value || "").trim().toLowerCase()
}

function locationsMatch(jobLocation?: string | null, candidateLocation?: string | null): boolean {
  const a = normalizeLocation(jobLocation)
  const b = normalizeLocation(candidateLocation)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

// Upper bound on how many candidates a single job-approval fan-out will
// notify. Without this, a very broadly-matching job (e.g. location
// "Remote", or a common skill like "Communication") could queue up
// hundreds/thousands of notification writes and socket emits from one
// admin click.
const MAX_MATCHED_CANDIDATES = 100

// Candidate matching rule (documented per the two very different kinds of
// stored data this joins against):
//
// 1. Skill match -- reliable. Job.skills and CandidateProfile.skills are
//    both normalized through the same shared `Skill` entity (upserted by
//    name in recruiter.service.ts's postJob and in the candidate profile
//    editor), so this is an exact id-based join with no fuzzy logic needed.
//    A candidate matches if they have ANY skill the job lists.
//
// 2. Location match -- best-effort. See `locationsMatch` above for the
//    exact rule and its limitations. A candidate matches if their profile
//    `location` OR any entry in `preferredLocations` case-insensitively
//    contains (or is contained by) the job's location string.
//
// Candidates in either group are merged into a single deduplicated set (a
// candidate who matches on both skill AND location is only notified once).
// Only users with UserStatus "Active" are considered -- PendingVerification,
// PendingApproval, Rejected, Suspended, and Blocked accounts are excluded,
// so a suspended candidate never gets paged about a job they can't apply to.
async function findMatchedCandidateUserIds(jobId: string, jobLocation?: string | null): Promise<string[]> {
  const matchedUserIds = new Set<string>()

  const jobSkills = await prisma.jobSkill.findMany({
    where: { jobId },
    select: { skillId: true },
  })
  const skillIds = jobSkills.map((js) => js.skillId)

  if (skillIds.length > 0) {
    const skillMatches = await prisma.candidateSkill.findMany({
      where: {
        skillId: { in: skillIds },
        candidate: { user: { status: "Active" } },
      },
      select: { candidate: { select: { userId: true } } },
    })
    skillMatches.forEach((m) => matchedUserIds.add(m.candidate.userId))
  }

  if (jobLocation) {
    const candidatesWithLocation = await prisma.candidateProfile.findMany({
      where: {
        user: { status: "Active" },
        OR: [{ location: { not: null } }, { preferredLocations: { isEmpty: false } }],
      },
      select: { userId: true, location: true, preferredLocations: true },
    })

    candidatesWithLocation.forEach((c) => {
      const candidateLocations = [c.location, ...(c.preferredLocations || [])].filter(Boolean) as string[]
      if (candidateLocations.some((loc) => locationsMatch(jobLocation, loc))) {
        matchedUserIds.add(c.userId)
      }
    })
  }

  return Array.from(matchedUserIds).slice(0, MAX_MATCHED_CANDIDATES)
}

export default initNotificationListener
