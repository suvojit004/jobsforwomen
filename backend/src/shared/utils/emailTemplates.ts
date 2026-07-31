export interface WelcomeParams {
  email: string
  verificationLink: string
}

export interface InvitationParams {
  email: string
  invitationLink: string
  roleName: string
  // Admin can invite an email that already has an active account (see
  // admin.service.ts's inviteEmployee, which -- unlike the recruiter
  // teammate-invite path -- has no existingUser guard). For that case the
  // recipient doesn't need to "accept" anything, just sign back in, so the
  // template offers both paths instead of forcing the Accept Invitation flow.
  loginLink: string
}

// Admin Management can grant any of the four admin-tier roles (Admin, Super
// Admin, Moderator, Support Executive) when creating an account. When exactly
// one role is assigned, the email should name it specifically ("Your
// Moderator Account Is Ready") rather than always saying "Administrator" --
// previously the subject line, heading, and preheader all hardcoded
// "Administrator" regardless of which role(s) were actually granted, so a
// Moderator or Support Executive account received an email calling it an
// Administrator account. Multiple simultaneous roles fall back to the
// generic label since there's no single accurate word for "Moderator +
// Support Executive" -- the email body already lists every granted role by
// name in that case.
export function adminRoleLabel(roleNames: string[]): string {
  return roleNames.length === 1 ? roleNames[0] : "Administrator"
}

export interface AdminAccountCreatedParams {
  fullName: string
  email: string
  // Plaintext, deliberately: this account is activated immediately by a
  // Super Admin (admin.service.ts's createAdmin) with no "set your own
  // password" step, so this email is the only place the recipient can learn
  // their password. See createAdmin's comment on EventBus.publish for the
  // handling tradeoff this implies.
  password: string
  roleNames: string[]
  loginLink: string
}

// Sent to a candidate/recruiter (not an admin-tier account -- that has its
// own separate AdminAccountStatusChanged in-app notification, no email) when
// an admin moves their status to Suspended or Blocked via admin.service.ts's
// updateUserStatus. Both statuses lock the account out identically (see
// auth.service.ts's login()), but the wording stays honest about which one
// actually happened rather than blurring them into one generic message.
export interface AccountStatusChangedParams {
  fullName: string
  status: "Suspended" | "Blocked"
  supportEmail: string
}

// Sent to a candidate/recruiter whose account an admin permanently deleted
// via admin.service.ts's deleteUser. Fired after the row is already gone --
// the email is built from the User record captured just before deletion, not
// a live lookup.
export interface AccountDeletedParams {
  fullName: string
  supportEmail: string
}

export interface VerificationParams {
  companyName: string
  status: string
  notes?: string
  // Used for the "More Information Required" case (Part 3 of the recruiter
  // onboarding spec) to link recruiters to the secure, token-based
  // resubmission page. Optional so the existing Approved/Rejected calls
  // (which have no such action) are unaffected.
  actionLink?: string
  actionLabel?: string
}

