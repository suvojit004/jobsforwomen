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

### 7. AWS SES Email Settings

> Email was migrated from Resend to **AWS SES v2**. There are no `SMTP_*` or `RESEND_API_KEY` variables any more — the Zod schema does not accept them.

* **`AWS_SES_REGION`**: (Optional) Default: `ap-south-1`.
  * **SES identities are regional.** The sending domain must be verified in this exact region — a domain verified in `ap-south-1` does not exist in `us-east-1`, and sending from the wrong region fails with `MessageRejected`.
* **`AWS_ACCESS_KEY_ID`** / **`AWS_SECRET_ACCESS_KEY`**: (Optional) When both are set they are used directly. When unset, the SDK's default credential chain applies (EC2/ECS task role, or a local `~/.aws` profile) — which is why they are optional. **On Render there is no instance role, so both must be set.** The IAM user needs only `ses:SendEmail` and `ses:GetAccount`.
* **`SES_FROM`**: (Required, no default) The sender identity. Must be an address on the verified domain.
  * Example: `"JobsForWomen <noreply@mail.jobsforwomen.info>"`
* **`SES_MAX_SEND_RATE_PER_SEC`**: (Optional) Default: `1`. Client-side send-rate ceiling enforced by the BullMQ email worker, so the app never exceeds the SES quota and gets throttled. Raise it to match the granted rate once production access is approved.
* **`SES_CONFIGURATION_SET`**: (Optional) Name of an SES configuration set. Required **only** if you want bounce/complaint events published to SNS. Omitted from the send request entirely when unset.
* **`SNS_TOPIC_ARN`**: (Optional) ARN of the SNS topic the configuration set publishes to. When set, `/api/v1/emails/sns` rejects notifications from any other topic; when unset it accepts any and logs a warning.
* **`SUPPORT_EMAIL`**: (Optional) The system mailbox that receives "Contact Support" ticket emails. Falls back to `SES_FROM` if not configured.

#### Sandbox mode

A new SES account starts in **sandbox mode**, which is a recipient restriction, not a sending-domain one:

* Mail is delivered **only to individually verified recipient addresses.** Verifying the sending domain does not lift this.
* Quotas are capped (typically 200–240 messages/24h at 1 message/second).
* Anything sent to an unverified recipient fails with `MessageRejected: Email address is not verified`.

The application treats that rejection as **permanent** rather than retryable, so it fails once instead of consuming three attempts of a small daily quota. Check live status any time with `npm run email:test <addr>`, which calls SES `GetAccount` and prints production-access status and remaining quota before sending anything.

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
