-- AlterTable
-- Adds candidate-side profile fields that the frontend Profile page already
-- expects (phone, location, totalExperience, career break, job-search
-- preferences) but which were never migrated into the database. All columns
-- are nullable or default to an empty/false value, so this is a purely
-- additive, non-breaking change for existing rows.
ALTER TABLE "CandidateProfile"
ADD COLUMN "phone" TEXT,
ADD COLUMN "location" TEXT,
ADD COLUMN "totalExperience" TEXT,
ADD COLUMN "careerBreak" JSONB,
ADD COLUMN "preferredLocations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "availability" TEXT;