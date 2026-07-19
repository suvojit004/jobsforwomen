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

Middlewares are located in `backend/src/modules/rbac/rbac.middleware.ts` and `backend/src/shared/middlewares/`:

1. **Authentication Guard (`requireAuth`)**:
   * Extracts the access token from HTTP headers (`Authorization: Bearer <token>`) or client cookies.
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

Real-time capabilities are driven by **Socket.IO** (located in `backend/src/sockets/`):
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
* **Queue Names**: `email`, `notifications`, `cleanup`, `reports`.
* **Retry Policy**: Default configurations specify up to 3 retries per job using an **exponential backoff delay** (starting at 5000ms).
* **Workers**:
  * **`email`**: Process and send transactional emails via Resend.
  * **`cleanup`**: Periodic tasks to close expired job postings, expire unaccepted colleague invitations, and prune old read notifications.
  * **`reports`**: Generates and compiles analytical reports.
* **Dead Letter Queue (DLQ)**: On exhausting the retry limit, the worker captures the failure and creates an `AuditLog` database record with category `"SYSTEM"` and action `"QUEUE_JOB_FAILED_DLQ"`.
