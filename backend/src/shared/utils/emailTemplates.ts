export interface WelcomeParams {
  email: string
  verificationLink: string
}

export interface InvitationParams {
  email: string
  invitationLink: string
  roleName: string
}

export interface VerificationParams {
  companyName: string
  status: string
  notes?: string
}

export interface JobModerationParams {
  jobTitle: string
  status: "approved" | "rejected"
  notes?: string
}

export interface DigestParams {
  recipientName: string
  jobsCount: number
  jobs: Array<{ title: string; companyName: string; location: string }>
}

export interface ResetParams {
  email: string
  resetLink: string
}

export const EmailTemplates = {
  welcome: (params: WelcomeParams): string => `
    <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
      <h2>Welcome to JobsForWomen.info!</h2>
      <p>Thank you for registering. Please verify your email address to activate your account:</p>
      <p style="margin: 20px 0;">
        <a href="${params.verificationLink}" style="background-color: #d53f8c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
      </p>
      <p>This verification link will expire in 24 hours.</p>
    </div>
  `,

  invitation: (params: InvitationParams): string => `
    <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
      <h2>JobsForWomen Staff Onboarding</h2>
      <p>You have been invited to join the JobsForWomen administration team as a <strong>${params.roleName}</strong>.</p>
      <p>Click the link below to accept the invitation and complete your profile setup:</p>
      <p style="margin: 20px 0;">
        <a href="${params.invitationLink}" style="background-color: #4a5568; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
      </p>
    </div>
  `,

  companyVerification: (params: VerificationParams): string => `
    <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
      <h2>Company Verification Update</h2>
      <p>Your company profile for <strong>${params.companyName}</strong> status has been updated to: <strong>${params.status}</strong>.</p>
      ${params.notes ? `<p><strong>Feedback:</strong> ${params.notes}</p>` : ""}
    </div>
  `,

  jobModeration: (params: JobModerationParams): string => `
    <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
      <h2>Job Moderation Notification</h2>
      <p>Your job posting for <strong>${params.jobTitle}</strong> has been: <strong>${params.status.toUpperCase()}</strong>.</p>
      ${params.notes ? `<p><strong>Moderator Notes:</strong> ${params.notes}</p>` : ""}
    </div>
  `,

  passwordReset: (params: ResetParams): string => `
    <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your JobsForWomen account.</p>
      <p>Click the link below to set a new password:</p>
      <p style="margin: 20px 0;">
        <a href="${params.resetLink}" style="background-color: #e53e3e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
      </p>
    </div>
  `,

  dailyDigest: (params: DigestParams): string => `
    <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
      <h2>Daily Jobs Digest</h2>
      <p>Hello ${params.recipientName}, here are today's matching job recommendations (${params.jobsCount}):</p>
      <ul>
        ${params.jobs.map(j => `<li><strong>${j.title}</strong> at ${j.companyName} (${j.location})</li>`).join("")}
      </ul>
    </div>
  `,

  weeklyDigest: (params: DigestParams): string => `
    <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
      <h2>Weekly Highlights Digest</h2>
      <p>Hello ${params.recipientName}, here are the weekly trending recommendations matching your skills:</p>
      <ul>
        ${params.jobs.map(j => `<li><strong>${j.title}</strong> at ${j.companyName} (${j.location})</li>`).join("")}
      </ul>
    </div>
  `,
}

/**
 * Helper to strip HTML tags to form plain-text fallback contents.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<style([\s\S]*?)<\/style>/gi, "")
    .replace(/<script([\s\S]*?)<\/script>/gi, "")
    .replace(/<\/div>/ig, "\n")
    .replace(/<\/li>/ig, "\n")
    .replace(/<\/p>/ig, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n\s*\n/g, "\n\n")
    .trim()
}
