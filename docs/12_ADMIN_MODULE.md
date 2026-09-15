# 12. Admin Module

The Admin Module provides platform operators with tools for verifying employers, moderating job postings, tracking user behaviors, and managing platform states.

---

## 12.1 Company Verification Workflow

Recruiters cannot access key features until their company is approved.
1. **Onboarding**: A recruiter registers and creates a company profile, uploading verification documents (GST, corporate licenses, etc.). The company status is initialized to `pending`.
2. **Review Console (`CompanyApprovals.tsx`)**:
   * Admin reviews the verification documents and metadata.
   * Admin can download the documents via direct links.
3. **Action Triggers**:
   * **Approve**: Promotes company status to `approved`. The company benefit badges (like Menstrual Leave Champion) are automatically verified, and the recruiter user receives an approval notification email.
   * **Reject**: Rejects the application, updating the company status and disabling recruiter posting features.
   * **Request Info**: Asks for additional documents.

---

## 12.2 Job Moderation Lifecycle

All new jobs require admin approval before becoming visible on candidate boards:
1. **Moderation Queue (`JobModeration.tsx`)**: Lists jobs in the `pending_approval` status, showing salary, location, work mode, and requirements.
2. **Action Console**:
   * **Approve**: Updates job status to `approved` and visibility to `visible`. The system triggers candidate matching algorithms, creates candidate notifications, and emails the recruiter.
   * **Reject**: Promotes job status to `rejected`, prompting the admin to input a rejection note (stored in the database) which is forwarded to the recruiter.

---

## 12.3 User Moderation & Suspensions

Admin controls user accounts inside `UserModeration.tsx`:
* **Search & Filters**: Allows filtering users by role (`Candidate`, `Recruiter`, `Admin`) and status (`Active`, `Blocked`, `Suspended`, `PendingVerification`).
* **Actions**:
   * **Suspend**: Updates status to `Suspended`.
   * **Block**: Updates status to `Blocked`.
   * **Activate**: Promotes status to `Active`.
* **Security Side Effects**: Blocking or suspending a user invalidates their permission cache in Redis and revokes all active session refresh tokens, immediately logging them out of active browser windows.

---

## 12.4 Feature Configurations & Flags

Platform feature states are toggled dynamically inside `FeatureConfigs.tsx`:
* Features are managed via the `FeatureFlag` table.
* **The only flag actually seeded and surfaced today is `email_automation`.** `chat_enabled`, `push_notifications`, `advanced_analytics`, `experimental_sockets`, and `mfa_enforced` are deliberately excluded by `AdminService.getFeatureFlags()` (a `RETIRED_UNIMPLEMENTED_FLAG_KEYS` filter) and no longer seeded by `seed.ts` — nothing in the codebase ever branched on them (no push delivery mechanism, no analytics gate, no MFA-enforcement check in the login flow), and real-time chat itself has since been removed from the app (see [6. Backend](06_BACKEND.md) §6.3). Any pre-existing rows for these keys in an older database are left dormant rather than deleted, so they simply stop appearing on this page after an upgrade.
* Two-factor authentication (per-user opt-in TOTP) **is** fully implemented — enrollment, login challenge, and disable — but it is not gated by a feature flag at all; every user can enable it individually from their own Settings page. See `backend/src/modules/auth/auth.routes.ts` (`/2fa/enroll/start`, `/2fa/enroll/confirm`, `/2fa/verify`, `/2fa/disable`).
* Admin can click the remaining live toggle (`email_automation`) to immediately enable or disable automated mailing globally.

---

## 12.5 System Audit Logs & Health Diagnostics

* **Audit Logs (`ActivityLogs.tsx`)**: Renders system action logs. The list supports pagination and filtering by category (`ADMIN`, `RECRUITER`, `CANDIDATE`, `SYSTEM`), entity, and operator ID. Logs contain details like IP address, browser metadata, and before/after state changes.
* **System Health (`SystemHealth.tsx`)**: Displays platform performance parameters:
  * **Database Status**: Verifies active Prisma query latency.
  * **Redis Cache**: Displays connection state and memory occupancy.
  * **Email Service**: Shows startup verification checks.
  * **File Storage**: Writes and deletes a probe file to confirm the disk mount is genuinely writable, not merely configured.
