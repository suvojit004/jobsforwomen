# 20. Maintenance Guide

This document describes tasks for maintaining system health, upgrading libraries, and updating secrets.

---

## 20.1 Upgrades & Dependency Maintenance

* **Node Version**: Locked at Node.js `v22.x` inside `package.json`. Do not upgrade to version `24+` in production without verifying native binary packages (such as `bcrypt`).
* **Prisma Upgrades**:
  * Run updates inside `/backend` only.
  * To upgrade Prisma schema client engines:
    ```bash
    cd backend
    npm install prisma@latest @prisma/client@latest --save-dev
    npx prisma generate
    ```
* **React/Vite Upgrades**:
  * Run packages update inside `/frontend`.
  * After updating any chunk-loading routes or Vite bundles, confirm the stale deployment recovery logic inside the `ErrorBoundary` compiles cleanly.

---

## 20.2 Managing Database Migrations

### 1. Creating a Migration
When modifying `schema.prisma`:
1. Navigate to `/backend`.
2. Generate the SQL migration file locally:
   ```bash
   npx prisma migrate dev --name your_migration_name
   ```
3. This creates a directory under `prisma/migrations/` containing `migration.sql`.

### 2. Production Migrations
> [!WARNING]
> Do NOT use `npx prisma migrate dev` in production as it can cause data loss.
> Use the deployment command:
> ```bash
> npx prisma migrate deploy
> ```
> This applies pending migrations safely.

---

## 20.3 Secret Rotations & Audits

If access keys are leaked or rotated:

1. **JWT Secret Rotation**:
   * Change `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in your `.env` or Render/Vercel settings.
   * This immediately logs out all users globally by invalidating their tokens.
2. **Resend Key Rotation**:
   * Create a new key on Resend.
   * Update `RESEND_API_KEY` (and `SMTP_PASS` fallback) in production.
   * Test the new key using `npm run email:test <recipient>`.
3. **Cloudinary Key Rotation**:
   * Update `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`.
   * Test file uploads and deletes on candidate resumes or recruiter logos to verify access.

---

## 20.4 Log Audits & Winston Storage

* Logs are written to stdout/stderr in JSON format, which can be captured by cloud providers (like Datadog or Render Log Streams).
* Local logs are stored under `backend/logs/` (rotated daily).
* **Audit Checks**: Search for operator emails or action categories (like `QUEUE_JOB_FAILED_DLQ` or `requirePermission` warnings) to monitor suspicious behaviors.
