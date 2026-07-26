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
   * Change `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in your `.env` or platform settings.
   * This immediately logs out all users globally by invalidating their tokens.
   * > **`JWT_ACCESS_SECRET` has a second, easily-forgotten effect:** it is also the HMAC key used to sign private file-download URLs (`shared/utils/fileStorage.ts`). Rotating it invalidates every outstanding file link as well as every session. Both recover automatically when users reload the page, but expect a burst of 403s in the logs immediately afterwards.
2. **Resend Key Rotation**:
   * Create a new key on Resend.
   * Update `RESEND_API_KEY` (and the `SMTP_PASS` fallback) in production.
   * Test the new key using `npm run email:test <recipient>`.
3. **Google OAuth Secret Rotation**:
   * Update `GOOGLE_CLIENT_SECRET` in both the platform environment and Google Cloud Console.
   * Google login is broken between the two updates — do them together.

---

## 20.4 File Storage Maintenance

Uploads live on local disk under `DISK_MOUNT_PATH` (see [4. Environment Variables](04_ENVIRONMENT_VARIABLES.md)). There is no third-party storage provider to administer, which shifts a few responsibilities onto whoever operates the deployment:

* **Disk usage grows unbounded.** Check it monthly. Images are stored at their original dimensions — the resize/compression step that Cloudinary used to perform is not currently reimplemented (it needs `sharp`, see the note in `fileStorage.ts`). Multer's 2 MB image cap bounds the growth but does not optimise it.
* **Orphan audit.** `runOrphanAssetCleanup()` cross-references `Company.logoPublicId` and `CandidateProfile.resumePublicId` against what is actually on disk, reporting files with no owning row and rows pointing at missing files. It is **read-only and never deletes anything** — deletion is deliberately left as a reviewed, manual action.
* **Backups.** The database backup does *not* include uploaded files. Snapshot the storage volume separately, or accept that a restore recovers records whose attachments are gone.
* **Migrating to object storage.** Required before the service can run more than one instance (see [21. Scaling](21_SCALING.md)). A single persistent disk cannot be shared across replicas.

---

## 20.5 Log Audits & Winston Storage

* Logs are written to stdout/stderr in JSON format, which can be captured by cloud providers (like Datadog or Render Log Streams).
* Local logs are stored under `backend/logs/` (rotated daily).
* **Audit Checks**: Search for operator emails or action categories (like `QUEUE_JOB_FAILED_DLQ` or `requirePermission` warnings) to monitor suspicious behaviors.
