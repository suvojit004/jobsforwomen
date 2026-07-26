# 4. Environment Variables

Both the backend and frontend systems require environment variables to operate. In the backend, variable schemas are validated at runtime using Zod inside `backend/src/shared/config/env.ts`. If any required variable is missing or malformed, the server exits immediately with code `1`.

---

## 4.1 Backend Environment Configuration (`backend/.env`)

### 1. General Settings
* **`NODE_ENV`**: (Optional) Defines the system running mode. Controls proxy trust, refresh-cookie `Secure`/`SameSite` flags, and log verbosity — **set it to `production` in every deployed environment.**
  * Options: `development` | `production` | `test`
  * Default: `development`
* **`PORT`**: (Optional) The port the Express HTTP server binds to.
  * Default: `5000`

### 2. Database Settings
* **`DATABASE_URL`**: (Required) PostgreSQL connection string for Prisma. Includes credentials, port, host, and database name.
  * Example: `"postgresql://user:password@localhost:5432/jobsforwomen_db?schema=public"`

### 3. Caching & Message Queues
* **`REDIS_URL`**: (Required) Connection URL for Redis. Used for BullMQ queues, rate-limit counters, permission cache checks, and Socket.IO cross-instance fanout.
  * Example (local): `"redis://127.0.0.1:6379"`
  * Example (Upstash/TLS): `"rediss://default:<token>@<host>.upstash.io:6379"` — note the double `s` in `rediss://`.
* **`UPSTASH_REDIS_REST_URL`**: (Optional) Upstash HTTP URL for serverless Redis environments.
* **`UPSTASH_REDIS_REST_TOKEN`**: (Optional) Upstash HTTP authentication token.

### 4. JWT Authentication
* **`JWT_ACCESS_SECRET`**: (Required) String secret used to sign short-lived access tokens. Must be minimum 8 characters (prefer 32+ cryptographically random bytes).
* **`JWT_REFRESH_SECRET`**: (Required) String secret used to sign long-lived refresh tokens. Must be minimum 8 characters.
* **`JWT_ACCESS_EXPIRY`**: (Optional) JWT access token lifetime.
  * Default: `"15m"`
* **`JWT_REFRESH_EXPIRY`**: (Optional) JWT refresh token lifetime.
  * Default: `"7d"`

### 5. Client Web Addresses
* **`CLIENT_URL`** / **`FRONTEND_URL`**: (Optional) The absolute web url of the React SPA. Used for CORS configurations and generating confirmation links in transaction emails.
  * Example: `"http://localhost:3000"`

### 6. Local Disk File Storage

> File storage was migrated off Cloudinary. All uploads (resumes, offer letters, company logos, gallery images, verification and perk documents) are now written to the server's local filesystem and served back through the `/files/jfw/:type/:filename` route. There are no `CLOUDINARY_*` variables any more — the Zod schema does not accept them.

* **`DISK_MOUNT_PATH`**: (Optional, but critical in production) Absolute or relative path where uploaded files are stored.
  * Default: `"./uploads"`
  * **In production this must point at genuinely persistent storage** (a Render Persistent Disk, an AWS EFS mount, or a Docker volume). Ordinary container filesystems are wiped on every redeploy and restart, destroying every uploaded file.
* **`BACKEND_URL`**: (Optional, but critical in production) This API's own public base URL. Used to build the absolute file links returned in API responses, because uploads happen inside services that have no access to the current request.
  * Default: `"http://localhost:5000"`
  * Example: `"https://api.jobsforwomen.info"`

### 7. Resend Email Transport Settings

> Despite the `SMTP_*` naming, no SMTP connection is ever opened — email is sent over the Resend HTTPS API. The names are historical.

* **`SMTP_HOST`**: (Required) e.g. `"smtp.resend.com"`.
* **`SMTP_PORT`**: (Optional) Default: `587`.
* **`SMTP_USER`**: (Required) e.g. `"resend"`.
* **`SMTP_PASS`**: (Required) Doubles as the Resend API key fallback when `RESEND_API_KEY` is unset.
* **`SMTP_FROM`**: (Required, no default) The sender identity used on all platform email dispatches. Must be an address on a domain verified in Resend, or delivery stays restricted to the account owner's own address.
  * Example: `"JobsForWomen <noreply@jobsforwomen.info>"`
