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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

export default env;