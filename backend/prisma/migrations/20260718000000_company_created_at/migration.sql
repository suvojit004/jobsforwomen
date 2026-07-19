-- Adds Company.createdAt for the admin "Company Registration Requests" table's
-- Registration Date column (Part 2 of the recruiter-onboarding/approval spec).
-- DEFAULT now() backfills all existing rows at migration-apply time and
-- covers all future inserts, so this is a purely additive, backward-compatible
-- change -- no existing query or write path needs to change.
ALTER TABLE "Company" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