* **`RESEND_API_KEY`**: (Optional/Canonical) The API key for the Resend Node.js SDK (starts with `re_`). If omitted, the system falls back to `SMTP_PASS`. The resolution order in `shared/utils/email.ts` is literally `RESEND_API_KEY || SMTP_PASS`; if neither is set the process throws at startup.
* **`SUPPORT_EMAIL`**: (Optional) The system mailbox that receives "Contact Support" ticket emails. Falls back to `SMTP_USER` if not configured.

### 8. Google OAuth Setup
* **`GOOGLE_CLIENT_ID`**: (Required) Client ID from Google Cloud Console Credentials.
* **`GOOGLE_CLIENT_SECRET`**: (Required) Client Secret from Google Cloud Console Credentials.
* **`GOOGLE_CALLBACK_URL`**: (Required, **no default**) Callback redirect URL registered in Google Console. Must be a valid URL or the process exits at boot. Must match the URI registered in Google Cloud Console exactly.
  * Local value: `"http://localhost:5000/api/v1/auth/google/callback"`

### 9. Platform Policy Rules
* **`PROFILE_COMPLETION_THRESHOLD`**: (Optional) The minimum profile completion percent required for candidates to submit job applications.
  * Default: `70`
* **`BYPASS_EMAIL_VERIFICATION`**: (Optional) Set to `true` to allow newly registered users to be created in `Active` status immediately, bypassing the verification link. Read directly from `process.env` in `auth.service.ts` — it is **not** part of the Zod schema, so it is never validated or reported at boot.
  * > **Never set this in production.** It is intended only for local Docker runs and load-test account seeding. It is set in `backend/docker-compose.yml`, which is local-only, and must not be added to any deployed environment. With it enabled, anyone can register and use an account without proving they control the email address.

### 10. Rate Limiting

Seven independent tiers, each with a `_MAX` (requests) and a `_WINDOW_MS` (window length in milliseconds). All are optional — the defaults below are applied by `shared/config/env.ts`. Being env-driven means limits can be retuned per environment without a code change or redeploy. See `shared/middleware/rateLimit.middleware.ts` for how each tier is applied.

| Variable | Default | Tier applies to |
| :--- | :--- | :--- |
| `RATE_LIMIT_GLOBAL_MAX` / `_WINDOW_MS` | `100` / `60000` | Every route, IP-keyed, evaluated before all others |
| `RATE_LIMIT_AUTH_MAX` / `_WINDOW_MS` | `10` / `900000` | Login, register, OAuth, refresh, forgot/reset password, verify email — IP-keyed |
| `RATE_LIMIT_ADMIN_MAX` / `_WINDOW_MS` | `200` / `60000` | Admin route group, user-ID-keyed |
| `RATE_LIMIT_RECRUITER_MAX` / `_WINDOW_MS` | `150` / `60000` | Recruiter route group, user-ID-keyed |
| `RATE_LIMIT_CANDIDATE_MAX` / `_WINDOW_MS` | `150` / `60000` | Candidate route group, user-ID-keyed |
| `RATE_LIMIT_UPLOAD_MAX` / `_WINDOW_MS` | `10` / `600000` | All file uploads, user-ID-keyed |
| `RATE_LIMIT_SEARCH_MAX` / `_WINDOW_MS` | `300` / `60000` | Job search/browse/recommendations, IP-keyed |

---

## 4.2 Frontend Environment Configuration (`frontend/.env`)

* **`VITE_API_URL`**: (Required in production) The absolute URL of the backend API server. If missing during a production build, `src/api/client.ts` logs a critical console error and every API call fails.
  * Default: `"http://localhost:5000"`
  * **This is inlined at build time, not read at runtime.** Vite substitutes `import.meta.env.*` into the bundle when it compiles, so changing this value requires a rebuild — setting it as a runtime environment variable on the container or host has no effect. When building the frontend image, pass it as a build argument: `docker build --build-arg VITE_API_URL=https://api.example.com .`
