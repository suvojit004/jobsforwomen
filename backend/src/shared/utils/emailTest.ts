// Set NODE_ENV to development to bypass the test environment mock block in EmailService.sendMail
if (!process.env.NODE_ENV || process.env.NODE_ENV === "test") {
  process.env.NODE_ENV = "development"
}

import env from "../config/env"
import { EmailService, verifyEmailTransport } from "./email"

async function runDiagnostic() {
  const recipient = process.argv[2]
  if (!recipient) {
    console.error("❌ Error: Please specify a recipient email address.")
    console.error("Usage: npm run email:test <recipient-email>")
    process.exit(1)
  }

  console.log(`[Diagnostic] Resolving configuration...`)
  if (!env.SES_FROM) {
    console.error("❌ Error: SES_FROM is not configured.")
    process.exit(1)
  }

  console.log(`[Diagnostic] Region:    ${env.AWS_SES_REGION}`)
  console.log(`[Diagnostic] Sender:    ${env.SES_FROM}`)
  console.log(`[Diagnostic] Recipient: ${recipient}`)
  console.log(
    `[Diagnostic] Credentials: ${
      env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? "explicit (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)"
        : "default AWS provider chain (instance role / profile)"
    }`
  )

  // Confirms credentials + region and prints the live sandbox/quota state
  // before spending any of the daily sending allowance.
  console.log(`[Diagnostic] Checking SES account status...`)
  const reachable = await verifyEmailTransport()
  if (!reachable) {
    console.error("❌ SES is not reachable with the current configuration. See the logged error above.")
    process.exit(1)
  }

  console.log(`[Diagnostic] Sending test email via AWS SES...`)

  try {
    const subject = "JobsForWomen Direct Provider Test Email"
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Direct Provider Connection Test</h2>
        <p>This is a harmless test email sent by the JobsForWomen email diagnostic tool.</p>
        <p>If you received this email, the AWS SES integration is working successfully.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #777;">Region: ${env.AWS_SES_REGION} &middot; Timestamp: ${new Date().toISOString()}</p>
      </div>
    `
    const success = await EmailService.sendMail(recipient, subject, html)
    if (success) {
      console.log("✅ Diagnostic completed successfully!")
    } else {
      console.error("❌ Diagnostic returned false (unexpected without throwing).")
      process.exit(1)
    }
  } catch (err: any) {
    console.error("❌ Diagnostic Failed!")
    console.error(`Error Name: ${err.name || "Error"}`)
    console.error(`Error Message: ${err.message}`)
    if (err.$metadata?.httpStatusCode) console.error(`HTTP Status Code: ${err.$metadata.httpStatusCode}`)

    // The overwhelmingly common failure while production access is pending.
    if (err.name === "MessageRejected" || err.name === "PermanentEmailError") {
      if (/not verified/i.test(err.message || "")) {
        console.warn("\n⚠️  SES SANDBOX RESTRICTION")
        console.warn("While the account is in sandbox mode, SES only delivers to individually")
        console.warn("verified recipient addresses. Either:")
        console.warn("  1. Verify this recipient: SES console → Identities → Create identity → Email address, or")
        console.warn("  2. Send to an already-verified address, or")
        console.warn("  3. Wait for production access to be approved.")
        console.warn("Note this is about the RECIPIENT, not the sending domain -- a verified")
        console.warn("sending domain does not lift the recipient restriction.")
      }
    }

    if (err.name === "CredentialsProviderError" || /credential/i.test(err.message || "")) {
      console.warn("\n⚠️  AWS credentials could not be resolved.")
      console.warn("Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or configure an AWS profile/role.")
    }

    process.exit(1)
  }
}

runDiagnostic()
