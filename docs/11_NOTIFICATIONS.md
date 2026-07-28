# 11. Notification System

The platform features a multi-channel notification engine delivering alerts via the Database, live WebSockets (Socket.IO), and transactional Emails (AWS SES).

---

## 11.1 Trigger Event Pipeline

Platform operations dispatch events to the backend **`EventBus`** (a Node.js EventEmitter-based pub/sub engine). The **`NotificationListener`** (`backend/src/shared/listeners/notification.listener.ts`) subscribes to these events and triggers dispatches.

```
[Platform Action]
       │
       ▼
  [EventBus]
       │
       ├─► [Database Worker] ──► Write to Notification Table
       │
       ├─► [Socket.IO Server] ──► Emit Event to User Namespace Room
       │
       └─► [BullMQ Queue] ──► Redis Job ──► Email Worker (AWS SES v2)
```

---

## 11.2 Core Events & Handlers

### 1. `JobSubmittedForApproval`
* **Trigger**: A recruiter submits a job posting for review.
* **Database Alert**: Created for all active Admin/Super Admin users (`category: "Moderation"`, `actionUrl: "/admin/job-moderation"`).
* **Socket Emit**: Emailed to admin namespace clients.

### 2. `JobApproved`
* **Trigger**: Admin approves a job.
* **Database Alert**: Mapped to the recruiter (`category: "Moderation"`, `actionUrl: "/recruiter/jobs/<jobId>"`).
* **Candidate Match Scan**: The system executes `findMatchedCandidateUserIds` querying candidates matching the job's skills and location, creating database matches (`category: "Job"`, `actionUrl: "/candidate/jobs/<jobId>"`) and broadcasting to online candidates.
* **Email Queue**: Adds a BullMQ job `sendJobModeration` to email the recruiter.

### 3. `JobRejected`
* **Trigger**: Admin rejects a job posting, submitting a note/reason.
* **Database Alert**: Created for the recruiter detailing the rejection reason.
* **Email Queue**: Adds a job `sendJobModeration` with the rejection reason.

### 4. `CompanyApproved` / `CompanyRejected`
* **Trigger**: Admin approves/rejects a recruiter's company application.
* **Database Alert**: Emailed to recruiter with status update.
* **Email Queue**: Adds a job `sendCompanyVerification` to email the recruiter.

---

## 11.3 Real-Time WebSockets namespaces & Rooms

Live alerts are routed via custom namespace controllers (`backend/src/sockets/`):
1. On socket connection, the client authenticates using their JWT token.
2. The user is automatically joined to a room named after their unique database ID: `socket.join(userId)`.
3. When `NotificationListener` triggers, it determines the recipient's user ID and emits:
   ```typescript
   io.of(namespace).to(userId).emit("notification", newNotificationPayload)
   ```
This updates the notification count badge in real time in the user's sidebar.

---

## 11.4 Idempotency Guard (Deduplication)

To prevent duplicate alerts (e.g. from network failures or multiple Admin clicks), notifications utilize `dedupeKey` constraints:
* Unique constraints are configured on the database `Notification.dedupeKey` column.
* Dedupe keys are built deterministically:
  * Company Approval: `company-approved:<companyId>`
  * Job Match Alert: `job-approved-candidate:<jobId>:<candidateUserId>`
  * Job Submission: `job-submitted:<jobId>:<adminId>`
* If a duplicate event fires, PostgreSQL throws a unique-constraint exception, which is caught and handled to prevent duplicates.
