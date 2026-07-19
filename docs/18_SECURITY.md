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

* **`HttpOnly` Cookie Configuration**: Refresh tokens are returned in the response header:
  `Set-Cookie: jid=<token>; HttpOnly; Secure; SameSite=Lax; Max-Age=...`
  * **`HttpOnly`**: Blocks JavaScript scripts from reading the cookie (protects against Cross-Site Scripting (XSS) extraction).
  * **`Secure`**: Enforces delivery over encrypted HTTPS connections (enabled in non-development environments).
  * **`SameSite=Lax`**: Restricts cookie delivery on third-party page navigation to protect against Cross-Site Request Forgery (CSRF).

---

## 18.3 Network Policies & Middlewares

### 1. CORS Rules
The server is configured with strict Cross-Origin Resource Sharing (CORS) rules:
* Restricts requests to the explicitly defined client endpoint (`env.CLIENT_URL`).
* **`credentials: true`**: Allows browsers to include HTTP cookies.

### 2. HTTP Security Headers (Helmet)
The Express app loads **`Helmet`** to declare browser headers:
* `Content-Security-Policy` (CSP): Restricts source domains for scripts, styles, and assets.
* `X-Frame-Options: DENY`: Prevents Clickjacking attacks by blocking the page from rendering in frames or iframes.
* `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing attacks.

### 3. File Upload Protections
* **Antivirus Scanning Dry-Run**: Validates incoming file length, type, and structure before processing.
* **Multer Restrictions**: Limits uploads (resumes and logos) to **2 MB** and enforces image/PDF MIME types. Files are handled in-memory (`multer.memoryStorage()`) to prevent malicious disk writes.

---

## 18.4 Audit Trails & Activity Tracking

Critical events publish log entries to the `AuditLog` table:
* **Events Tracked**: `USER_LOGIN`, `USER_REGISTER`, `INVITE_EMPLOYEE`, `APPROVE_JOB`, `REJECT_JOB`, `VERIFY_COMPANY`.
* **Metadata logged**: Client IP address, browser user-agent, target entity, and change logs. Operators are identified securely.
* Winston loggers mask sensitive parameters (like passwords, keys, and tokens) using regex sanitization filters.
