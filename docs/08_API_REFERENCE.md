# 8. API Reference

All requests must set `Content-Type: application/json` unless uploading files (which must use `multipart/form-data`). Authenticated routes require an `Authorization: Bearer <token>` access token or valid HttpOnly session cookies.

---

## 8.1 Authentication Endpoints (`/api/v1/auth`)

### 1. User Registration
* **`POST /api/v1/auth/register`**
  * **Description**: Registers a new user.
  * **Payload**:
    ```json
    {
      "email": "user@email.com",
      "password": "securepassword123",
      "role": "Candidate" // "Candidate" | "Recruiter"
    }
    ```
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
          "resumeUrl": "https://res.cloudinary.com/...",
          "profileCompletePercent": 77
        }
      }
    }
    ```

### 2. Upload Candidate Resume
* **`POST /api/v1/candidates/resume`**
  * **Request**: `multipart/form-data` containing a `file` field (PDF/Word format, max 2MB).
  * **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "profile": {
          "resumeUrl": "https://res.cloudinary.com/...",
          "resumePublicId": "cloudinary_public_id",
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
  * **Permissions**: Authenticated candidate with profile completion rate >= 70%.
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
* **`PATCH /api/v1/recruiters/applications/:id/status`**
  * **Payload**:
    ```json
    {
      "status": "InterviewScheduled",
      "notes": "Video interview scheduled for Tuesday.",
      "scheduledAt": "2026-07-25T10:00:00.000Z"
    }
    ```

---

## 8.4 Admin Endpoints (`/api/v1/admin`)

### 1. Moderate Job Posting
* **`PATCH /api/v1/admin/jobs/:id/status`**
  * **Payload**:
    ```json
    {
      "status": "approved", // "approved" | "rejected"
      "notes": "Verified company benefits, job meets platform guidelines."
    }
    ```
  * **Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Job status updated successfully."
    }
    ```

### 2. Verify Company Account
* **`PATCH /api/v1/admin/companies/:id/status`**
  * **Payload**:
    ```json
    {
      "status": "approved" // "approved" | "rejected" | "info_requested"
    }
    ```
