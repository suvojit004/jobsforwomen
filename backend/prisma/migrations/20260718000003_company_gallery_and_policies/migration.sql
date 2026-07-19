-- Part 5 of the recruiter-onboarding spec: expanded Company Profile --
-- office photo gallery and free-form workplace policy statements
-- (e.g. POSH/maternity/equal-pay policies), both nullable additions,
-- no backfill needed, no existing query or write path is affected.
ALTER TABLE "Company" ADD COLUMN "galleryImages" JSONB;
ALTER TABLE "Company" ADD COLUMN "policies" JSONB;
