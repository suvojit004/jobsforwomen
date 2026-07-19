import { Resend } from "resend"
import env from "../config/env"
import { logger } from "./logger"
import { EmailTemplates, stripHtml } from "./emailTemplates"

const apiKey = env.RESEND_API_KEY || env.SMTP_PASS

if (!apiKey) {
  throw new Error("Resend API key is not configured")
}

const resend = new Resend(apiKey)

// Observability metrics for email dispatches
export const emailMetrics = {
  sent: 0,
  failed: 0,
  bounced: 0,
}

/**
 * Startup verification check that validates required configuration parameters
 * for the Resend HTTPS email transport. Does NOT send a real email.
 */
export async function verifyEmailTransport(): Promise<boolean> {
  const checkKey = env.RESEND_API_KEY || env.SMTP_PASS
  const sender = env.SMTP_FROM
  if (!checkKey || !sender) {
    logger.warn(`[EmailService] Configuration check failed: apiKey configured=${Boolean(checkKey)}, sender configured=${Boolean(sender)}`)
    return false
  }
  return true
}

export class EmailService {
  /**
   * Sends email containing HTML and auto-generated Plain-text fallback.
   */
  static async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    if (process.env.NODE_ENV === "test") {
      emailMetrics.sent++
      logger.info(`[EmailService] Sent email successfully to: ${to} | Message ID: msg-123`)
      return true
    }
    try {
      const text = stripHtml(html)

      // AUDIT: Idempotency Key Support
      // The installed Resend SDK version supports idempotency keys as an option in the second parameter:
      // resend.emails.send({...}, { idempotencyKey: "..." })
      // However, the current EmailService public interface does not receive a stable job/event identity
      // (such as a unique BullMQ job ID or event UUID) from its callers. Generating a random key on
      // each retry would defeat the purpose of idempotency, and using sensitive tokens like JWTs, 
      // verification/reset tokens, or passwords is prohibited for security.
      // Therefore, we document this limitation here rather than redesigning the entire queue architecture.

      const { data, error } = await resend.emails.send({
        from: env.SMTP_FROM,
        to: [to],
        subject,
        html,
        text,
      })

      if (error) {
        const statusCode = (error as any).statusCode || (error as any).status || 500
        if (statusCode === 403) {
          logger.error(`[EmailService] Resend provider rejected email status=403`)
        } else {
          logger.error(`[EmailService] Failed to send email to ${to}: ${error.name} - ${error.message} (status: ${statusCode})`)
        }
        const detailedError = new Error(error.message || "Resend API Error")
        detailedError.name = error.name || "ResendError"
        ;(detailedError as any).code = (error as any).code
        ;(detailedError as any).status = statusCode
        throw detailedError
      }

      if (!data?.id) {
        const noIdError = new Error("Resend did not return a message ID")
        noIdError.name = "ResendMissingIdError"
        throw noIdError
      }

      emailMetrics.sent++
      const maskedEmail = to.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => {
        return first + "*".repeat(middle.length) + domain
      })
      logger.info(`[EmailService] Resend accepted email id=${data.id} recipient=${maskedEmail}`)
      return true
    } catch (err: any) {
      emailMetrics.failed++
      const meta: Record<string, any> = {
        name: err.name,
        message: err.message,
        code: err.code,
        status: err.status,
      }
      if (err.command) meta.command = err.command
      if (err.hostname || err.host) meta.host = err.hostname || err.host
      if (err.port) meta.port = err.port

      logger.error(`[EmailService] Failed to send email to ${to}: ${err.message} | Diagnostic: ${JSON.stringify(meta)}`)
      throw err
    }
  }

  static async sendWelcomeEmail(to: string, verificationToken: string): Promise<boolean> {
    const baseUrl = process.env.FRONTEND_URL || env.CLIENT_URL || (env.SMTP_FROM.includes("resend") ? "http://localhost:3000" : "https://jobsforwomen.info")
    // Root-cause fix: the frontend only registers this page at /auth/verify-email
    // (see frontend/src/routes/AuthRoutes.tsx, mounted under /auth/* in AppRouter.tsx).
    // The previous bare "/verify-email" link matched no route, fell through to the
    // catch-all redirect, and silently discarded the token.
    const link = `${baseUrl}/auth/verify-email?token=${verificationToken}`
    const html = EmailTemplates.welcome({ email: to, verificationLink: link })
    return this.sendMail(to, "Welcome to JobsForWomen - Verify Email", html)
  }

  static async sendEmployeeInvitation(to: string, invitationToken: string, roleName: string): Promise<boolean> {
    const baseUrl = process.env.FRONTEND_URL || env.CLIENT_URL || (env.SMTP_FROM.includes("resend") ? "http://localhost:3000" : "https://jobsforwomen.info")
    const link = `${baseUrl}/accept-invitation?token=${invitationToken}`
    const html = EmailTemplates.invitation({ email: to, invitationLink: link, roleName })
    return this.sendMail(to, "JobsForWomen Staff Invitation", html)
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
    const baseUrl = process.env.FRONTEND_URL || env.CLIENT_URL || (env.SMTP_FROM.includes("resend") ? "http://localhost:3000" : "https://jobsforwomen.info")
    const link = `${baseUrl}/reset-password?token=${resetToken}`
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
    location?: string
  ): Promise<boolean> {
    const html = EmailTemplates.interviewScheduled({ recipientName, jobTitle, companyName, scheduledAt, location })
    return this.sendMail(to, `Interview Scheduled: ${jobTitle} at ${companyName}`, html)
  }

  static async sendOfferReleasedEmail(
    to: string,
    recipientName: string,
    jobTitle: string,
    companyName: string,
    offerDetails: string
  ): Promise<boolean> {
    const html = EmailTemplates.offerReleased({ recipientName, jobTitle, companyName, offerDetails })
    return this.sendMail(to, `You've Received an Offer: ${jobTitle} at ${companyName}`, html)
  }
}

export default EmailService
