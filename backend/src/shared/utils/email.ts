import { SESv2Client, SendEmailCommand, GetAccountCommand } from "@aws-sdk/client-sesv2"
import env from "../config/env"
import { logger } from "./logger"
import { EmailTemplates, stripHtml, adminRoleLabel } from "./emailTemplates"

// AWS SES v2 transport (migrated off Resend).
//
// SES identities are REGIONAL: the sending domain must be verified in
// AWS_SES_REGION specifically. A domain verified in ap-south-1 does not exist
// in us-east-1, and sending from the wrong region fails with MessageRejected.
//
// Credentials resolve through the SDK's default provider chain when
// AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY are unset, so the same code works
// with an ECS/EC2 task role, a local AWS profile, or explicit keys on Render.
const ses = new SESv2Client({
  region: env.AWS_SES_REGION,
  ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
})

// Observability metrics for email dispatches. `rejected` counts permanent
// rejections (unverified recipient in sandbox, suppressed address) separately
// from `failed`, because they are not retryable and should not be read as
// transient infrastructure errors.
export const emailMetrics = {
  sent: 0,
  failed: 0,
  bounced: 0,
  complaints: 0,
  rejected: 0,
}

/**
 * SES errors that are PERMANENT -- retrying wastes the daily sending quota and
 * will never succeed. The most common in a sandbox account is MessageRejected
 * ("Email address is not verified"), which fires for every recipient that
 * hasn't been individually verified while production access is pending.
 */
const PERMANENT_SES_ERRORS = new Set([
  "MessageRejected",
  "MailFromDomainNotVerifiedException",
  "AccountSuspendedException",
  // Misconfiguration (bad configuration-set name, malformed address). Retrying
  // cannot fix these either, and each retry costs a send from the daily quota.
  "NotFoundException",
  "BadRequestException",
])

export class PermanentEmailError extends Error {
  readonly permanent = true
  constructor(message: string, readonly awsName?: string) {
    super(message)
    this.name = "PermanentEmailError"
  }
}

function maskEmail(address: string): string {
  // A well-formed address has exactly one '@'. The greedy regex below binds
  // "domain" to whatever follows the LAST '@' in the string -- for a normal
  // address that's harmless (there's only one), but for a malformed address
  // with an extra/duplicate '@' it silently masks around the wrong split
  // point and prints something that LOOKS like a valid address in the logs
  // (e.g. "sara@old@gmail.com" -> "s****************@gmail.com"), hiding
  // exactly the anomaly a reader would need to see to diagnose an SES
  // "Missing final '@domain'" rejection. Flag the malformed case outright
  // instead of masking it into a false-looking-fine string.
  const atCount = (address.match(/@/g) || []).length
  if (atCount !== 1) {
    return `[malformed-email:${atCount}@chars,${address.length}total]`
  }
  return address.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => first + "*".repeat(middle.length) + domain)
}

/**
 * Startup verification check for the SES transport. Calls GetAccount, which
 * confirms the credentials and region are usable and reports whether the
 * account is still in the sandbox -- without sending a real email or consuming
 * any sending quota.
 */
// GetAccount has its own low API quota (roughly 1 request/second). The admin
// System Health page calls verifyEmailTransport() on every load, so an
// operator leaving that dashboard open -- or any polling of it -- would
// otherwise throttle the call and report email as DOWN when it is fine.
// A short cache keeps the check meaningful without hammering the API.
const TRANSPORT_CHECK_TTL_MS = 60_000
let transportCheck: { at: number; ok: boolean } | null = null

/**
 * Clears the cached transport-check result. Exported for tests, which assert
 * on both the success and failure paths within the same 60s window and would
 * otherwise get a stale cached answer for the second assertion.
 */
export function resetTransportCheckCache(): void {
  transportCheck = null
}

