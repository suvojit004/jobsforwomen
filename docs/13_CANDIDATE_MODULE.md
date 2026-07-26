# 13. Candidate Module

The Candidate Module provides tools for female job seekers to create professional profiles, upload resumes, search for roles, and track job applications.

---

## 13.1 Profile Setup & Completion Engine

Candidates manage their details in `Profile.tsx`.
* **Profile Fields**: Name, professional title, bio, phone, location, work experience (JSON history), education, preferred locations, and availability.
* **Profile Completion Percent**: The platform calculates a dynamic completion metric (`profileCompletePercent`) in the backend:
  * Counts filled fields (`fullName`, `title`, `bio`, `phone`, `location`, `totalExperience`, `avatarUrl`, `resumeUrl`, `noticePeriod`, `expectedSalary`, `availability`).
  * Factors in lists (`skills`, `experience`, `education`, `careerBreak`).
  * **Application Threshold**: If the candidate's completion rate is below **`70%`** (managed by `env.PROFILE_COMPLETION_THRESHOLD`), the backend `requireProfileCompleted` middleware blocks them from submitting job applications.

---

## 13.2 Resume Management (Local Disk Storage)

Resumes are managed inside `ResumeCard.tsx`:
* **Upload**: Candidates upload a PDF, DOC, or DOCX document (max 10MB, enforced by Multer). The frontend calls `POST /api/v1/candidates/resume` sending `multipart/form-data`. The file's magic bytes are checked against its declared MIME type, it is written to `DISK_MOUNT_PATH/jfw/resumes/`, and its metadata is stored in the database.
* **Retrieval**: Resumes are private. API responses return a signed, time-limited URL (`?exp=...&sig=...`, 1-hour TTL) generated automatically by `sendSuccess()`. An expired link returns 403 and is refreshed by reloading the page.
* **Immediate State Sync**: The frontend updates state immediately upon receiving an HTTP 200 upload/delete response, providing instant feedback without page reloads.
* **Refetch Sync**: A silent background profile refetch updates the profile completion rate.

---

## 13.3 Job Search & Filtering

Candidates search and filter jobs in `BrowseJobs.tsx`:
* **Text Search**: Matches keywords against job titles, companies, and descriptions.
* **Structured Filters**: Filters by Location, Job Type (Full-time, Part-time), and Work Mode (Remote, Hybrid, On-site).
* **Benefit Badges**: Highlights progressive workplace policies:
  * **Menstrual Leave Champion**: Highlights companies that offer paid menstrual leave.
  * **Flexible Returnship**: Highlights returnship programs for women re-entering the workforce after career breaks.
* **Saving Jobs**: Candidates can click the bookmark icon on any `JobCard` to save it for later, persisting it to the `SavedJob` table.

---

## 13.4 Application Pipeline

When a candidate applies to a job:
1. The frontend checks if `isApplied` is true or if submission is already in progress.
2. Clicking "Apply Now" triggers a call to `POST /api/v1/candidates/jobs/:jobId/apply`.
3. The backend validates:
   * Verification status (`requireVerifiedEmail`).
   * Profile completion >= 70% (`requireProfileCompleted`).
4. If validations pass, an `Application` record is created, and the candidate's applied list, dashboard card, and activity logs are refreshed.
5. If the application is successful, it is rendered in `MyApplications` on the dashboard, displaying its current moderation phase (e.g., `Applied`, `Under Review`, `Interview Scheduled`).
