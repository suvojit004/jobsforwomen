import { Router, raw } from "express"
import https from "https"
import env from "../config/env"
import { logger } from "../utils/logger"
import { emailMetrics } from "../utils/email"
import prisma from "../database/db"

/**
 * AWS SNS endpoint for SES bounce / complaint / delivery notifications.
 *
 * Two things about SNS make this route different from an ordinary webhook:
 *
 * 1. SNS posts with Content-Type `text/plain`, NOT `application/json`, so the
 *    app-wide express.json() parser ignores it and req.body arrives empty.
 *    This router therefore attaches its own raw body parser and parses the
 *    JSON itself.
 *
 * 2. Before SNS delivers anything it sends a one-off `SubscriptionConfirmation`
 *    message containing a SubscribeURL that must be visited to activate the
 *    subscription. Until that happens the topic stays "Pending confirmation"
 *    and no notifications arrive at all. This route confirms automatically.
 *
 * Wiring it up (all in the AWS console):
 *   SNS  → create topic → create subscription, protocol HTTPS,
 *          endpoint https://<api-host>/api/v1/emails/sns
 *   SES  → Configuration sets → create one → add an event destination
 *          pointing at that SNS topic, selecting Bounce and Complaint
 *          (Delivery optional)
 *   App  → set SES_CONFIGURATION_SET to that configuration set's name, and
 *          SNS_TOPIC_ARN to the topic ARN
 *
 * Without SES_CONFIGURATION_SET set, SES publishes no events and this endpoint
 * stays silent -- see shared/utils/email.ts, which only sends
 * ConfigurationSetName when it is configured.
 */
const router = Router()

// SNS signs every message. Verifying that signature is what stops anyone who
// discovers this URL from POSTing fabricated bounce reports and poisoning the
// metrics/audit log. Full RSA verification requires fetching the signing
// certificate; the checks below are the cheap, dependency-free subset:
//   - the signing certificate must be hosted on an AWS domain
//   - the topic ARN must match the one this deployment expects
// If you want complete cryptographic verification, add the `sns-validator`
// package and run it before processing.
function isTrustedSigningCertUrl(url: unknown): boolean {
  if (typeof url !== "string") return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(parsed.hostname)
  } catch {
    return false
  }
}

function isExpectedTopic(topicArn: unknown): boolean {
  // When SNS_TOPIC_ARN is unset we cannot pin the topic, so we accept the
  // message and warn -- rather than silently rejecting real notifications in a
  // deployment that simply hasn't configured it yet.
  if (!env.SNS_TOPIC_ARN) {
    logger.warn(
      "[SNS] SNS_TOPIC_ARN is not configured -- accepting notification without topic verification. " +
        "Set it to pin this endpoint to your topic."
    )
    return true
  }
  return topicArn === env.SNS_TOPIC_ARN
}

// SECURITY: SubscribeURL comes straight from the request body, and confirming
// a subscription means the server issues an outbound GET to it. Without this
// check that is a server-side request forgery primitive -- anyone who finds
// this endpoint could make the server fetch an arbitrary URL (including
// internal addresses) simply by POSTing a fake SubscriptionConfirmation.
// Only genuine SNS confirmation URLs are ever fetched.
function isTrustedSubscribeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(parsed.hostname)
  } catch {
    return false
  }
}

function confirmSubscription(subscribeUrl: string): void {
  if (!isTrustedSubscribeUrl(subscribeUrl)) {
    logger.warn(`[SNS] Refusing to fetch untrusted SubscribeURL: ${subscribeUrl}`)
    return
  }
  https
    .get(subscribeUrl, (res) => {
      res.resume() // drain so the socket is released
      logger.info(`[SNS] Subscription confirmation responded ${res.statusCode}.`)
    })
    .on("error", (err) => {
      logger.error(`[SNS] Failed to confirm subscription: ${err.message}`)
    })
}

async function recordEvent(action: string, address: string, metadata: Record<string, any>): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        category: "SYSTEM",
        action,
        entity: "Email",
        entityId: address || "unknown",
        // AuditLog has no `metadata` column -- oldValue/newValue are the
        // Json fields (see prisma/schema.prisma and shared/utils/audit.ts).
        newValue: metadata,
        timestamp: new Date(),
      },
    })
  } catch (err: any) {
    logger.error(`[SNS] Failed to write ${action} audit row: ${err.message}`)
  }
}

