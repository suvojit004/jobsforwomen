# 6. Backend Documentation

The backend service is built using Node.js, Express, and TypeScript. It relies on Prisma for database access and BullMQ for background queues.

---

## 6.1 Architectural Patterns

The backend follows a modular **Controller-Service-Repository** pattern:
* **Controllers**: Receive HTTP requests, validate parameters (using Zod validation schemas), and pass parameters to service handlers. They formulate HTTP responses using standard utility wrappers.
* **Services**: Contain business rules and transaction logic. They perform calculations, publish events to the platform's EventBus, and interact with the database.
* **Repositories / Database Layer**: Prisma acts as the data access layer. Models and queries are written directly using Prisma Client API.
* **Middlewares**: Intercept incoming traffic for security headers (Helmet), CORS, JSON parsing, logging (Morgan), authentication (JWT decoding), and access control validations.

---

## 6.2 Core Middlewares

Middlewares are located in `backend/src/modules/rbac/rbac.middleware.ts` and `backend/src/shared/middleware/` (singular):

1. **Authentication Guard (`authenticateToken`)**:
   * Extracts the access token from the `Authorization: Bearer <token>` header. **Header only** — it does not read cookies. The only cookie the app sets is the refresh token (`jid`), which is path-scoped to `/api/v1/auth/refresh` and is never sent to other endpoints.
   * Verifies the signature using `env.JWT_ACCESS_SECRET`.
   * Attaches decoded metadata (user ID, roles, email) to the Express Request context (`req.user`).
2. **Access Safeguards**:
   * **`requireActiveUser`**: Asserts the user account status is `"Active"`.
   * **`requireVerifiedEmail`**: Prevents users in `PendingVerification` state from accessing authenticated routes.
   * **`requireProfileCompleted`**: Validates the candidate profile completion percentage exceeds `env.PROFILE_COMPLETION_THRESHOLD` before allowing actions like applying to jobs.
   * **`requireApprovedCompany`**: Ensures a recruiter's company is verified and approved before allowing them to post job vacancies.
   * **`requirePermission(requiredPermissions[])`**: Pulls the permissions associated with a user's roles from the Redis cache and denies access if required permissions are missing.
   * **`requireOwnership(modelName, idParam)`**: Restricts action on resource records (e.g., job postings, applications) to their owners or Admin/Super Admin bypass roles.

---

## 6.3 Real-Time WebSockets & Sockets Configuration

Real-time capabilities are driven by **Socket.IO** (implemented in `backend/src/shared/socket/socket.ts`; note `src/sockets/` is an empty placeholder directory). It is attached to the HTTP server by `initSocket(server)` in `server.ts`:
* **Namespaces**: The server establishes separate Socket namespaces for candidates (`/candidate`), recruiters (`/recruiter`), and admins (`/admin`).
* **Authentication**: Incoming socket requests must pass the `auth.token` parameter. The socket middleware decodes the JWT and validates the signature, joining the socket connection into a specific room named after their `userId`.
* **Events**:
  * `join:conversation`: Connects users to messaging threads.
  * `typing`: Broadcasts typing indicators to other members.
  * `message:send`: Processes incoming messages, writes them to PostgreSQL, and broadcasts them to conversation rooms.
  * `notification`: Used to emit platform updates dynamically.

---

## 6.4 Background Jobs & Queues (BullMQ)

Asynchronous and heavy jobs are delegated to **BullMQ** queues backed by Redis (`backend/src/shared/queue/queue.ts`):
* **Queue Names**: `email`, `notifications`, `audit`, `cleanup`, `reports`, plus a separate `dead-letter` queue.
* **Where they run**: workers are registered as an import side-effect of `queue.ts`, which `app.ts` imports — so they run **inside the API process**, not as a separate service.
* **Retry Policy**: Default configurations specify up to 3 retries per job using an **exponential backoff delay** (starting at 5000ms).
* **Workers**:
  * **`email`**: Process and send transactional emails via AWS SES. Rate-limited to `SES_MAX_SEND_RATE_PER_SEC` (default 1/sec) with `concurrency: 1`, so the app stays inside the SES send-rate quota rather than being throttled by it. Permanent rejections (unverified recipient in sandbox) are re-thrown as BullMQ `UnrecoverableError` so they fail once instead of retrying three times.
  * **`cleanup`**: Periodic tasks to close expired job postings, expire unaccepted colleague invitations, and prune old read notifications.
  * > **Only `email` and `cleanup` have workers registered.** Jobs added to `notifications`, `audit`, or `reports` are enqueued but never processed — they accumulate in Redis indefinitely without failing, so they never surface in failure metrics either.
  * > The repeatable cron schedules in `shared/queue/scheduler.ts` (invitation expiry, job expiry, notification cleanup, daily/weekly digests, monthly reports) are **never registered** — `bootstrapScheduler()` is defined and exported but not called anywhere. None of those periodic tasks currently run.
* **Dead Letter Queue (DLQ)**: On exhausting the retry limit the job is pushed to a real, separate BullMQ `dead-letter` queue preserving the original queue name, job name, sanitized payload, failure reason, and attempt count — and an `AuditLog` record is written with category `"SYSTEM"` and action `"QUEUE_JOB_FAILED_DLQ"`.
  * Payloads are sanitized before storage: keys matching `password|token|secret|apikey|authorization|otp` are replaced with `[REDACTED]`, so raw reset tokens never persist in Redis or the audit log.
  * Nothing consumes the `dead-letter` queue by design — it is a durable inspection area, which is also what makes recursive DLQ handling impossible. There is no automated replay; fix the root cause and re-trigger the originating action.
