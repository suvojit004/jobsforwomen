/**
 * Renders one of EmailTemplates' templates with sample data and writes it to
 * a static HTML file so it can be opened in a browser -- no SES call, no
 * database, no sandbox recipient restriction. Useful for reviewing template
 * changes (copy, layout, new buttons/links) before spending SES sandbox
 * quota with `npm run email:test`.
 *
 * Usage:
 *   npm run email:preview -- invitation
 *   npm run email:preview -- welcome
 *   npm run email:preview -- companyVerification
 *   npm run email:preview            (defaults to "invitation")
 *
 * Available names: welcome, invitation, companyVerification, perkVerification,
 * jobModeration, interviewScheduled, applicationStatusUpdate, offerReleased,
 * passwordReset, dailyDigest, weeklyDigest
 */
import fs from "fs"
import path from "path"
import { EmailTemplates } from "./emailTemplates"

const SAMPLE_RENDERERS: Record<string, () => string> = {
  welcome: () =>
    EmailTemplates.welcome({
      email: "jane@example.com",
      verificationLink: "http://localhost:5173/auth/verify-email?token=sample-token",
    }),

  invitation: () =>
    EmailTemplates.invitation({
      email: "jane@example.com",
      invitationLink: "http://localhost:5173/auth/accept-invitation?token=sample-token",
      roleName: "Recruiter Admin",
      loginLink: "http://localhost:5173/auth/login",
    }),

  adminAccountCreated: () =>
    EmailTemplates.adminAccountCreated({
      fullName: "Jane Doe",
      email: "jane@example.com",
      password: "T3mp-Passw0rd!",
      roleNames: ["Moderator"],
      loginLink: "http://localhost:5173/auth/login",
    }),

  companyVerification: () =>
    EmailTemplates.companyVerification({
      companyName: "Acme Corp",
      status: "Approved",
      actionLink: "http://localhost:5173/auth/login",
      actionLabel: "Log In Now",
    }),

  perkVerification: () =>
    EmailTemplates.perkVerification({
      companyName: "Acme Corp",
      perkName: "On-site Childcare",
      status: "Approved",
      actionLink: "http://localhost:5173/recruiter/perks",
    }),

  jobModeration: () =>
    EmailTemplates.jobModeration({
      jobTitle: "Senior Frontend Engineer",
      status: "approved",
      notes: "Looks good -- approved on first review.",
    }),

  interviewScheduled: () =>
    EmailTemplates.interviewScheduled({
      recipientName: "Jane Doe",
      jobTitle: "Senior Frontend Engineer",
      companyName: "Acme Corp",
      scheduledAt: "Aug 4, 2026, 3:00 PM",
      timezone: "IST",
      mode: "Video Call",
      notes: "Please join 5 minutes early.",
    }),

  applicationStatusUpdate: () =>
    EmailTemplates.applicationStatusUpdate({
      recipientName: "Jane Doe",
      jobTitle: "Senior Frontend Engineer",
      companyName: "Acme Corp",
      statusHeading: "Application Shortlisted",
      statusMessage: "Your application has moved to the shortlist stage.",
    }),

  offerReleased: () =>
    EmailTemplates.offerReleased({
      recipientName: "Jane Doe",
      jobTitle: "Senior Frontend Engineer",
      companyName: "Acme Corp",
      offerDetails: "Base salary: 18 LPA. Start date: Sept 1, 2026.",
    }),

  passwordReset: () =>
    EmailTemplates.passwordReset({
      email: "jane@example.com",
      resetLink: "http://localhost:5173/auth/reset-password?token=sample-token",
    }),

  dailyDigest: () =>
    EmailTemplates.dailyDigest({
      recipientName: "Jane",
      jobsCount: 2,
      jobs: [
        { title: "Senior Frontend Engineer", companyName: "Acme Corp", location: "Remote" },
        { title: "Product Designer", companyName: "Widgets Inc", location: "Bengaluru" },
      ],
    }),

  weeklyDigest: () =>
    EmailTemplates.weeklyDigest({
      recipientName: "Jane",
      jobsCount: 2,
      jobs: [
        { title: "Senior Frontend Engineer", companyName: "Acme Corp", location: "Remote" },
        { title: "Product Designer", companyName: "Widgets Inc", location: "Bengaluru" },
      ],
    }),
}

const outDir = path.join(__dirname, "..", "..", "..", "email-previews")
fs.mkdirSync(outDir, { recursive: true })

function writeOne(name: string): string {
  const render = SAMPLE_RENDERERS[name]
  const outPath = path.join(outDir, `${name}.html`)
  fs.writeFileSync(outPath, render(), "utf-8")
  return outPath
}

const arg = process.argv[2] || "invitation"

if (arg === "all") {
  const names = Object.keys(SAMPLE_RENDERERS)
  names.forEach(writeOne)

  // Simple index page linking to each rendered template, so opening one file
  // gets you to all of them instead of hunting through the folder.
  const indexHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Email template previews</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:32px;background:#F8FAFC;}
h1{font-size:18px;} ul{line-height:2;} a{color:#6B2C91;font-weight:700;text-decoration:none;} a:hover{text-decoration:underline;}</style>
</head><body>
<h1>JobsForWomen email template previews</h1>
<ul>
${names.map((n) => `<li><a href="${n}.html" target="_blank">${n}</a></li>`).join("\n")}
</ul>
</body></html>`
  fs.writeFileSync(path.join(outDir, "index.html"), indexHtml, "utf-8")

  console.log(`Wrote ${names.length} previews to ${outDir}`)
  console.log(`Open ${path.join(outDir, "index.html")} in a browser -- it links to all of them.`)
} else {
  const render = SAMPLE_RENDERERS[arg]
  if (!render) {
    console.error(`Unknown template "${arg}".`)
    console.error(`Available: ${Object.keys(SAMPLE_RENDERERS).join(", ")}, or "all"`)
    process.exit(1)
  }
  const outPath = writeOne(arg)
  console.log(`Wrote preview: ${outPath}`)
  console.log(`Open that file directly in a browser to see how the email renders.`)
}
