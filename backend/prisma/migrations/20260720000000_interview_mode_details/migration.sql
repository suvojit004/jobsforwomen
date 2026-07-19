-- Issue 1 (Candidate Job Lifecycle spec): split the Interview scheduling
-- modal's single free-text "location" field into the real structured fields
-- the spec requires (Timezone, Interview Mode, Meeting Link, Venue, Notes).
-- All nullable / defaulted additions, no backfill needed: existing rows keep
-- working through the untouched `location` column, which the service layer
-- continues to populate for backward compatibility.
ALTER TABLE "Interview" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'Online';
ALTER TABLE "Interview" ADD COLUMN "timezone" TEXT;
ALTER TABLE "Interview" ADD COLUMN "meetingLink" TEXT;
ALTER TABLE "Interview" ADD COLUMN "venue" TEXT;
ALTER TABLE "Interview" ADD COLUMN "notes" TEXT;
