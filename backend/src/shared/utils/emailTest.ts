// Set NODE_ENV to development to bypass the test environment mock block in EmailService.sendMail
if (!process.env.NODE_ENV || process.env.NODE_ENV === "test") {
  process.env.NODE_ENV = "development"
}

import env from "../config/env"
import { EmailService } from "./email"
import { logger } from "./logger"

async function runDiagnostic() {
  const recipient = process.argv[2]
  if (!recipient) {
    console.error("❌ Error: Please specify a recipient email address.")
    console.error("Usage: npm run email:test <recipient-email>")
    process.exit(1)
  }

  console.log(`[Diagnostic] Resolving configuration...`)
  const apiKey = env.RESEND_API_KEY || env.SMTP_PASS
  if (!apiKey) {
    console.error("❌ Error: Resend API key is not configured in environment (RESEND_API_KEY or SMTP_PASS).")
    process.exit(1)
  }

  console.log(`[Diagnostic] Sender configured: ${env.SMTP_FROM}`)
  console.log(`[Diagnostic] Recipient: ${recipient}`)
  console.log(`[Diagnostic] Sending test email via Resend HTTPS API...`)

  try {
    const subject = "JobsForWomen Direct Provider Test Email"
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Direct Provider Connection Test</h2>
        <p>This is a harmless test email sent by the JobsForWomen email diagnostic tool.</p>
        <p>If you received this email, the Resend HTTPS SDK integration is working successfully!</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #777;">Timestamp: ${new Date().toISOString()}</p>
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
    if (err.status) console.error(`HTTP Status Code: ${err.status}`)
    if (err.code) console.error(`Error Code: ${err.code}`)
    
    // Explicit warning about sandbox restrictions
    if (err.status === 403 || err.message.includes("403")) {
      console.warn("\n⚠️ Note: The 403 rejection typically indicates Resend sandbox restrictions.")
      console.warn("Verify that the recipient is the email address associated with your Resend account.")
    }
    
    process.exit(1)
  }
}

runDiagnostic()
