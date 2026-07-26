# 19. Testing Guide

This guide explains the test automation framework and manual quality assurance workflows for platform components.

---

## 19.1 Backend Automated Test Suite (Jest)

The backend uses **Jest** with `ts-jest` for automated unit and integration tests.

### 1. Running Tests
Navigate to `/backend` and execute:
```bash
npm run test
```
The suite executes in serial mode (`--runInBand`) to prevent write conflicts on mock databases and Redis instances.

Under `NODE_ENV=test` two behaviours change deliberately: **rate limiting is bypassed entirely** (every tier calls `next()` immediately), and **queues use in-memory mocks** that execute jobs synchronously instead of connecting to Redis.

### 2. Test Architecture
Tests are grouped under their respective feature domains (e.g. `src/modules/candidate/candidate.test.ts`, `src/shared/utils/email.test.ts`, etc.).
* **Mocks Setup**:
  * **Database**: Prisma operations are mocked inline using `jest.mock("../database/db")` to intercept queries and return deterministic records without hitting a live database.
  * **Redis**: Redis caches and clients are mocked in `redis.ts` mocks.
  * **Email**: The Resend client is mocked to prevent sending real emails.
  * **File Uploads**: `shared/utils/fileStorage` is mocked in module tests; `infrastructure.test.ts` exercises real disk I/O against a temporary `DISK_MOUNT_PATH` and cleans up afterwards.

---

## 19.2 Direct Email & Queue Tests

New integration tests verified in `email.test.ts` include:
1. **API Invocations**: Verifies `EmailService` invokes the mocked Resend client with correct recipient, subject, and HTML parameters.
2. **Error Throwing**: Confirms that if Resend returns an `error` object, `EmailService.sendMail` throws a detailed Error.
3. **Missing ID Handling**: Ensures that if Resend returns data without a message ID (`data?.id`), the service fails.
4. **Queue Worker Propagation**: Verifies that email delivery failures propagate up, causing the BullMQ worker job to fail.

---

## 19.3 Regression Testing Checklist

Before pushing changes to staging, verify the following:

| System | Component | Test Scenario | Expected Result |
| :--- | :--- | :--- | :--- |
| **Auth** | Login / Signup | Register, then request a login. | Receives accessToken, cookie is set. |
| **Auth** | Token Refresh | Expire accessToken. Trigger call to `/refresh`. | Client automatically receives a new accessToken. |
| **Candidate** | Profile Save | Edit Candidate phone/location, save, and log out/log in. | Details persist and rehydrate. |
| **Candidate** | Resume Upload | Upload PDF, wait for complete, and refresh. | Resume metadata displays instantly, completion rate updates. |
| **Candidate** | Apply Now | Click "Apply Now" on dashboard job card. | Button displays "Applying..." (disabled), then "Applied". |
| **Recruiter** | Post Job | Fill forms, post job, and redirect. | Redirects to `/recruiter/manage-jobs`, status is `pending_approval`. |
| **Admin** | Moderation | Admin approves job. Recruiter and matching candidates receive notifications. | Real-time counts increment; notifications database entry is created. |
| **Sockets** | Re-auth | Token refreshes while Socket is open. | Socket updates token and reconnects without losing listeners. |
| **Messaging** | Optimistic send | Send a chat message. | Bubble appears instantly, dimmed with a clock icon, then resolves to a normal timestamp on confirmation. |
| **Loading** | Skeletons | Hard-refresh any dashboard or list page. | A content-shaped skeleton renders — never a blank screen or raw "Loading..." text. |
| **Files** | Persistence | Upload a file, redeploy, reopen it. | File still opens. Failure here means `DISK_MOUNT_PATH` is not on persistent storage. |
| **Files** | Signed URL expiry | Leave a page open >1 hour, click a private file link. | 403 with an "expired link" message; reloading the page restores access. |