// SNS sends text/plain; accept any content type and parse manually.
router.post("/sns", raw({ type: () => true, limit: "512kb" }), async (req, res) => {
  let payload: any
  try {
    if (Buffer.isBuffer(req.body)) {
      payload = JSON.parse(req.body.toString("utf8"))
    } else if (req.body && typeof req.body === "object") {
      // Real SNS traffic is text/plain, which the raw parser above handles.
      // But if a client posts application/json (curl, Postman, a test), the
      // app-wide express.json() consumes the stream first and the raw parser
      // is skipped -- leaving an already-parsed object here. Without this
      // branch that case stringified to "[object Object]" and 400'd.
      payload = req.body
    } else {
      payload = JSON.parse(String(req.body ?? ""))
    }
  } catch {
    logger.warn("[SNS] Received a request with an unparseable body.")
    return res.status(400).json({ success: false, message: "Invalid payload" })
  }

  // SNS puts the message type in a header as well as the body.
  const messageType = (req.headers["x-amz-sns-message-type"] as string) || payload.Type

  if (!isTrustedSigningCertUrl(payload.SigningCertURL)) {
    logger.warn(`[SNS] Rejected message with untrusted SigningCertURL: ${payload.SigningCertURL}`)
    return res.status(403).json({ success: false, message: "Untrusted signing certificate" })
  }

  if (!isExpectedTopic(payload.TopicArn)) {
    logger.warn(`[SNS] Rejected message from unexpected topic: ${payload.TopicArn}`)
    return res.status(403).json({ success: false, message: "Unexpected topic" })
  }

  // --- Subscription lifecycle ---------------------------------------------
  if (messageType === "SubscriptionConfirmation") {
    if (typeof payload.SubscribeURL === "string") {
      logger.info(`[SNS] Confirming subscription for topic ${payload.TopicArn}`)
      confirmSubscription(payload.SubscribeURL)
    }
    return res.status(200).json({ success: true })
  }

  if (messageType === "UnsubscribeConfirmation") {
    logger.warn(`[SNS] Received UnsubscribeConfirmation for topic ${payload.TopicArn} -- SES events will stop arriving.`)
    return res.status(200).json({ success: true })
  }

  // --- Notification --------------------------------------------------------
  // payload.Message is a JSON *string* containing the SES event.
  let event: any
  try {
    event = typeof payload.Message === "string" ? JSON.parse(payload.Message) : payload.Message
  } catch {
    logger.warn("[SNS] Notification arrived with an unparseable Message body.")
    return res.status(200).json({ success: true }) // 200 so SNS doesn't retry a message we can never parse
  }

  const eventType: string = event?.eventType || event?.notificationType || "Unknown"

  switch (eventType) {
    case "Bounce": {
      const bounce = event.bounce || {}
      const recipients: any[] = bounce.bouncedRecipients || []
      // "Permanent" means the address is dead (mailbox does not exist, domain
      // does not resolve). AWS adds these to the account-level suppression
      // list automatically; further sends to them are rejected outright.
      const isPermanent = bounce.bounceType === "Permanent"
      for (const r of recipients) {
        emailMetrics.bounced++
        logger.warn(
          `[SNS] ${bounce.bounceType}/${bounce.bounceSubType} bounce for ${r.emailAddress}` +
            (r.diagnosticCode ? ` -- ${r.diagnosticCode}` : "")
        )
        await recordEvent(isPermanent ? "EMAIL_BOUNCED_PERMANENT" : "EMAIL_BOUNCED_TRANSIENT", r.emailAddress, {
          bounceType: bounce.bounceType,
          bounceSubType: bounce.bounceSubType,
          diagnosticCode: r.diagnosticCode,
          timestamp: bounce.timestamp,
          messageId: event.mail?.messageId,
        })
      }
      break
    }

    case "Complaint": {
      const complaint = event.complaint || {}
      const recipients: any[] = complaint.complainedRecipients || []
      for (const r of recipients) {
        emailMetrics.complaints++
        // A complaint means the recipient pressed "mark as spam". These carry
        // far more weight than bounces with mailbox providers -- a sustained
        // complaint rate above ~0.1% puts SES sending privileges at risk.
        logger.warn(`[SNS] Spam complaint from ${r.emailAddress} (${complaint.complaintFeedbackType || "unspecified"})`)
        await recordEvent("EMAIL_COMPLAINT", r.emailAddress, {
          complaintFeedbackType: complaint.complaintFeedbackType,
          timestamp: complaint.timestamp,
          messageId: event.mail?.messageId,
        })
      }
      break
    }

    case "Delivery": {
      // Informational only -- logged at debug so successful deliveries don't
      // flood the logs at volume.
      const recipients: string[] = event.delivery?.recipients || []
      logger.debug(`[SNS] Delivery confirmed for ${recipients.length} recipient(s).`)
      break
    }

    default:
      logger.info(`[SNS] Unhandled SES event type: ${eventType}`)
  }

  return res.status(200).json({ success: true })
})

export default router
