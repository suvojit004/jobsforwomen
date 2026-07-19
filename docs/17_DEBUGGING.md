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

## 17.3 Email dispatch Issues (Resend)

### 1. Email Fails with 403 Forbidden Error
* **Symptom**: User registration succeeds but worker fails on Welcome email. Logs show: `[EmailService] Resend provider rejected email status=403`.
* **Diagnostics**:
  * Resend accounts in sandbox/test mode are restricted to sending emails **only to the account owner's email address** (e.g. `rksrivastava23-cse@bvucoep.edu.in`).
  * Sending to other addresses (like `srivastavarishitkumar@gmail.com`) fails with a 403 sandbox restriction.
* **Fix**:
  * Use the account owner's email for testing.
  * Alternatively, verify a custom sending domain in the Resend console and update the `SMTP_FROM` variable in `.env`.

### 2. Running Direct Diagnostic Test
* **Symptom**: Need to verify the email provider credentials without testing the full signup flow.
* **Fix**: Run the direct CLI diagnostic script:
  ```bash
  cd backend
  npm run email:test <your-email-address>
  ```
  Check the console output. If successful, it displays the Resend provider message ID: `[EmailService] Resend accepted email id=<id>`.

---

## 17.4 Cloudinary Storage Issues

### 1. Company Logo Upload fails with HTTP 400
* **Symptom**: Recruiter uploads a logo, but the upload fails.
* **Diagnostics**:
  * Cloudinary credentials missing or incorrect in `.env` (check Zod validation logs at startup).
  * File size exceeds the **2 MB limit** or file format is unsupported (only PNG, JPEG, GIF, and WEBP are allowed).
* **Fix**: Check file details and check backend Multer configuration validations.
