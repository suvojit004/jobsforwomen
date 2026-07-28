# 17. Debugging Guide

This guide outlines diagnostic procedures and resolutions for common issues across the platform's systems.

---

## 17.1 Authentication & Token Failures

### 1. Infinite Login Redirect Loops
* **Symptom**: User logs in but gets immediately redirected back to `/auth/login` in an endless loop.
* **Diagnostics**:
  * Check the browser console. If there are 401 responses on `/api/v1/auth/me` or profile endpoints immediately after login, the access token is invalid.
  * Inspect cookies. If the HttpOnly `jid` cookie is missing, the backend failed to set it (often due to `SameSite=None` without `Secure` headers in local HTTP, or domain mismatches).
* **Fix**: Ensure your backend `.env` is configured with the correct `CLIENT_URL` so CORS policies allow sending cookies.

### 2. Google OAuth Callback Redirect Failure
* **Symptom**: Clicking "Login with Google" authenticates on Google, but redirects to an error screen.
* **Diagnostics**:
  * Check the Google Cloud Console credentials dashboard. Verify `GOOGLE_CALLBACK_URL` matches the backend endpoint: `https://api.yourdomain.com/api/v1/auth/google/callback`.
  * Ensure the backend can resolve Google token endpoints (check backend logs for network/timeout errors).

---

## 17.2 Database & Prisma Issues

### 1. Migration Lockups / Version Mismatch
* **Symptom**: `npx prisma migrate dev` fails with database locks.
* **Diagnostics**:
  * Execute `SELECT * FROM pg_stat_activity WHERE state = 'active';` to check for active queries.
  * Running command from root: `npx prisma studio` requests installing prisma v7.
* **Fix**: Always navigate inside `/backend` first before running prisma: `cd backend && npx prisma studio`.

---

## 17.3 Email dispatch Issues (AWS SES)

### 1. `MessageRejected: Email address is not verified`
* **Symptom**: Registration succeeds but the welcome email never arrives. Logs show `[EmailService] SES permanently rejected mail to ... MessageRejected`.
* **Cause**: The SES account is in **sandbox mode**, which only delivers to individually verified *recipient* addresses. This is the single most common email failure before production access is granted.
* **Important**: verifying the sending **domain** does not lift this. The restriction is on recipients.
* **Fix**: verify the recipient (SES console → Identities → Create identity → Email address), send to an already-verified address, or wait for production access.
* The app classifies this as a **permanent** failure, so the job fails once rather than retrying three times and burning three sends from a small daily quota.

### 2. `TooManyRequestsException` / throttling
* **Symptom**: Intermittent send failures under load.
* **Cause**: Exceeding the SES per-second send rate (1/sec on a sandbox account).
* **Fix**: The email worker is already rate-limited to `SES_MAX_SEND_RATE_PER_SEC` (default 1) with `concurrency: 1`. If this still occurs, lower that value; if production access raised your quota, raise it to match.

### 3. Daily quota exhausted
* **Symptom**: Sends fail late in the day after working earlier.
* **Cause**: Sandbox accounts allow roughly 200–240 messages per 24 hours.
* **Diagnostics**: `npm run email:test <addr>` prints `SentLast24Hours` against `Max24HourSend`.
* **Watch out for digests**: the daily/weekly digest jobs enqueue **one email per candidate**. At any real user count that alone exceeds a sandbox quota. (Those jobs do not currently run — see the scheduler note in the runbook — but they will the moment the scheduler is wired up.)

### 4. `CredentialsProviderError`
* **Cause**: `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` are unset and no instance role or local AWS profile is available.
* **Fix**: Set both explicitly. Render has no instance role, so they are mandatory there.

### 5. Wrong region
* **Symptom**: `MessageRejected` mentioning the identity, despite the domain being verified.
* **Cause**: SES identities are **regional**. A domain verified in `ap-south-1` does not exist in another region.
* **Fix**: Confirm `AWS_SES_REGION` matches the region the domain was verified in.

### 6. Bounce/complaint events not arriving
* **Cause**: SES only publishes events when a **configuration set** with an SNS event destination is attached, and the SNS subscription must be confirmed before anything is delivered.
* **Fix**: Set `SES_CONFIGURATION_SET` (and `SNS_TOPIC_ARN`), then confirm the subscription — the `/api/v1/emails/sns` endpoint confirms automatically on first contact. Check the SNS console shows the subscription as *Confirmed*, not *Pending confirmation*.

