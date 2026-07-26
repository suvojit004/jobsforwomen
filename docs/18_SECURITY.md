# 18. Security Documentation

The platform incorporates security guidelines and implementations to protect company profiles, candidate resumes, and transactional endpoints.

---

## 18.1 Cryptography & Secret Keys

* **Password Hashing**: User passwords are encrypted using **`bcrypt`** with a work factor of **`10 rounds`** before storage. Clear passwords are never written to disk or logged.
* **Token Signatures**:
  * Access tokens are signed using HMAC SHA-256 (`JWT_ACCESS_SECRET`).
  * Refresh tokens are signed using a separate secret (`JWT_REFRESH_SECRET`).
  * If secrets are compromised, modifying them invalidates all active sessions globally.

---

## 18.2 Session & Cookie Security

* **`HttpOnly` Cookie Configuration**: Refresh tokens are returned as:
  `Set-Cookie: jid=<token>; HttpOnly; Secure; SameSite=None; Path=/api/v1/auth/refresh; Max-Age=...`
  * **`HttpOnly`**: Blocks JavaScript from reading the cookie (protects against XSS extraction).
  * **`Secure`**: Enforced in all non-local environments.
  * **`SameSite`**: `None` in production (the SPA and API are on different origins, so the cookie must be sent cross-site); `Lax` for local development. `Secure` and `SameSite=None` must be set together or browsers reject the cookie.
  * **`Path` scoping**: the cookie is scoped to `/api/v1/auth/refresh` only, so it is never transmitted to any other endpoint. This narrows CSRF exposure to the refresh route alone.
* **Access tokens are not cookies.** They are held in `localStorage` and sent as `Authorization: Bearer <token>`. Anything assuming cookie-based auth works across the API is incorrect.

---

## 18.3 Network Policies & Middlewares

### 1. CORS Rules
The server is configured with strict Cross-Origin Resource Sharing (CORS) rules:
* Requests are restricted to an explicit allowlist: `localhost:5173`, `localhost:3000`, the known Vercel origin, plus `env.CLIENT_URL` and `env.FRONTEND_URL`.
* **`credentials: true`**: Allows browsers to include HTTP cookies.
* The allowlist is declared in **two** files that must stay in sync — `shared/socket/socket.ts` maintains its own copy for Socket.IO handshakes. Updating only `app.ts` produces a deployment where REST works and WebSockets silently fail.

### 1a. Rate Limiting
Seven tiers protect against brute force and abuse, Redis-backed with an in-process fallback. The auth tier (login, register, password reset, OAuth) is deliberately the strictest at 10 requests per 15 minutes per IP. Authenticated tiers are keyed by user ID rather than IP, so one user behind a shared or NAT'd address cannot degrade service for others, and cannot evade the limit by changing IP. See [4. Environment Variables](04_ENVIRONMENT_VARIABLES.md) for the tunable ceilings.

### 2. HTTP Security Headers (Helmet)
The Express app loads **`Helmet`** to declare browser headers:
* `Content-Security-Policy` (CSP): Restricts source domains for scripts, styles, and assets.
* `X-Frame-Options: DENY`: Prevents Clickjacking attacks by blocking the page from rendering in frames or iframes.
* `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing attacks.

### 3. File Upload Protections
* **Structural validation only — not antivirus.** `scanFileForVirus()` rejects empty buffers and verifies the file's magic bytes match its declared MIME type, which catches a renamed executable. It performs **no malware scanning**; no ClamAV/VirusTotal-style engine is wired in. Do not represent this as malware protection.
* **Multer Restrictions**: 10 MB for documents (resumes, verification and perk documents, offer letters) and 2 MB for images (logos, gallery photos), with per-surface MIME allowlists. Files are handled in-memory (`multer.memoryStorage()`) before being written to disk.
* **Path traversal defence**: the `/files` route rejects filenames containing `..` or `/`, validates the folder type against a known set, and confirms the resolved absolute path is still inside `DISK_MOUNT_PATH`.
* **Signed, time-limited URLs**: private documents (resumes, offer letters, perk and verification documents) are served only with a valid HMAC-SHA256 signature and a 1-hour expiry, compared using `crypto.timingSafeEqual`. Public assets (logos, gallery) are served unsigned. Signatures are generated automatically for every `/files/` URL in any API response.

### 4. Known Security Gaps
* **The seed script creates `admin@jobsforwomen.info` with password `admin123` in `Active` status.** Change or delete this account before any environment is publicly reachable.
* **No malware scanning** on uploads (see above).
* **Swagger UI at `/api/v1/api-docs` is unauthenticated.** Decide deliberately whether it should be reachable in production.
* **`BYPASS_EMAIL_VERIFICATION`** must never be set in a deployed environment; it allows account activation without proving email ownership.

---

## 18.4 Audit Trails & Activity Tracking

Critical events publish log entries to the `AuditLog` table:
* **Events Tracked**: `USER_LOGIN`, `USER_REGISTER`, `INVITE_EMPLOYEE`, `APPROVE_JOB`, `REJECT_JOB`, `VERIFY_COMPANY`.
* **Metadata logged**: Client IP address, browser user-agent, target entity, and change logs. Operators are identified securely.
* Winston loggers mask sensitive parameters (like passwords, keys, and tokens) using regex sanitization filters.
