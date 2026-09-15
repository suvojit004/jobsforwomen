# 8. API Reference

All requests must set `Content-Type: application/json` unless uploading files (which must use `multipart/form-data`).

Authenticated routes require an `Authorization: Bearer <token>` header. **Cookies are not used for API authentication** — the only cookie the platform sets is the refresh token (`jid`), which is `HttpOnly` and path-scoped to `/api/v1/auth/refresh`, so it is never sent to any other endpoint.

All responses are wrapped as `{ "success": boolean, "message": string, "data": ... }`. Any `/files/jfw/...` URL appearing anywhere in a response is automatically signed with a 1-hour expiry.

---

## 8.1 Authentication Endpoints (`/api/v1/auth`)

### 1. User Registration
Registration is split into **two role-specific endpoints**. There is no single `/auth/register` route.

* **`POST /api/v1/auth/register/candidate`**
  * **Payload**:
    ```json
    {
      "email": "user@email.com",
      "password": "securepassword123",
      "fullName": "Asha Verma"
    }
    ```
* **`POST /api/v1/auth/register/recruiter`**
  * **Payload**: as above, plus `phone`, `companyName`, `website`, `location`, and `industry`.
* **Response (201 Created)**:
    ```json
    {
      "success": true,
      "message": "User registered successfully.",
      "data": {
        "userId": "uuid-string",
        "email": "user@email.com",
        "status": "PendingVerification"
      }
    }
    ```
* Both create the account in `PendingVerification` status and dispatch a verification email. Recruiters additionally require admin approval of their company before they can log in.

### 2. User Login
* **`POST /api/v1/auth/login`**
  * **Description**: Auths user credentials and returns a JWT. Sets an HttpOnly cookie containing the refresh token.
  * **Payload**:
    ```json
    {
      "email": "user@email.com",
      "password": "securepassword123"
    }
    ```
  * **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "accessToken": "jwt-access-token-string",
        "user": {
          "id": "uuid-string",
          "email": "user@email.com",
          "roles": ["Candidate"]
        }
      }
    }
    ```

### 3. Refresh Access Token
* **`POST /api/v1/auth/refresh`**
  * **Description**: Generates a new access token using the HttpOnly refresh token cookie.
  * **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "accessToken": "new-jwt-access-token"
      }
    }
    ```

---

## 8.2 Candidate Endpoints (`/api/v1/candidates`)

### 1. Get Candidate Profile
* **`GET /api/v1/candidates/profile`**
  * **Permissions**: Authenticated user with role `Candidate`.
  * **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "profile": {
          "id": "profile-uuid",
          "fullName": "Priya Sharma",
          "title": "Software Engineer",
          "phone": "+91 98765 43210",
          "location": "Bengaluru, IN",
          "resumeUrl": "https://api.example.com/files/jfw/resumes/....pdf?exp=...&sig=...",
          "profileCompletePercent": 77
        }
      }
    }
    ```

### 2. Upload Candidate Resume
* **`POST /api/v1/candidates/resume`**
  * **Request**: `multipart/form-data` containing a `resume` field. PDF, DOC, or DOCX, **max 10 MB**. Content is validated against its declared MIME type by a magic-byte check.
  * **Rate limit**: the upload tier applies — 10 uploads per 10 minutes per user.
  * **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "profile": {
          "resumeUrl": "https://api.example.com/files/jfw/resumes/....pdf?exp=...&sig=...",
          "resumePublicId": "jfw/resumes/<candidateId>_resume.pdf",
          "resumeMetadata": {
            "size": 73845,
            "mimetype": "application/pdf",
            "originalName": "Resume.pdf"
          }
        }
      }
    }
    ```

### 3. Apply to Job
* **`POST /api/v1/candidates/jobs/:jobId/apply`**
  * **Permissions**: Authenticated candidate with a verified email and profile completion >= `PROFILE_COMPLETION_THRESHOLD` (default 70%). Falling short returns 403.
  * **Response (201 Created)**:
    ```json
    {
      "success": true,
      "message": "Application submitted successfully.",
      "data": {
        "applicationId": "app-uuid",
        "status": "Applied"
      }
    }
    ```

---

## 8.3 Recruiter Endpoints (`/api/v1/recruiters`)

### 1. Post a New Job
* **`POST /api/v1/recruiters/jobs`**
  * **Permissions**: Recruiter linked to an approved company.
  * **Payload**:
    ```json
    {
      "title": "Software Engineer",
      "location": "Bengaluru",
      "type": "Full Time",
      "workMode": "Remote",
      "description": "Job details...",
      "requirements": "Required skills...",
      "responsibilities": "Job duties...",
      "benefits": "Company perks...",
      "salaryDisplay": "₹15,00,000 - ₹20,00,000",
      "salaryMin": 1500000,
      "salaryMax": 2000000,
      "departmentId": "dept-uuid",
      "deadline": "31/12/2026",
      "menstrualLeaveChampion": true
    }
    ```
  * **Response (201 Created)**:
    ```json
    {
      "success": true,
      "message": "Job submitted for review.",
      "data": {
        "jobId": "job-uuid",
        "status": "pending_approval"
      }
    }
    ```

### 2. Moderation of Application Status
* **`PUT /api/v1/recruiters/applications/:id/status`** (note: `PUT`, not `PATCH`)
  * **Payload**:
    ```json
    {
      "status": "Shortlisted",
      "notes": "Strong portfolio, moving to interview stage."
    }
    ```
  * **Valid `status` values**: `Applied`, `Reviewed`, `Shortlisted`, `Hired`, `Rejected`. `notes` is optional (max 500 characters).
  * **`InterviewScheduled` and `Offer Released` are not accepted here** — they require structured data and have their own endpoints:
    * **`POST /api/v1/recruiters/applications/:id/interview`** — schedules an interview (captures scheduled time, timezone, mode, location/meeting link, notes).
    * **`POST /api/v1/recruiters/applications/:id/offer`** — releases an offer; accepts `multipart/form-data` with an optional offer-letter file.
  * There is **no** conversation/chat-thread endpoint. Real-time chat has been removed from the running application — see [6. Backend](06_BACKEND.md) §6.3. The `Conversation` route this section previously documented (`POST .../conversation`) does not exist in `recruiter.routes.ts`.

---

## 8.4 Admin Endpoints (`/api/v1/admins`)

> Note the **plural** mount point — `app.ts` registers this router at `/api/v1/admins`. Requests to `/api/v1/admin/...` return 404.

### 1. Moderate Job Posting
* **`POST /api/v1/admins/jobs/:id/moderate`**
  * **Payload**: the field is `action`, not `status`.
    ```json
    {
      "action": "approve",
      "notes": "Verified company benefits, job meets platform guidelines."
    }
    ```
  * **Valid `action` values**: `approve`, `reject`, `hide`, `unhide`, `pause`, `resume`, `archive`, `delete`, `feature`, `unfeature`. `notes` is optional.
  * **Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Job moderation action 'approve' executed successfully."
    }
    ```

### 2. Verify Company Account
* **`POST /api/v1/admins/companies/:id/verify`**
  * **Payload**:
    ```json
    {
      "status": "approved",
      "notes": "Optional reviewer note."
    }
    ```
  * **Valid `status` values** (the `CompanyStatus` enum): `draft`, `submitted`, `pending`, `pending_verification`, `under_review`, `approved`, `rejected`, `info_requested`.
