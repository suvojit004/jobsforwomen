-- Part 3 of the recruiter-onboarding/approval spec: secure, single-use,
-- expiring resubmission token issued when an admin requests more
-- information on a company registration, plus fields to surface the
-- recruiter's resubmission comment/timestamp to admins. All columns are
-- nullable additions -- purely additive, no backfill needed, no existing
-- query or write path is affected.
ALTER TABLE "Company" ADD COLUMN "verificationToken" TEXT;
ALTER TABLE "Company" ADD COLUMN "verificationTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "recruiterResubmissionComment" TEXT;
ALTER TABLE "Company" ADD COLUMN "resubmittedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Company_verificationToken_key" ON "Company"("verificationToken");
