import dotenv from "dotenv";
import { z } from "zod";

// Load .env locally.
// On Render/Vercel this simply uses the environment variables
// already injected into process.env.
dotenv.config();

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

  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().min(1),
  // Inbox that receives admin "Contact Support" ticket emails. Falls back to
  // SMTP_USER so this feature works out of the box without a new required env var.
  SUPPORT_EMAIL: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),

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