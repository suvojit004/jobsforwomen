# 4. Environment Variables

Both the backend and frontend systems require environment variables to operate. In the backend, variable schemas are validated at runtime using Zod inside `backend/src/shared/config/env.ts`. If any required variable is missing or malformed, the server exits immediately with code `1`.

---

## 4.1 Backend Environment Configuration (`backend/.env`)

### 1. General Settings
* **`NODE_ENV`**: (Required) Defines the system running mode.
  * Options: `development` | `production` | `test`
  * Default: `development`
* **`PORT`**: (Optional) The port the Express HTTP server binds to.
  * Default: `5000`

### 2. Database Settings
* **`DATABASE_URL`**: (Required) PostgreSQL connection string for Prisma. Includes credentials, port, host, and database name.
  * Example: `"postgresql://user:password@localhost:5432/jobsforwomen_db?schema=public"`

### 3. Caching & Message Queues
* **`REDIS_URL`**: (Required) Connection URL for Redis. Used for BullMQ queues and permission cache checks.
  * Example: `"redis://127.0.0.1:6379"`
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

### 6. Cloudinary File Uploads
* **`CLOUDINARY_CLOUD_NAME`**: (Required) Cloud name from the Cloudinary dashboard.
* **`CLOUDINARY_API_KEY`**: (Required) Cloudinary API key.
* **`CLOUDINARY_API_SECRET`**: (Required) Cloudinary API secret key.

### 7. Resend Email Transport Settings
* **`RESEND_API_KEY`**: (Required/Canonical) The API key for the Resend Node.js SDK (starts with `re_`). If omitted, the system falls back to `SMTP_PASS` for backwards compatibility.
* **`SMTP_PASS`**: (Deprecated Backwards-Compatible Fallback) Also accepted as the Resend API Key if `RESEND_API_KEY` is not set.
* **`SMTP_FROM`**: (Required) The sender identity used on all platform email dispatches.
  * Default: `"JobsForWomen <onboarding@resend.dev>"`
* **`SUPPORT_EMAIL`**: (Optional) The system mailbox that receives "Contact Support" ticket emails. Falls back to `SMTP_USER` if not configured.

### 8. Google OAuth Setup
* **`GOOGLE_CLIENT_ID`**: (Required) Client ID from Google Cloud Console Credentials.
* **`GOOGLE_CLIENT_SECRET`**: (Required) Client Secret from Google Cloud Console Credentials.
* **`GOOGLE_CALLBACK_URL`**: (Required) Callback redirect URL registered in Google Console.
  * Default: `"http://localhost:5000/api/v1/auth/google/callback"`

### 9. Platform Policy Rules
* **`PROFILE_COMPLETION_THRESHOLD`**: (Optional) The minimum profile completion percent required for candidates to submit job applications.
  * Default: `70`
* **`BYPASS_EMAIL_VERIFICATION`**: (Optional) Set to `true` to allow newly registered users to register in `Active` status immediately (bypassing validation links). Used for staging or local offline tests.

---

## 4.2 Frontend Environment Configuration (`frontend/.env`)

* **`VITE_API_URL`**: (Required) The absolute URL of the backend API server. If missing during production builds, the client throws a console error.
  * Default: `"http://localhost:5000"`