// Perk approval workflow -- deliberately separate from
// VerificationParams (company registration). Per spec, perk communication
// happens BOTH via dashboard notification AND email, unlike company
// registration which is email-only.
export interface PerkVerificationParams {
  companyName: string
  perkName: string
  status: string
  comment?: string
  actionLink?: string
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

export interface InterviewScheduledParams {
  recipientName: string
  jobTitle: string
  companyName: string
  scheduledAt: string
  timezone?: string
  mode?: string
  location?: string
  notes?: string
}

// Issue 3 (Candidate Job Lifecycle spec): the generic recruiter status
// progression (Applied -> Reviewed -> Shortlisted -> ... -> Hired/Rejected)
// previously only wrote an AuditCreated event -- nothing ever reached the
// candidate. This is the shared template for all of those plain status
// transitions (InterviewScheduled/OfferReleased keep their own richer
// templates above, since they carry structured data this doesn't have).
export interface ApplicationStatusUpdateParams {
  recipientName: string
  jobTitle: string
  companyName: string
  statusHeading: string
  statusMessage: string
  notes?: string
}

export interface OfferReleasedParams {
  recipientName: string
  jobTitle: string
  companyName: string
  offerDetails: string
}

// ==========================================================================
// shared branded shell + accessible status badge, so every
// transactional email looks like it comes from the same product instead of
// each being a one-off bare <div> with no header, footer, or mobile
// consideration. Previously every template here was a plain
// `<div style="font-family: Arial...">` fragment -- functional, but neither
// "professional" (no logo/header/footer) nor "responsive" (no viewport
// meta, no max-width container, no mobile breakpoint) as Part 19 requires.
// ==========================================================================

const BRAND_PURPLE = "#6B2C91"
const BRAND_PINK = "#EC4899"

// Part 17's accessible status colors, reused here so the color language a
// recruiter learns in the dashboard (Pending/Approved/Rejected/More Info
// Required) matches what they see in their inbox.
function statusBadge(status: string): string {
  const normalized = status.toLowerCase()
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    approved: { bg: "#D1FAE5", fg: "#065F46", label: "Approved" },
    rejected: { bg: "#FCE7F3", fg: "#9D174D", label: "Rejected" },
    info_requested: { bg: "#E0E7FF", fg: "#3730A3", label: "More Information Required" },
    pending: { bg: "#DBEAFE", fg: "#1E40AF", label: "Pending Review" },
    under_review: { bg: "#DBEAFE", fg: "#1E40AF", label: "Under Review" },
    submitted: { bg: "#DBEAFE", fg: "#1E40AF", label: "Submitted" },
  }
  const s = styles[normalized] || { bg: "#F1F5F9", fg: "#475569", label: status }
  return `<span style="display:inline-block; background-color:${s.bg}; color:${s.fg}; font-size:12px; font-weight:700; letter-spacing:0.3px; text-transform:uppercase; padding:4px 12px; border-radius:999px;">${s.label}</span>`
}

function ctaButton(link: string, label: string, color = BRAND_PURPLE): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:8px;" bgcolor="${color}">
          <a href="${link}" target="_blank" style="display:inline-block; padding:12px 28px; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:8px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `
}