export async function verifyEmailTransport(): Promise<boolean> {
  if (!env.SES_FROM) {
    logger.warn("[EmailService] Configuration check failed: SES_FROM is not set.")
    return false
  }
  if (transportCheck && Date.now() - transportCheck.at < TRANSPORT_CHECK_TTL_MS) {
    return transportCheck.ok
  }
  try {
    const account = await ses.send(new GetAccountCommand({}))
    const production = account.ProductionAccessEnabled === true
    const quota = account.SendQuota
    logger.info(
      `[EmailService] SES reachable in ${env.AWS_SES_REGION}. ` +
        `Production access: ${production ? "GRANTED" : "SANDBOX"}. ` +
        `Quota: ${quota?.Max24HourSend ?? "?"}/24h at ${quota?.MaxSendRate ?? "?"}/sec. ` +
        `Sent in last 24h: ${quota?.SentLast24Hours ?? "?"}.`
    )
    if (!production) {
      logger.warn(
        "[EmailService] SES is in SANDBOX mode -- delivery is restricted to individually verified recipient addresses. " +
          "Mail to anyone else will be rejected with MessageRejected."
      )
    }
    transportCheck = { at: Date.now(), ok: true }
    return true
  } catch (err: any) {
    logger.error(`[EmailService] SES configuration check failed: ${err.name} - ${err.message}`)
    transportCheck = { at: Date.now(), ok: false }
    return false
  }
}

/**
 * Base URL for links embedded in outgoing email. Previously this sniffed the
 * sender address for the string "resend" to decide between localhost and
 * production -- meaningless now that mail is sent through SES, and fragile
 * even then. Configure FRONTEND_URL (or CLIENT_URL) explicitly instead; the
 * production domain is only a last-resort fallback.
 */
function frontendBaseUrl(): string {
  return env.FRONTEND_URL || env.CLIENT_URL || "https://jobsforwomen.info"
}

