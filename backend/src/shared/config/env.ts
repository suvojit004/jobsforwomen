import dotenv from "dotenv";
import { z } from "zod";

// Load .env locally.
// On Render/Vercel this simply uses the environment variables
// already injected into process.env.
dotenv.config();

// Common paste mistake for env-var UIs that don't parse shell-style quoting
// (Render's dashboard, among others): copying a value straight out of
// .env.example -- which wraps it in double quotes for *local .env file*
// safety -- pastes the literal quote characters into the var's value. A
// local .env is read through `dotenv`, which strips matching wrapping
// quotes automatically, so this never surfaces in development. Render (and
// most host dashboards) inject the value into process.env completely
// unparsed, so the quotes become part of the real string. For SES_FROM this
// breaks AWS's address parser -- the quotes swallow the "<...>" address
// spec, so SES sees no bare "@domain" at the top level and rejects EVERY
// send with the same generic "BadRequestException - Missing final
// '@domain'", regardless of recipient, which is exactly what makes it look
// recipient-specific in the logs when it isn't.
function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

// Accepts either a bare address ("a@b.com") or a display-name form
// ("Name <a@b.com>"), and nothing else -- catches quote characters, missing
// '@', missing domain, or unbalanced angle brackets at config-load time
// instead of as a mysterious per-send SES rejection in production.
const SENDER_ADDRESS_PATTERN = /^(?:[^<>"\s@]+@[^<>"\s@]+\.[^<>"\s@]+|[^<>"]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>)$/

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  PORT: z.coerce.number().default(5000),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),

  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),

  REDIS_URL: z.string().min(1),
  CLIENT_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Local disk storage (replaces Cloudinary). DISK_MOUNT_PATH must point at a
  // Render Persistent Disk mount in production -- Render's regular filesystem
  // is wiped on every redeploy/restart. BACKEND_URL is this API's own public
  // base URL, used to build absolute links to /files/... routes (mirrors what
  // Cloudinary's secure_url used to give us) since uploads happen deep in
  // services that don't have access to the current request.
  DISK_MOUNT_PATH: z.string().default("./uploads"),
  BACKEND_URL: z.string().url().default("http://localhost:5000"),

  // --- Email: AWS SES (migrated off Resend) ---------------------------------
  // Sending goes through the SES v2 API in AWS_SES_REGION. The sending domain
  // must be verified in that exact region -- SES identities are regional, so a
  // domain verified in ap-south-1 does not exist in us-east-1.
  AWS_SES_REGION: z.string().min(1).default("ap-south-1"),
  // Credentials are optional here so the app can also run on infrastructure
  // that supplies them ambiently (an EC2/ECS task role, or a local AWS
  // profile). When unset, the SDK's default credential chain is used. On
  // Render, where there is no instance role, both must be set explicitly.
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  // The "From" identity. Must be on the verified domain
  // (e.g. "JobsForWomen <noreply@mail.jobsforwomen.info>" -- entered WITHOUT
  // surrounding quote characters in Render/host env-var UIs; see
  // stripWrappingQuotes above for why that matters).
  SES_FROM: z
    .string()
    .min(1)
    .transform(stripWrappingQuotes)
    .refine((v: string) => SENDER_ADDRESS_PATTERN.test(v), {
      message:
        "SES_FROM is not a valid sender address. Use either a bare address " +
        '("noreply@mail.jobsforwomen.info") or "Display Name <noreply@mail.jobsforwomen.info>" -- ' +
        "with no surrounding quote characters in the host's env-var settings.",
    }),
  // Optional SES Configuration Set -- required if you want SES to publish
  // bounce/complaint/delivery events to SNS. Leave unset to send without one.
  SES_CONFIGURATION_SET: z.string().optional(),
  // ARN of the SNS topic that the SES configuration set publishes bounce and
  // complaint events to. When set, the /api/v1/emails/sns endpoint rejects
  // notifications from any other topic; when unset it accepts any (and warns).
  SNS_TOPIC_ARN: z.string().optional(),
  // Sending rate ceiling, in emails per second, enforced client-side by the
  // BullMQ email worker (see shared/queue/queue.ts). SES sandbox accounts are
  // capped at 1/sec; raise this to match the granted rate once production
  // access is approved, rather than letting SES throttle and fail sends.
  SES_MAX_SEND_RATE_PER_SEC: z.coerce.number().positive().default(1),

  // Inbox that receives admin "Contact Support" ticket emails. Falls back to
  // the SES_FROM address so this feature works without a new required var.
  // Same quote-stripping as SES_FROM -- same paste mistake is possible here.
  SUPPORT_EMAIL: z
    .string()
    .optional()
    .transform((v) => (v ? stripWrappingQuotes(v) : v)),

  PROFILE_COMPLETION_THRESHOLD: z.coerce.number().default(70),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),

  // Rate limiting (Part: production hardening). Each tier has its own
  // window/ceiling so callers can tune limits per environment without a code
  // change/redeploy -- see shared/middleware/rateLimit.middleware.ts for how
  // these are actually applied. Defaults are conservative starting points,
  // not a claim that they're the "correct" production values for any given
  // deployment's real traffic.
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().default(100),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce.number().default(60_000),
  // Auth (login/register/forgot-password/reset-password/verify-email/oauth):
  // deliberately strict -- these are the endpoints credential-stuffing and
  // brute-force attacks actually target.
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(10),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().default(15 * 60_000),
  RATE_LIMIT_ADMIN_MAX: z.coerce.number().default(200),
  RATE_LIMIT_ADMIN_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_RECRUITER_MAX: z.coerce.number().default(150),
  RATE_LIMIT_RECRUITER_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_CANDIDATE_MAX: z.coerce.number().default(150),
  RATE_LIMIT_CANDIDATE_WINDOW_MS: z.coerce.number().default(60_000),
  // File uploads (resume, company logo/documents, etc.): strict, keyed by
  // window in minutes rather than seconds since legitimate upload frequency
  // is inherently low.
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().default(10),
  RATE_LIMIT_UPLOAD_WINDOW_MS: z.coerce.number().default(10 * 60_000),
  // Search/browse (job search, listings): higher ceiling than other
  // authenticated traffic since a single user paging/filtering results
  // legitimately fires many requests quickly, but still capped.
  RATE_LIMIT_SEARCH_MAX: z.coerce.number().default(300),
  RATE_LIMIT_SEARCH_WINDOW_MS: z.coerce.number().default(60_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

export default env;