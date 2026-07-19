# 14. Recruiter Module

The Recruiter Module provides tools for talent acquisition teams to verify their company, post jobs, manage applications, and coordinate team members.

---

## 14.1 Employer Verification & Company Profile

New recruiters must complete company onboarding in `CompanyProfile.tsx`:
* **Corporate Identification**: Recruiter registers company metadata (name, website, location, industry, and benefits).
* **Company Logo Upload**: Recruiter can upload a PNG/JPEG logo. The logo is verified (max 2MB), uploaded to Cloudinary, and the previously associated logo is deleted from Cloudinary.
* **Verification Status**:
  * Until the company status is marked `approved` by an admin, recruiters are blocked from posting job vacancies.
  * In the UI, a banner displays their pending/draft status.

---

## 14.2 Job Posting & Management

Recruiters manage job postings inside `PostJob.tsx` and `ManageJobs.tsx`:
* **Posting a Job**: Recruiters fill out the job form, specifying description, requirements, responsibilities, salary ranges, work mode, and policies (like Menstrual Leave Champion).
* **Job Approval Queue**: Newly created jobs are initialized to `pending_approval` status and do not appear in candidate searches. The EventBus publishes `JobSubmittedForApproval` to alert platform admins.
* **Pause & Close**: Recruiters can pause active job postings (changing status to `paused` and visibility to `hidden`) or close vacancies once positions are filled.

---

## 14.3 Applicant Management Pipeline

Recruiters track job applications in `Applicants.tsx`:
* **Application Lifecycle**: Recruiters review candidate profiles and download resumes directly.
* **Moderation Actions**: Recruiters can update applicant states:
  * **Shortlist**: Moves status to `Shortlisted`.
  * **Schedule Interview**: Moves status to `InterviewScheduled` (requires date and location values). This triggers real-time alerts and email notifications via the BullMQ queue.
  * **Release Offer**: Moves status to `OfferReleased` (allows attaching offer details).
  * **Reject / Hire**: Closes the application pipeline.

---

## 14.4 Colleague Team Invitations

Recruiters can invite colleagues to join their company workspace in `Team.tsx`:
* **Invitation Creation**: Recruiters input a colleague's email address and assign them a role (e.g., `Recruiter`). The system checks for existing users or active pending invites and sends an invitation token email via Resend.
* **Single-use Verification**: Invitations generate a 32-byte secure token that expires in 48 hours.
* **Cancellation**: Recruiters can cancel pending invites, which deletes them from the database. The route validates that recruiters can only cancel invites associated with their own company.
* **Accepting Invites**: When a candidate signs up using a valid invitation token, the system validates the token and registers them as a Recruiter associated with the inviter's `companyId`.
