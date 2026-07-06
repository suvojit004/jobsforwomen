// @ts-ignore
import nodemailer from "nodemailer"
import env from "../config/env"
import { logger } from "./logger"
import { EmailTemplates, stripHtml } from "./emailTemplates"

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
})

// Observability metrics for email dispatches
export const emailMetrics = {
  sent: 0,
  failed: 0,
  bounced: 0,
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
      const info = await transporter.sendMail({
        from: env.SMTP_FROM,
        to,
        subject,
        html,
        text,
      })
      emailMetrics.sent++
      logger.info(`[EmailService] Sent email successfully to: ${to} | Message ID: ${info.messageId}`)
      return true
    } catch (err: any) {
      emailMetrics.failed++
      logger.error(`[EmailService] Failed to send email to ${to}: ${err.message}`)
      return false
    }
  }

  static async sendWelcomeEmail(to: string, verificationToken: string): Promise<boolean> {
    const link = `${env.SMTP_FROM.includes("resend") ? "http://localhost:3000" : "https://jobsforwomen.info"}/verify-email?token=${verificationToken}`
    const html = EmailTemplates.welcome({ email: to, verificationLink: link })
    return this.sendMail(to, "Welcome to JobsForWomen - Verify Email", html)
  }

  static async sendEmployeeInvitation(to: string, invitationToken: string, roleName: string): Promise<boolean> {
    const link = `${env.SMTP_FROM.includes("resend") ? "http://localhost:3000" : "https://jobsforwomen.info"}/accept-invitation?token=${invitationToken}`
    const html = EmailTemplates.invitation({ email: to, invitationLink: link, roleName })
    return this.sendMail(to, "JobsForWomen Staff Invitation", html)
  }

  static async sendCompanyVerificationEmail(to: string, companyName: string, status: string, notes?: string): Promise<boolean> {
    const html = EmailTemplates.companyVerification({ companyName, status, notes })
    return this.sendMail(to, `Company Verification Status Update: ${status}`, html)
  }

  static async sendJobModerationEmail(to: string, jobTitle: string, status: "approved" | "rejected", notes?: string): Promise<boolean> {
    const html = EmailTemplates.jobModeration({ jobTitle, status, notes })
    return this.sendMail(to, `Job Moderation Update: ${jobTitle} (${status})`, html)
  }

  static async sendPasswordResetEmail(to: string, resetToken: string): Promise<boolean> {
    const link = `${env.SMTP_FROM.includes("resend") ? "http://localhost:3000" : "https://jobsforwomen.info"}/reset-password?token=${resetToken}`
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
}

export default EmailService
