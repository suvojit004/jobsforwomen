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
}) {
  const notification = await prisma.notification.create({ data })
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
      actionUrl: `/recruiter/applications/${payload.applicationId}`,
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
      actionUrl: `/recruiter/applications/${payload.applicationId}`,
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
      actionUrl: `/candidate/applications/${payload.applicationId}`,
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
      actionUrl: `/candidate/applications/${payload.applicationId}`,
    })

    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "RECRUITER",
      action: "RELEASE_OFFER",
      entity: "Application",
      entityId: payload.applicationId,
    })
  })

  // 14. Admin Job Approved Event
  EventBus.subscribe("JobApproved", (payload: any) => {
    EventBus.publish("AuditCreated", {
      ...payload.context,
      category: "ADMIN",
      action: "APPROVE_JOB",
      entity: "Job",
      entityId: payload.jobId,
    })
  })
}

export default initNotificationListener