### 7. Running the Direct Diagnostic Test
* **Symptom**: Need to verify email configuration without going through a full signup.
* **Fix**:
  ```bash
  cd backend
  npm run email:test <your-email-address>
  ```
  It prints the region, sender, and credential source, then calls SES `GetAccount` (which consumes no sending quota) to report sandbox status and remaining quota, and only then sends. On success you get `[EmailService] SES accepted email id=<MessageId>`.

---

## 17.4 File Storage Issues (Local Disk)

Files are written to `DISK_MOUNT_PATH/jfw/<type>/` and served back through `GET /files/jfw/:type/:filename`. Public types (`logos`, `gallery`) need no signature; private types (`resumes`, `offer-letters`, `perk-documents`, `company-verification`) require a valid `?exp=&sig=` pair with a 1-hour TTL.

### 1. Company Logo Upload fails with HTTP 400
* **Symptom**: Recruiter uploads a logo, but the upload fails.
* **Diagnostics**:
  * File size exceeds the **2 MB limit** for images, or the format is unsupported (only PNG, JPEG, GIF, and WEBP are allowed).
  * The file's magic bytes don't match its declared MIME type — `scanFileForVirus()` rejects renamed files, logging `[FileSecurity] Rejected upload: file content does not match declared type`.
* **Fix**: Check the file, then the Multer configuration in `shared/middleware/upload.middleware.ts`. Resumes, verification documents, perk documents, and offer letters use a 10 MB limit; logos and gallery photos use 2 MB.

### 2. Upload fails with `EACCES` (permission denied)
* **Symptom**: Every upload fails in a containerised deployment.
* **Cause**: The storage volume mounted at `DISK_MOUNT_PATH` is root-owned, but the container runs as the non-root `node` user.
* **Fix**: The `Dockerfile` creates `/app/uploads` *before* `chown -R node:node /app` precisely to avoid this — Docker copies a directory's existing ownership into a volume on first mount. If you edited the Dockerfile, restore that ordering.

### 3. Private file link returns HTTP 403
* **Symptom**: "This link has expired or is invalid. Reload the page to get a fresh link."
* **Cause**: The signed URL is older than its 1-hour TTL, or `JWT_ACCESS_SECRET` (which is also the file-signing secret) was rotated.
* **Fix**: Reload the page — API responses re-sign URLs on every request. This is working as designed, not a fault.

### 4. Previously-uploaded files return HTTP 404
* **Symptom**: Files that used to open now 404, typically right after a deploy.
* **Cause**: `DISK_MOUNT_PATH` is not pointing at genuinely persistent storage, so the ephemeral container filesystem was wiped on redeploy.
* **Fix**: Mount real persistent storage and set `DISK_MOUNT_PATH` to it (see [16. Build & Deployment](16_DEPLOYMENT.md)). **Files already lost this way are unrecoverable** and must be re-uploaded.

---

## 17.5 Rate Limiting (HTTP 429)

* **Symptom**: Requests rejected with `429 Too many requests`.
* **Diagnostics**: Read the `X-RateLimit-Limit` header on the 429 response — it tells you *which tier* rejected the request. The global tier (100 req/60s per IP) is stricter than most others and is evaluated first, so a client bursting toward a higher tier's ceiling is usually stopped by the global limiter instead.
* **Fix**: For legitimate traffic, raise the relevant `RATE_LIMIT_*_MAX` environment variable and restart — no code change needed. For load testing, pace requests below 100/min so the intended tier is the one being exercised.

---

## 17.6 Queues and Background Jobs

* **Symptom**: No emails are sent, but the site otherwise works normally.
* **Cause**: BullMQ requires Redis. When Redis is unreachable the app degrades gracefully everywhere else (rate limiting falls back to in-process counters, the permission cache is bypassed) but **queues stop entirely** — so "emails stopped, site fine" is the classic Redis-down signature.
* **Diagnostics**: `GET /health` reports queue metrics; the admin System Health page reports Redis status and the pending dead-letter count.
* **Jobs that failed permanently**: after 3 attempts with exponential backoff, a job is moved to the `dead-letter` queue and an `AuditLog` row is written with action `QUEUE_JOB_FAILED_DLQ` (payloads are sanitized — tokens and passwords are redacted). Nothing consumes the dead-letter queue; it is an inspection area. There is no automated replay, so fix the root cause and re-trigger the originating action.
