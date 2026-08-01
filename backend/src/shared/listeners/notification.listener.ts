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

// Shared helper for the several events that must fan out to every active
// Admin/Super Admin user (job submitted, application submitted, interview
// scheduled). Centralizing this avoids re-querying/re-implementing the
// admin lookup + per-admin dedupeKey pattern three separate times.
async function notifyActiveAdmins(opts: {
  title: string
  message: string
  category: string
  actionUrl: string
  dedupeKeyPrefix: string
}) {
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
        title: opts.title,
        message: opts.message,
        category: opts.category,
        actionUrl: opts.actionUrl,
        dedupeKey: `${opts.dedupeKeyPrefix}:${admin.id}`,
      })
    )
  )
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

    // Admins need lifecycle visibility into application activity too --
    // there is no dedicated admin per-application page, so this links to
    // the closest real existing oversight surface (Job Moderation), same
    // as JobSubmittedForApproval below.
    await notifyActiveAdmins({
      title: "New Job Application",
      message: `${payload.candidateName} applied for ${payload.jobTitle}${payload.companyName ? ` at ${payload.companyName}` : ""}.`,
      category: "Application",
      actionUrl: "/admin/job-moderation",
      dedupeKeyPrefix: `application-submitted:${payload.applicationId}`,
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

  // 9a. Part 14 audit-completeness fix: password changes (both the
  // "forgot password" reset-token flow and the authenticated
  // change-password flow in auth.service.ts both publish this same event)
  // previously fired zero audit trail at all -- a security-relevant account
  // change with no record of who/when/from-where it happened.
  EventBus.subscribe("PasswordChanged", (payload: any) => {
    EventBus.publish("AuditCreated", {
      operatorId: payload.userId,
      operatorEmail: payload.email,
      category: "AUTH",
      action: "PASSWORD_CHANGED",
    })
  })

  // 9b. Part 14 audit-completeness fix: permanent self-service account
  // deletion previously had no audit trail whatsoever -- the single most
  // destructive action a user can take on their own account.
  EventBus.subscribe("AccountDeleted", (payload: any) => {
    EventBus.publish("AuditCreated", {
      operatorId: payload.userId,
      operatorEmail: payload.email,
      category: "AUTH",
      action: "ACCOUNT_DELETED",
    })
  })

  // 9c. Part 14 audit-completeness fix: a password-reset *request* is
  // unauthenticated (anyone can trigger one for any email), which is
  // exactly why it's worth a record -- repeated reset requests against the
  // same account are a common account-takeover/enumeration signal that a
  // real audit trail should be able to surface.
  EventBus.subscribe("PasswordResetRequested", (payload: any) => {
    EventBus.publish("AuditCreated", {
      operatorEmail: payload.email,
      category: "AUTH",
      action: "PASSWORD_RESET_REQUESTED",
    })
  })

  // 10a. Recruiter Company Registration (new registration submitted -- fires
  // once at registerRecruiter() time, distinct from CompanySubmitted below
  // which fires later on company-profile onboarding/resubmission). Per spec,
  // recruiters only ever hear about registration/approval status via email
  // (see email.listener.ts's CompanyApproved/CompanyRejected handlers);
  // admins get a realtime in-app notification so a new request doesn't go
  // unnoticed.
  EventBus.subscribe("CompanyRegistered", async (payload: any) => {
    try {
      EventBus.publish("AuditCreated", {
        category: "RECRUITER",
        action: "COMPANY_REGISTERED",
        entity: "Company",
        entityId: payload.companyId,
        newValue: { companyName: payload.companyName, recruiterEmail: payload.recruiterEmail },
      })

      await notifyActiveAdmins({
        title: "New Company Registration",
        message: `${payload.companyName} has submitted a registration and is awaiting verification.`,
        category: "Moderation",
        actionUrl: "/admin/company-approvals",
        dedupeKeyPrefix: `company-registered:${payload.companyId}`,
      })
    } catch (err: any) {
      logger.error(`[NotificationListener] CompanyRegistered trigger failed: ${err.message}`)
    }
  })

  // 10b. Recruiter Company Submissions / Audits
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

  // Audit trail for the info_requested branch (see email.listener.ts for the
  // corresponding email side of this same event).
  EventBus.subscribe("CompanyInfoRequested", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "RECRUITER",
      action: "REQUEST_COMPANY_INFO",
      entity: "Company",
      entityId: payload.companyId,
      newValue: { notes: payload.notes },
    })
  })

  // Recruiter resubmission via the public /company-verification/:token page
  // . Unlike registration/approval, this is NOT communicated to the
  // recruiter by email (they're the one who just acted) -- it's an
  // admin-facing signal only: audit trail + realtime dashboard notification,
  // matching Part 11's explicit "Company Resubmission" admin-notification
  // requirement.
  EventBus.subscribe("CompanyVerificationResubmitted", async (payload: any) => {
    try {
      EventBus.publish("AuditCreated", {
        category: "RECRUITER",
        action: "RESUBMIT_COMPANY_VERIFICATION",
        entity: "Company",
        entityId: payload.companyId,
        newValue: { comment: payload.comment },
      })

      await notifyActiveAdmins({
        title: "Company Resubmission",
        message: `${payload.companyName} has resubmitted company verification details for review.`,
        category: "Moderation",
        actionUrl: "/admin/company-approvals",
        // Keyed on the resubmission's own timestamp (not Date.now() at
        // listener-invocation time) so a genuine retry of the same request
        // is deduplicated, while a second, later resubmission by the same
        // company still gets its own notification.
        dedupeKeyPrefix: `company-resubmitted:${payload.companyId}:${payload.resubmittedAt || "unknown"}`,
      })
    } catch (err: any) {
      logger.error(`[NotificationListener] CompanyVerificationResubmitted trigger failed: ${err.message}`)
    }
  })

  // Recruiter uploaded a document to the public company-verification page
  // (Part 3/11/18) -- admin-facing realtime signal, distinct from a full
  // resubmission (CompanyVerificationResubmitted). this event
  // never fired at all before, so an admin had no way to know a requested
  // document had arrived unless the recruiter also clicked "Resubmit".
  EventBus.subscribe("CompanyDocumentUploaded", async (payload: any) => {
    try {
      EventBus.publish("AuditCreated", {
        category: "RECRUITER",
        action: "UPLOAD_COMPANY_DOCUMENT",
        entity: "Company",
        entityId: payload.companyId,
        newValue: { category: payload.category },
      })

      await notifyActiveAdmins({
        title: "Company Document Uploaded",
        message: `${payload.companyName} uploaded a "${payload.category}" document for verification review.`,
        category: "Moderation",
        actionUrl: "/admin/company-approvals",
        // Keyed on the upload's own server-set timestamp (not Date.now() at
        // listener-invocation time), same rationale as
        // CompanyVerificationResubmitted above: a genuine retry of the same
        // request is deduplicated, while a distinct later upload still
        // notifies separately.
        dedupeKeyPrefix: `company-doc-uploaded:${payload.companyId}:${payload.category}:${payload.uploadedAt || "unknown"}`,
      })
    } catch (err: any) {
      logger.error(`[NotificationListener] CompanyDocumentUploaded trigger failed: ${err.message}`)
    }
  })

  // Recruiter uploaded a document against a perk claim --
  // admin-facing realtime signal, distinct from submitting/resubmitting the
  // perk claim itself (PerkSubmitted). Same confirmed-gap rationale as
  // CompanyDocumentUploaded above.
  EventBus.subscribe("PerkDocumentUploaded", async (payload: any) => {
    try {
      EventBus.publish("AuditCreated", {
        category: "RECRUITER",
        action: "UPLOAD_PERK_DOCUMENT",
        entity: "CompanyPerkRequest",
        entityId: payload.perkRequestId,
        newValue: { category: payload.category },
      })

      await notifyActiveAdmins({
        title: "Perk Document Uploaded",
        message: `${payload.companyName || "A recruiter"} uploaded a document for "${payload.perkName}" verification.`,
        category: "Moderation",
        actionUrl: "/admin/company-perk-requests",
        dedupeKeyPrefix: `perk-doc-uploaded:${payload.perkRequestId}:${payload.category}:${payload.uploadedAt || "unknown"}`,
      })
    } catch (err: any) {
      logger.error(`[NotificationListener] PerkDocumentUploaded trigger failed: ${err.message}`)
    }
  })

  // Perk request submitted/resubmitted (Parts 6/7/11) -- admin-facing side.
  // Part 11 lists "New Perk Request" and "Perk Resubmission" as two distinct
  // realtime admin-notification triggers; payload.isResubmission picks
  // between them.
  EventBus.subscribe("PerkSubmitted", async (payload: any) => {
    try {
      EventBus.publish("AuditCreated", {
        ...payload.context,
        category: "RECRUITER",
        action: payload.isResubmission ? "RESUBMIT_PERK_REQUEST" : "SUBMIT_PERK_REQUEST",
        entity: "CompanyPerkRequest",
        entityId: payload.perkRequestId,
        newValue: { perkName: payload.perkName },
      })

      await notifyActiveAdmins({
        title: payload.isResubmission ? "Perk Resubmission" : "New Perk Request",
        message: `${payload.companyName || "A recruiter"} ${payload.isResubmission ? "resubmitted" : "submitted"} "${payload.perkName}" for verification.`,
        category: "Moderation",
        actionUrl: "/admin/company-perk-requests",
        dedupeKeyPrefix: `perk-submitted:${payload.perkRequestId}:${payload.isResubmission ? "resubmit" : "new"}`,
      })
    } catch (err: any) {
      logger.error(`[NotificationListener] PerkSubmitted trigger failed: ${err.message}`)
    }
  })

  // Perk request reviewed -- recruiter-facing side. Unlike
  // company registration (email-only), perk decisions are communicated via
  // BOTH a dashboard notification (here) AND an email
  // (email.listener.ts's PerkReviewed subscriber).
  EventBus.subscribe("PerkReviewed", async (payload: any) => {
    try {
      const company = await prisma.company.findUnique({
        where: { id: payload.companyId },
        include: { recruiters: true },
      })
      const recruiterUserId = company?.recruiters?.[0]?.userId
      if (recruiterUserId) {
        const titleByStatus: Record<string, string> = {
          approved: "Perk Approved",
          rejected: "Perk Rejected",
          info_requested: "More Information Needed for Perk",
        }
        const messageByStatus: Record<string, string> = {
          approved: `Your "${payload.perkName}" claim has been approved and is now public.`,
          rejected: `Your "${payload.perkName}" claim was rejected. See the reason and resubmit from your dashboard.`,
          info_requested: `Please provide more information for your "${payload.perkName}" claim.`,
        }

        await createAndEmitNotification({
          recipientId: recruiterUserId,
          title: titleByStatus[payload.status] || "Perk Status Updated",
          message: messageByStatus[payload.status] || `Your "${payload.perkName}" claim status was updated.`,
          category: "Moderation",
          actionUrl: "/recruiter/perks",
        })
      }

      EventBus.publish("AuditCreated", {
        ...payload.context,
        operatorId: payload.operatorId,
        operatorEmail: payload.operatorEmail,
        category: "ADMIN",
        action: "REVIEW_PERK_REQUEST",
        entity: "CompanyPerkRequest",
        entityId: payload.perkRequestId,
        newValue: { status: payload.status, comment: payload.comment },
      })
    } catch (err: any) {
      logger.error(`[NotificationListener] PerkReviewed trigger failed: ${err.message}`)
    }
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

    const whenText = payload.scheduledAt
      ? new Date(payload.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
      : "a scheduled time"
    const whereText = payload.mode === "Offline" ? payload.venue : payload.meetingLink

    await createAndEmitNotification({
      recipientId: payload.candidateUserId,
      title: "Interview Scheduled!",
      message: (payload.jobTitle
        ? `Your interview for ${payload.jobTitle} has been scheduled for ${whenText}.`
        : `Your interview has been scheduled for ${whenText}.`) + (whereText ? ` (${payload.mode === "Offline" ? "Venue" : "Meeting link"}: ${whereText})` : ""),
      category: "Application",
      // CandidateRoutes has no "applications/:id" sub-route (Applications.tsx
      // is a flat list with no per-row deep link support) -- link to the
      // real list page instead of a route that doesn't exist.
      actionUrl: "/candidate/applications",
      dedupeKey: `interview-scheduled-candidate:${payload.applicationId}`,
    })

    // Admins need lifecycle visibility here too -- there is no dedicated
    // admin per-application/interview page, so this links to the closest
    // real existing oversight surface (Job Moderation), same convention as
    // the other admin fan-outs in this file.
    await notifyActiveAdmins({
      title: "Interview Scheduled",
      message: `Interview scheduled: ${payload.candidateName || "A candidate"} for ${payload.jobTitle || "a job posting"} on ${whenText}.`,
      category: "Application",
      actionUrl: "/admin/job-moderation",
      dedupeKeyPrefix: `interview-scheduled-admin:${payload.applicationId}`,
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
      // payload.jobTitle didn't exist until the
      // recruiter.service.ts fix above, so this always printed the raw job
      // UUID instead of a readable role name.
      message: payload.jobTitle
        ? `Congratulations! You have received a job offer for ${payload.jobTitle}.`
        : `Congratulations! You have received a job offer.`,
      category: "Application",
      // CandidateRoutes has no "applications/:id" sub-route (Applications.tsx
      // is a flat list with no per-row deep link support) -- link to the
      // real list page instead of a route that doesn't exist.
      actionUrl: "/candidate/applications",
    })

    // Admins need lifecycle visibility here too, same as InterviewScheduled
    // above -- previously this event only ever notified the candidate, so an
    // offer release never showed up anywhere in the admin app.
    await notifyActiveAdmins({
      title: "Offer Released",
      message: `Offer released: ${payload.candidateName || "A candidate"} for ${payload.jobTitle || "a job posting"}.`,
      category: "Application",
      actionUrl: "/admin/job-moderation",
      dedupeKeyPrefix: `offer-released-admin:${payload.applicationId}`,
    })

    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "RECRUITER",
      action: "RELEASE_OFFER",
      entity: "Application",
      entityId: payload.applicationId,
    })
  })

  // 13b. Generic Application Status Change Notifications --
  // Reviewed/Shortlisted/Hired/Rejected all flow through
  // RecruiterService.progressApplicant(), which previously only published
  // "AuditCreated". This is the missing candidate-facing half: a DB
  // notification (+ socket push via createAndEmitNotification) for every
  // status this generic endpoint can set. InterviewScheduled/OfferReleased
  // keep their own dedicated, richer handlers above -- progressApplicant
  // can never set those two (see STRUCTURED_STATUSES in recruiter.service.ts).
  const STATUS_NOTIFICATION_COPY: Record<string, { title: string; message: (jobTitle: string) => string }> = {
    Reviewed: {
      title: "Application Under Review",
      message: (jobTitle) => `Your application for ${jobTitle} is now under review.`,
    },
    Shortlisted: {
      title: "You've Been Shortlisted!",
      message: (jobTitle) => `Great news! You've been shortlisted for ${jobTitle}.`,
    },
    Hired: {
      title: "Congratulations — You're Selected!",
      message: (jobTitle) => `You've been selected for ${jobTitle}! The recruiter will be in touch with next steps.`,
    },
    Rejected: {
      title: "Application Update",
      message: (jobTitle) =>
        `Thank you for your interest in ${jobTitle}. The recruiter has decided not to move forward with your application at this time.`,
    },
  }

  EventBus.subscribe("ApplicationStatusChanged", async (payload: any) => {
    const copy = STATUS_NOTIFICATION_COPY[payload.status]
    if (!copy) {
      // Applied is the only other status reachable through this path (a
      // recruiter "resetting" an application), and it has no useful
      // candidate-facing message -- silently skip rather than notify with
      // a blank/confusing message.
      return
    }
    logger.debug(
      `[NotificationListener] Creating status-change notification (${payload.status}) for candidate: ${payload.candidateUserId}`
    )
    const jobTitle = payload.jobTitle || "your application"
    await createAndEmitNotification({
      recipientId: payload.candidateUserId,
      title: copy.title,
      message: copy.message(jobTitle),
      category: "Application",
      actionUrl: "/candidate/applications",
      // Dedupe on applicationId+status so a retried/duplicated publish of
      // the same transition can't double-notify the candidate.
      dedupeKey: `application-status:${payload.applicationId}:${payload.status}`,
    })
  })

  // 14. Job Submitted For Approval -- notify active admins
  EventBus.subscribe("JobSubmittedForApproval", async (payload: any) => {
    logger.debug(`[NotificationListener] Job ${payload.jobId} submitted for approval -- notifying admins`)
    // AdminRoutes only has a single "job-moderation" list route -- no
    // per-job detail page exists to deep-link into.
    await notifyActiveAdmins({
      title: "New Job Pending Approval",
      message: `${payload.companyName || "A recruiter"} submitted "${payload.jobTitle}" for review.`,
      category: "Moderation",
      actionUrl: "/admin/job-moderation",
      dedupeKeyPrefix: `job-submitted:${payload.jobId}`,
    })
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

  // 17. Admin Management module notifications (Part 4 of the Admin
  // Management spec: "Notifications on account created / roles changed /
  // permissions updated / account suspended / account activated"). Audit
  // logging for these is already written directly by admin.service.ts /
  // rbac.service.ts at the point of action -- these subscriptions exist
  // purely to surface an in-app notification to the affected admin.
  EventBus.subscribe("AdminAccountCreated", async (payload: any) => {
    try {
      await createAndEmitNotification({
        recipientId: payload.userId,
        title: "Your Admin Account Was Created",
        message: `An administrator account was created for you with the role${payload.roleNames.length > 1 ? "s" : ""}: ${payload.roleNames.join(", ")}.`,
        category: "Admin",
        actionUrl: "/admin/dashboard",
        dedupeKey: `admin-account-created:${payload.userId}`,
      })
    } catch (err: any) {
      logger.error(`[NotificationListener] AdminAccountCreated trigger failed: ${err.message}`)
    }
  })

  // Fired both by rbac.service.ts's assignRolesToUser (multi-role
  // assign/update) and admin.service.ts's removeAdminRole (single-role
  // revoke) -- both publish the same {userId, roleNames, previousRoleNames}
  // shape, so one subscription covers "Roles changed" and "Permissions
  // updated" (a role change always implies the user's effective permission
  // set changed too, via PermissionCacheManager.invalidateUser).
  EventBus.subscribe("RoleAssigned", async (payload: any) => {
    try {
      if (!payload.userId || !payload.roleNames) {
        // The older assignPermissionsToRole publisher (rbac.service.ts) also
        // reuses this event name with a completely different {roleId,
        // permissionIds} shape -- nothing user-facing to notify there.
        return
      }
      await createAndEmitNotification({
        recipientId: payload.userId,
        title: "Your Roles Were Updated",
        message: payload.roleNames.length > 0
          ? `Your account roles are now: ${payload.roleNames.join(", ")}.`
          : "Your account roles have been updated.",
        category: "Admin",
        actionUrl: "/admin/dashboard",
      })
    } catch (err: any) {
      logger.error(`[NotificationListener] RoleAssigned trigger failed: ${err.message}`)
    }
  })

  // 18. Support Ticket notifications ("Report Platform Issue" -- reachable
  // from Candidate/Recruiter/Admin-tier portals alike, see support.service.ts).
  // New tickets fan out to every active Support Executive (nobody is
  // auto-assigned at creation time -- see support.service.ts's "auto-claim on
  // first status change" comment); Admin/Super Admin/Moderator get the same
  // realtime signal so they can watch the queue too, matching their
  // read-only "see the progress" requirement.
  EventBus.subscribe("SupportTicketCreated", async (payload: any) => {
    try {
      const recipients = await prisma.user.findMany({
        where: {
          status: "Active",
          roles: { some: { role: { name: { in: ["Support Executive", "Admin", "Super Admin", "Moderator"] } } } },
        },
        select: { id: true },
      })

      await Promise.all(
        recipients.map((r) =>
          createAndEmitNotification({
            recipientId: r.id,
            title: "New Support Ticket Filed",
            message: `${payload.submitterName} (${payload.submitterRole}) filed a ticket: "${payload.subject}".`,
            category: "Support",
            actionUrl: "/admin/support-tickets",
            dedupeKey: `support-ticket-created:${payload.ticketId}:${r.id}`,
          })
        )
      )
    } catch (err: any) {
      logger.error(`[NotificationListener] SupportTicketCreated trigger failed: ${err.message}`)
    }
  })

  // Status changes (including resolution) notify the original submitter --
  // closes the loop so a Candidate/Recruiter/Admin who filed a ticket
  // actually finds out what happened to it, instead of having to keep
  // re-checking "My Tickets".
  EventBus.subscribe("SupportTicketStatusChanged", async (payload: any) => {
    try {
      const titleByStatus: Record<string, string> = {
        Open: "Your Ticket Was Reopened",
        InProgress: "Your Ticket Is Being Worked On",
        Resolved: "Your Ticket Was Resolved",
      }
      const messageByStatus: Record<string, string> = {
        Open: `Your ticket "${payload.subject}" is open again.`,
        InProgress: `Support has started working on your ticket "${payload.subject}".`,
        Resolved: `Your ticket "${payload.subject}" has been resolved.${payload.resolutionNotes ? ` Note: ${payload.resolutionNotes}` : ""}`,
      }

      await createAndEmitNotification({
        recipientId: payload.submitterId,
        title: titleByStatus[payload.status] || "Your Ticket Was Updated",
        message: messageByStatus[payload.status] || `Your ticket "${payload.subject}" status changed to ${payload.status}.`,
        category: "Support",
        actionUrl: submitterPortalHelpUrl(payload.submitterRole),
      })
    } catch (err: any) {
      logger.error(`[NotificationListener] SupportTicketStatusChanged trigger failed: ${err.message}`)
    }
  })

  // A reply on either side notifies whoever didn't just post: a submitter's
  // reply notifies the assignee (or, if still unassigned, every active
  // Support Executive/admin-tier user -- same fan-out as ticket creation); a
  // staff reply notifies the submitter.
  EventBus.subscribe("SupportTicketCommentAdded", async (payload: any) => {
    try {
      if (payload.isFromSubmitter) {
        if (payload.assignedToId) {
          await createAndEmitNotification({
            recipientId: payload.assignedToId,
            title: "New Reply on a Support Ticket",
            message: `${payload.authorName} replied on "${payload.subject}".`,
            category: "Support",
            actionUrl: "/admin/support-tickets",
          })
        } else {
          const recipients = await prisma.user.findMany({
            where: {
              status: "Active",
              roles: { some: { role: { name: { in: ["Support Executive", "Admin", "Super Admin", "Moderator"] } } } },
            },
            select: { id: true },
          })
          await Promise.all(
            recipients.map((r) =>
              createAndEmitNotification({
                recipientId: r.id,
                title: "New Reply on a Support Ticket",
                message: `${payload.authorName} replied on "${payload.subject}".`,
                category: "Support",
                actionUrl: "/admin/support-tickets",
              })
            )
          )
        }
      } else {
        await createAndEmitNotification({
          recipientId: payload.submitterId,
          title: "New Reply on Your Ticket",
          message: `${payload.authorName} replied on your ticket "${payload.subject}".`,
          category: "Support",
          actionUrl: submitterPortalHelpUrl(payload.submitterRole),
        })
      }
    } catch (err: any) {
      logger.error(`[NotificationListener] SupportTicketCommentAdded trigger failed: ${err.message}`)
    }
  })

  EventBus.subscribe("AdminAccountStatusChanged", async (payload: any) => {
    try {
      const isActive = payload.status === "Active"
      await createAndEmitNotification({
        recipientId: payload.userId,
        title: isActive ? "Account Activated" : "Account Suspended",
        message: isActive
          ? "Your administrator account has been reactivated. You can now log in."
          : `Your administrator account has been set to "${payload.status}" and you have been logged out of all active sessions.`,
        category: "Admin",
        actionUrl: "/admin/dashboard",
      })
    } catch (err: any) {
      logger.error(`[NotificationListener] AdminAccountStatusChanged trigger failed: ${err.message}`)
    }
  })
}

// The three portals don't share a route tree, so a support-ticket deep link
// back to the submitter has to be picked per submitter role (snapshotted on
// the ticket at creation time -- see support.service.ts). Shared by both
// SupportTicketStatusChanged and SupportTicketCommentAdded below.
function submitterPortalHelpUrl(submitterRole?: string): string {
  const actionUrlByRole: Record<string, string> = {
    Candidate: "/candidate/help",
    Recruiter: "/recruiter/help",
  }
  return actionUrlByRole[submitterRole || ""] || "/admin/help-support"
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

// Matches candidates on either: (1) skill -- exact id-based join, since
// Job.skills and CandidateProfile.skills share the same normalized `Skill`
// entity; or (2) location -- best-effort substring match, see
// `locationsMatch`. Results are deduplicated (matching both counts once).
// Only "Active" users are considered, so a suspended candidate never gets
// notified about a job they can't apply to.
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