// Table-based layout (not flex/grid, which most email clients strip) with an
// embedded <style> media query for the clients that do honor it (Gmail app,
// Apple Mail, Outlook.com, etc.) -- Outlook desktop's rendering engine
// ignores the media query and simply falls back to the fixed 600px layout,
// which still renders correctly, just without the extra mobile padding
// tweak. A hidden preheader span sets the inbox preview text.
function renderShell(opts: { preheader: string; heading: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>JobsForWomen</title>
<style>
  @media only screen and (max-width: 620px) {
    .jfw-container { width: 100% !important; }
    .jfw-padding { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F8FAFC; font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
  <span style="display:none; max-height:0; overflow:hidden; opacity:0;">${opts.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC; padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" class="jfw-container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #E2E8F0;">
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_PURPLE}, ${BRAND_PINK}); padding:24px 32px;">
              <span style="font-size:20px; font-weight:800; color:#ffffff; letter-spacing:0.3px;">JobsForWomen</span>
            </td>
          </tr>
          <tr>
            <td class="jfw-padding" style="padding:32px;">
              <h1 style="margin:0 0 16px; font-size:20px; font-weight:800; color:#0F172A;">${opts.heading}</h1>
              <div style="font-size:14px; line-height:1.7; color:#334155;">
                ${opts.bodyHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td class="jfw-padding" style="padding:20px 32px; background-color:#F8FAFC; border-top:1px solid #E2E8F0;">
              <p style="margin:0; font-size:11px; color:#94A3B8; line-height:1.6;">
                This is an automated message from JobsForWomen.info. Please do not reply directly to this email.
                If you weren't expecting this message, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export const EmailTemplates = {
  // Scenario 1/7: Email Verification (sent immediately on registration, both
  // candidate and recruiter).
  welcome: (params: WelcomeParams): string =>
    renderShell({
      preheader: "Verify your email to activate your JobsForWomen account.",
      heading: "Welcome to JobsForWomen!",
      bodyHtml: `
        <p>Thank you for registering. Please verify your email address to activate your account.</p>
        ${ctaButton(params.verificationLink, "Verify Email")}
        <p style="font-size:12px; color:#94A3B8;">This verification link will expire in 24 hours.</p>
      `,
    }),

  invitation: (params: InvitationParams): string =>
    renderShell({
      preheader: `You've been invited to join JobsForWomen as a ${params.roleName}.`,
      heading: "Staff Onboarding Invitation",
      bodyHtml: `
        <p>You have been invited to join the JobsForWomen administration team as a <strong>${params.roleName}</strong>.</p>
        <p>Click the button below to accept the invitation and complete your profile setup:</p>
        ${ctaButton(params.invitationLink, "Accept Invitation", "#4A5568")}
        <p style="font-size:12px; color:#94A3B8; margin-top:20px; padding-top:16px; border-top:1px solid #E2E8F0;">
          Already have a JobsForWomen account? <a href="${params.loginLink}" style="color:${BRAND_PURPLE}; font-weight:700; text-decoration:none;">Log in here</a> instead.
        </p>
      `,
    }),

  // Admin Management: a Super Admin created this account directly (no
  // self-serve "accept invite" step -- see invitation above for that flow),
  // so it ships the recipient's login credentials plus a straight-to-login
  // button, and a password-change nudge since the password was chosen by
  // someone else.
  adminAccountCreated: (params: AdminAccountCreatedParams): string => {
    const roleLabel = adminRoleLabel(params.roleNames)
    return renderShell({
      preheader: `Your JobsForWomen ${roleLabel} account is ready.`,
      heading: `Your ${roleLabel} Account Is Ready`,
      bodyHtml: `
        <p>Hi ${params.fullName},</p>
        <p>A ${roleLabel} account has been created for you on JobsForWomen with the following role${
          params.roleNames.length > 1 ? "s" : ""
        }: <strong>${params.roleNames.join(", ")}</strong>.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0; width:100%; background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px;">
          <tr>
            <td style="padding:12px 16px;">
              <p style="margin:0 0 4px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.3px; color:#94A3B8;">Username</p>
              <p style="margin:0 0 12px; font-weight:700; color:#0F172A;">${params.email}</p>
              <p style="margin:0 0 4px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.3px; color:#94A3B8;">Password</p>
              <p style="margin:0; font-weight:700; color:#0F172A; font-family: ui-monospace, Menlo, monospace;">${params.password}</p>
            </td>
          </tr>
        </table>
        ${ctaButton(params.loginLink, "Log In Now")}
        <p style="font-size:12px; color:#94A3B8;">
          For security, sign in and change this password as soon as possible. If you weren't expecting this account, contact your platform administrator.
        </p>
      `,
    })
  },

  // Scenarios 2/7, 3/7, 4/7: Company Registration Approved / Rejected /
  // More Information Required. Kept as a single exported function
  // (companyVerification) so existing call sites in email.ts/queue.ts don't
  // need to change, but each status now gets genuinely distinct, tailored
  // copy and subject-appropriate framing rather than one generic "status has
  // been updated to: X" sentence reused for every outcome.
  companyVerification: (params: VerificationParams): string => {
    const normalized = params.status.toLowerCase()
    const copyByStatus: Record<string, { heading: string; intro: string; preheader: string }> = {
      approved: {
        heading: "Your Company Is Verified!",
        intro: `Great news -- <strong>${params.companyName}</strong>'s registration has been reviewed and approved. You can now sign in and start posting jobs.`,
        preheader: `${params.companyName} has been approved. You can now log in.`,
      },
      rejected: {
        heading: "Registration Update Required",
        intro: `<strong>${params.companyName}</strong>'s registration was not approved this time. Please review the feedback below and resubmit your registration.`,
        preheader: `${params.companyName}'s registration was not approved -- see details inside.`,
      },
      info_requested: {
        heading: "More Information Needed",
        intro: `To continue verifying <strong>${params.companyName}</strong>, our team needs a bit more information or documentation from you.`,
        preheader: `Action needed: more information required for ${params.companyName}.`,
      },
    }
    const copy = copyByStatus[normalized] || {
      heading: "Company Verification Update",
      intro: `Your company profile for <strong>${params.companyName}</strong> has a status update.`,
      preheader: `An update on ${params.companyName}'s verification status.`,
    }

    return renderShell({
      preheader: copy.preheader,
      heading: copy.heading,
      bodyHtml: `
        <p>${copy.intro}</p>
        <p style="margin:16px 0;">${statusBadge(params.status)}</p>
        ${params.notes ? `
        <div style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 16px; margin:16px 0;">
          <p style="margin:0 0 4px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.3px; color:#94A3B8;">Admin Note</p>
          <p style="margin:0;">${params.notes}</p>
        </div>` : ""}
        ${params.actionLink ? `
        ${ctaButton(params.actionLink, params.actionLabel || "Take Action")}
        <p style="font-size:12px; color:#94A3B8;">${
          normalized === "approved"
            ? "This takes you straight to the sign-in page -- no separate token or expiry."
            : "This link expires in 7 days and can only be used once."
        }</p>
        ` : ""}
      `,
    })
  },

  // Scenarios 5/7, 6/7, 7/7: Perk Approved / Rejected / More Information
  // Required. Always paired with a dashboard notification (see
  // notification.listener.ts's PerkReviewed subscriber) -- this email is the
  // second, not the only, channel, per spec.
  perkVerification: (params: PerkVerificationParams): string => {
    const normalized = params.status.toLowerCase()
    const copyByStatus: Record<string, { heading: string; intro: string; preheader: string }> = {
      approved: {
        heading: "Perk Claim Approved!",
        intro: `Your claim for <strong>${params.perkName}</strong> has been verified and is now publicly displayed on <strong>${params.companyName}</strong>'s job listings.`,
        preheader: `${params.perkName} is now verified and public.`,
      },
      rejected: {
        heading: "Perk Claim Update Required",
        intro: `Your claim for <strong>${params.perkName}</strong> was not approved this time. Please review the reason below and resubmit from your dashboard.`,
        preheader: `${params.perkName} was not approved -- see the reason inside.`,
      },
      info_requested: {
        heading: "More Information Needed",
        intro: `To verify your <strong>${params.perkName}</strong> claim, our team needs a bit more information or supporting documentation.`,
        preheader: `Action needed: more information required for ${params.perkName}.`,
      },
    }
    const copy = copyByStatus[normalized] || {
      heading: "Perk Verification Update",
      intro: `<strong>${params.companyName}</strong>'s claim for <strong>${params.perkName}</strong> has a status update.`,
      preheader: `An update on your ${params.perkName} claim.`,
    }

    return renderShell({
      preheader: copy.preheader,
      heading: copy.heading,
      bodyHtml: `
        <p>${copy.intro}</p>
        <p style="margin:16px 0;">${statusBadge(params.status)}</p>
        ${params.comment ? `
        <div style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 16px; margin:16px 0;">
          <p style="margin:0 0 4px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.3px; color:#94A3B8;">Admin Comment</p>
          <p style="margin:0;">${params.comment}</p>
        </div>` : ""}
        ${params.actionLink ? ctaButton(params.actionLink, "View in Dashboard") : ""}
      `,
    })
  },

  jobModeration: (params: JobModerationParams): string =>
    renderShell({
      preheader: `Your job posting "${params.jobTitle}" has been ${params.status}.`,
      heading: "Job Moderation Update",
      bodyHtml: `
        <p>Your job posting for <strong>${params.jobTitle}</strong> has been reviewed.</p>
        <p style="margin:16px 0;">${statusBadge(params.status === "approved" ? "approved" : "rejected")}</p>
        ${params.notes ? `
        <div style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 16px; margin:16px 0;">
          <p style="margin:0 0 4px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.3px; color:#94A3B8;">Moderator Notes</p>
          <p style="margin:0;">${params.notes}</p>
        </div>` : ""}
      `,
    }),

  interviewScheduled: (params: InterviewScheduledParams): string =>
    renderShell({
      preheader: `${params.companyName} scheduled an interview with you for ${params.jobTitle}.`,
      heading: "Interview Scheduled",
      bodyHtml: `
        <p>Hi ${params.recipientName},</p>
        <p>Good news! <strong>${params.companyName}</strong> has scheduled an interview with you for the <strong>${params.jobTitle}</strong> role.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0; width:100%;">
          <tr>
            <td style="padding:4px 0; font-size:11px; font-weight:800; text-transform:uppercase; color:#94A3B8; width:80px;">When</td>
            <td style="padding:4px 0; font-weight:700; color:#0F172A;">${params.scheduledAt}${params.timezone ? ` (${params.timezone})` : ""}</td>
          </tr>
          ${params.mode ? `
          <tr>
            <td style="padding:4px 0; font-size:11px; font-weight:800; text-transform:uppercase; color:#94A3B8; width:80px;">Mode</td>
            <td style="padding:4px 0; font-weight:700; color:#0F172A;">${params.mode}</td>
          </tr>` : ""}
          ${params.location ? `
          <tr>
            <td style="padding:4px 0; font-size:11px; font-weight:800; text-transform:uppercase; color:#94A3B8; width:80px;">Where</td>
            <td style="padding:4px 0; font-weight:700; color:#0F172A;">${params.location}</td>
          </tr>` : ""}
        </table>
        ${params.notes ? `
        <div style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 16px; margin:16px 0;">
          <p style="margin:0 0 4px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.3px; color:#94A3B8;">Notes from the recruiter</p>
          <p style="margin:0;">${params.notes}</p>
        </div>` : ""}
        <p>Log in to your JobsForWomen account for full details.</p>
      `,
    }),

  applicationStatusUpdate: (params: ApplicationStatusUpdateParams): string =>
    renderShell({
      preheader: `${params.statusHeading}: ${params.jobTitle} at ${params.companyName}.`,
      heading: params.statusHeading,
      bodyHtml: `
        <p>Hi ${params.recipientName},</p>
        <p>${params.statusMessage}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0; width:100%;">
          <tr>
            <td style="padding:4px 0; font-size:11px; font-weight:800; text-transform:uppercase; color:#94A3B8; width:80px;">Role</td>
            <td style="padding:4px 0; font-weight:700; color:#0F172A;">${params.jobTitle}</td>
          </tr>
          <tr>
            <td style="padding:4px 0; font-size:11px; font-weight:800; text-transform:uppercase; color:#94A3B8; width:80px;">Company</td>
            <td style="padding:4px 0; font-weight:700; color:#0F172A;">${params.companyName}</td>
          </tr>
        </table>
        ${params.notes ? `
        <div style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 16px; margin:16px 0;">
          <p style="margin:0 0 4px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.3px; color:#94A3B8;">Notes from the recruiter</p>
          <p style="margin:0;">${params.notes}</p>
        </div>` : ""}
        <p>Log in to your JobsForWomen account to see the full details.</p>
      `,
    }),

  offerReleased: (params: OfferReleasedParams): string =>
    renderShell({
      preheader: `${params.companyName} has released an offer for ${params.jobTitle}.`,
      heading: "You've Received an Offer!",
      bodyHtml: `
        <p>Hi ${params.recipientName},</p>
        <p>Congratulations! <strong>${params.companyName}</strong> has released an offer for the <strong>${params.jobTitle}</strong> role.</p>
        <div style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 16px; margin:16px 0;">
          <p style="margin:0 0 4px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.3px; color:#94A3B8;">Offer Details</p>
          <p style="margin:0;">${params.offerDetails}</p>
        </div>
        <p>Log in to your JobsForWomen account to review and respond.</p>
      `,
    }),

  passwordReset: (params: ResetParams): string =>
    renderShell({
      preheader: "Reset your JobsForWomen account password.",
      heading: "Password Reset Request",
      bodyHtml: `
        <p>You requested a password reset for your JobsForWomen account.</p>
        <p>Click the button below to set a new password. If you didn't request this, you can safely ignore this email.</p>
        ${ctaButton(params.resetLink, "Reset Password", "#DC2626")}
      `,
    }),

  dailyDigest: (params: DigestParams): string =>
    renderShell({
      preheader: `${params.jobsCount} new job recommendations for you today.`,
      heading: "Daily Jobs Digest",
      bodyHtml: `
        <p>Hello ${params.recipientName}, here are today's matching job recommendations (${params.jobsCount}):</p>
        <ul style="padding-left:20px; margin:12px 0;">
          ${params.jobs.map(j => `<li style="margin-bottom:6px;"><strong>${j.title}</strong> at ${j.companyName} (${j.location})</li>`).join("")}
        </ul>
      `,
    }),

  weeklyDigest: (params: DigestParams): string =>
    renderShell({
      preheader: `Your weekly job highlights digest (${params.jobsCount} roles).`,
      heading: "Weekly Highlights Digest",
      bodyHtml: `
        <p>Hello ${params.recipientName}, here are the weekly trending recommendations matching your skills:</p>
        <ul style="padding-left:20px; margin:12px 0;">
          ${params.jobs.map(j => `<li style="margin-bottom:6px;"><strong>${j.title}</strong> at ${j.companyName} (${j.location})</li>`).join("")}
        </ul>
      `,
    }),

  accountStatusChanged: (params: AccountStatusChangedParams): string => {
    const verb = params.status === "Blocked" ? "blocked" : "suspended"
    return renderShell({
      preheader: `Your JobsForWomen account has been ${verb}.`,
      heading: `Your Account Has Been ${params.status}`,
      bodyHtml: `
        <p>Hi ${params.fullName},</p>
        <p>Your JobsForWomen account has been <strong>${verb}</strong> by a platform administrator. While this is in effect, you won't be able to sign in or use the platform.</p>
        <p style="margin:16px 0;">${statusBadge(params.status)}</p>
        <div style="background-color:#FEF2F2; border:1px solid #FECACA; border-radius:8px; padding:12px 16px; margin:16px 0;">
          <p style="margin:0; color:#991B1B;">For more details or to appeal this decision, please contact our support team at <a href="mailto:${params.supportEmail}" style="color:#991B1B; font-weight:700;">${params.supportEmail}</a>.</p>
        </div>
      `,
    })
  },

  accountDeleted: (params: AccountDeletedParams): string =>
    renderShell({
      preheader: "Your JobsForWomen account has been deleted.",
      heading: "Your Account Has Been Deleted",
      bodyHtml: `
        <p>Hi ${params.fullName},</p>
        <p>Your JobsForWomen account and associated data have been permanently deleted by a platform administrator. This action cannot be undone, and you will need to register again if you'd like to use the platform in the future.</p>
        <div style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 16px; margin:16px 0;">
          <p style="margin:0; color:#475569;">If you believe this was done in error, please contact our support team at <a href="mailto:${params.supportEmail}" style="color:${BRAND_PURPLE}; font-weight:700;">${params.supportEmail}</a>.</p>
        </div>
      `,
    }),
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
    .replace(/<\/tr>/ig, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n\s*\n/g, "\n\n")
    .trim()
}