export class EmailService {
  /**
   * Sends an email with an HTML body and an auto-generated plain-text
   * alternative. Throws on failure so the BullMQ worker records the job as
   * failed; permanent rejections throw PermanentEmailError so the worker can
   * skip pointless retries.
   */
  static async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    if (process.env.NODE_ENV === "test") {
      emailMetrics.sent++
      logger.info(`[EmailService] Sent email successfully to: ${to} | Message ID: msg-123`)
      return true
    }
    try {
      const text = stripHtml(html)

      const result = await ses.send(
        new SendEmailCommand({
          FromEmailAddress: env.SES_FROM,
          Destination: { ToAddresses: [to] },
          // A Configuration Set is what makes SES publish bounce/complaint/
          // delivery events to SNS. Omitted entirely when unset -- passing an
          // empty string would be rejected as an unknown configuration set.
          ...(env.SES_CONFIGURATION_SET ? { ConfigurationSetName: env.SES_CONFIGURATION_SET } : {}),
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: "UTF-8" },
              Body: {
                Html: { Data: html, Charset: "UTF-8" },
                Text: { Data: text, Charset: "UTF-8" },
              },
            },
          },
        })
      )

      if (!result.MessageId) {
        const noIdError = new Error("SES did not return a MessageId")
        noIdError.name = "SesMissingIdError"
        throw noIdError
      }

      emailMetrics.sent++
      logger.info(`[EmailService] SES accepted email id=${result.MessageId} recipient=${maskEmail(to)}`)
      return true
    } catch (err: any) {
      const awsName: string | undefined = err?.name
      const httpStatus = err?.$metadata?.httpStatusCode

      // Permanent: retrying burns the daily quota and can never succeed.
      if (awsName && PERMANENT_SES_ERRORS.has(awsName)) {
        emailMetrics.rejected++
        const isSandboxRejection = /not verified/i.test(err?.message || "")
        logger.error(
          `[EmailService] SES permanently rejected mail to ${maskEmail(to)}: ${awsName} - ${err.message}` +
            (isSandboxRejection
              ? " | This is the expected sandbox restriction: verify the recipient in the SES console, or wait for production access."
              : "")
        )
        throw new PermanentEmailError(err.message || awsName, awsName)
      }

      // Transient: throttling, timeouts, 5xx. Worth the retry/backoff.
      emailMetrics.failed++
      if (awsName === "TooManyRequestsException" || awsName === "ThrottlingException") {
        logger.error(
          `[EmailService] SES throttled the send to ${maskEmail(to)} (${awsName}). ` +
            `The client-side limiter is set to ${env.SES_MAX_SEND_RATE_PER_SEC}/sec -- lower it if this recurs.`
        )
      } else {
        logger.error(
          `[EmailService] Failed to send email to ${maskEmail(to)}: ${err.message} | ` +
            `Diagnostic: ${JSON.stringify({ name: awsName, httpStatus, region: env.AWS_SES_REGION })}`
        )
      }
      throw err
    }
  }

  static async sendWelcomeEmail(to: string, verificationToken: string): Promise<boolean> {
    const baseUrl = frontendBaseUrl()
    // Root-cause fix: the frontend only registers this page at /auth/verify-email
    // (see frontend/src/routes/AuthRoutes.tsx, mounted under /auth/* in AppRouter.tsx).
    // The previous bare "/verify-email" link matched no route, fell through to the
    // catch-all redirect, and silently discarded the token.
    const link = `${baseUrl}/auth/verify-email?token=${verificationToken}`
    const html = EmailTemplates.welcome({ email: to, verificationLink: link })
    return this.sendMail(to, "Welcome to JobsForWomen - Verify Email", html)
  }

  static async sendEmployeeInvitation(to: string, invitationToken: string, roleName: string): Promise<boolean> {
    const baseUrl = frontendBaseUrl()
    // Same class of bug as sendPasswordResetEmail/sendWelcomeEmail above: the
    // frontend page for this lives at /auth/accept-invitation
    // (AuthRoutes.tsx, mounted under /auth/* in AppRouter.tsx) -- and until
    // now that page didn't exist at all, so this link had nowhere valid to
    // go regardless of the prefix.
    const link = `${baseUrl}/auth/accept-invitation?token=${invitationToken}`
    const html = EmailTemplates.invitation({
      email: to,
      invitationLink: link,
      roleName,
      loginLink: `${baseUrl}/auth/login`,
    })
    return this.sendMail(to, "JobsForWomen Staff Invitation", html)
  }

  static async sendAdminAccountCreatedEmail(
    to: string,
    fullName: string,
    password: string,
    roleNames: string[]
  ): Promise<boolean> {
    const baseUrl = frontendBaseUrl()
    const html = EmailTemplates.adminAccountCreated({
      fullName,
      email: to,
      password,
      roleNames,
      loginLink: `${baseUrl}/auth/login`,
    })
    // Kept in sync with adminAccountCreated's in-body heading -- both must
    // use the same role label, or the inbox subject line and the opened
    // email disagree about which of the four admin-tier roles this account
    // actually has.
    const roleLabel = adminRoleLabel(roleNames)
    return this.sendMail(to, `Your JobsForWomen ${roleLabel} Account`, html)
  }

  // Candidate/recruiter account moderation -- admin.service.ts's
  // updateUserStatus previously only notified admin-tier targets (via an
  // in-app notification, no email); ordinary candidates/recruiters got no
  // signal at all that their account had been suspended or blocked.
  static async sendAccountStatusChangedEmail(
    to: string,
    fullName: string,
    status: "Suspended" | "Blocked"
  ): Promise<boolean> {
    const supportEmail = env.SUPPORT_EMAIL || env.SES_FROM
    const html = EmailTemplates.accountStatusChanged({ fullName, status, supportEmail })
    return this.sendMail(to, `Your JobsForWomen Account Has Been ${status}`, html)
  }

  // Candidate/recruiter account reactivation (Suspended/Blocked -> Active)
  // -- admin.service.ts's updateUserStatus previously fired no email on
  // reactivation at all, only on suspend/block, so a restored account had no
  // way to know they could log back in again except by trying.
  static async sendAccountReactivatedEmail(to: string, fullName: string): Promise<boolean> {
    const baseUrl = frontendBaseUrl()
    const supportEmail = env.SUPPORT_EMAIL || env.SES_FROM
    const html = EmailTemplates.accountReactivated({ fullName, loginLink: `${baseUrl}/auth/login`, supportEmail })
    return this.sendMail(to, "Your JobsForWomen Account Has Been Reactivated", html)
  }

  // Candidate/recruiter account deletion -- admin.service.ts's deleteUser
  // previously sent no email at all; the account just vanished with only an
  // audit log entry as a record it ever existed.
  static async sendAccountDeletedEmail(to: string, fullName: string): Promise<boolean> {
    const supportEmail = env.SUPPORT_EMAIL || env.SES_FROM
    const html = EmailTemplates.accountDeleted({ fullName, supportEmail })
    return this.sendMail(to, "Your JobsForWomen Account Has Been Deleted", html)
  }

  static async sendCompanyVerificationEmail(
    to: string,
    companyName: string,
    status: string,
    notes?: string,
    actionLink?: string,
    actionLabel?: string
  ): Promise<boolean> {
    const html = EmailTemplates.companyVerification({ companyName, status, notes, actionLink, actionLabel })
    return this.sendMail(to, `Company Verification Status Update: ${status}`, html)
  }

  static async sendPerkVerificationEmail(
    to: string,
    companyName: string,
    perkName: string,
    status: string,
    comment?: string,
    actionLink?: string
  ): Promise<boolean> {
    const html = EmailTemplates.perkVerification({ companyName, perkName, status, comment, actionLink })
    return this.sendMail(to, `Perk Verification Update: ${perkName} (${status})`, html)
  }

  static async sendJobModerationEmail(to: string, jobTitle: string, status: "approved" | "rejected", notes?: string): Promise<boolean> {
    const html = EmailTemplates.jobModeration({ jobTitle, status, notes })
    return this.sendMail(to, `Job Moderation Update: ${jobTitle} (${status})`, html)
  }

  static async sendPasswordResetEmail(to: string, resetToken: string): Promise<boolean> {
    const baseUrl = frontendBaseUrl()
    // Root-cause fix (same bug already fixed above for sendWelcomeEmail's
    // verify-email link, but never applied here): the frontend only
    // registers this page at /auth/reset-password (AuthRoutes.tsx, mounted
    // under /auth/* in AppRouter.tsx). The previous bare "/reset-password"
    // link matched no route, fell through to the catch-all
    // `<Route path="*" element={<Navigate to="/dashboard" replace />} />`,
    // and since the recruiter/candidate clicking the email isn't logged in,
    // DashboardRedirect immediately bounced them to /auth/login with no
    // reset form ever shown and the token silently discarded.
    const link = `${baseUrl}/auth/reset-password?token=${resetToken}`
    const html = EmailTemplates.passwordReset({ email: to, resetLink: link })
    return this.sendMail(to, "JobsForWomen Password Reset Request", html)
  }

  static async sendDailyDigest(to: string, recipientName: string, jobs: Array<{ title: string; companyName: string; location: string }>): Promise<boolean> {
    const html = EmailTemplates.dailyDigest({ recipientName, jobsCount: jobs.length, jobs })
    return this.sendMail(to, "JobsForWomen Daily Jobs Recommendations", html)
  }

  static async sendWeeklyDigest(to: string, recipientName: string, jobs: Array<{ title: string; companyName: string; location: string }>): Promise<boolean> {
    const html = EmailTemplates.weeklyDigest({ recipientName, jobsCount: jobs.length, jobs })
    return this.sendMail(to, "JobsForWomen Weekly Highlights Digest", html)
  }

  static async sendInterviewScheduledEmail(
    to: string,
    recipientName: string,
    jobTitle: string,
    companyName: string,
    scheduledAt: string,
    location?: string,
    // Issue 1: Timezone/Mode/Notes are optional trailing params (rather than
    // an options object) to avoid touching every existing call site of this
    // method -- only queue.ts's "sendInterviewScheduled" job passes them.
    timezone?: string,
    mode?: string,
    notes?: string
  ): Promise<boolean> {
    const loginLink = `${frontendBaseUrl()}/auth/login`
    const html = EmailTemplates.interviewScheduled({ recipientName, jobTitle, companyName, scheduledAt, location, timezone, mode, notes, loginLink })
    return this.sendMail(to, `Interview Scheduled: ${jobTitle} at ${companyName}`, html)
  }

  static async sendApplicationStatusUpdateEmail(
    to: string,
    recipientName: string,
    jobTitle: string,
    companyName: string,
    statusHeading: string,
    statusMessage: string,
    notes?: string
  ): Promise<boolean> {
    const loginLink = `${frontendBaseUrl()}/auth/login`
    const html = EmailTemplates.applicationStatusUpdate({ recipientName, jobTitle, companyName, statusHeading, statusMessage, notes, loginLink })
    return this.sendMail(to, `${statusHeading}: ${jobTitle} at ${companyName}`, html)
  }

  static async sendOfferReleasedEmail(
    to: string,
    recipientName: string,
    jobTitle: string,
    companyName: string,
    offerDetails: string
  ): Promise<boolean> {
    const loginLink = `${frontendBaseUrl()}/auth/login`
    const html = EmailTemplates.offerReleased({ recipientName, jobTitle, companyName, offerDetails, loginLink })
    return this.sendMail(to, `You've Received an Offer: ${jobTitle} at ${companyName}`, html)
  }
}

export default EmailService
