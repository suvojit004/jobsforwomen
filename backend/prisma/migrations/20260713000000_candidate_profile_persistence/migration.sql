-- AlterTable
ALTER TABLE "CandidateProfile" 
ADD COLUMN "phone" TEXT,
ADD COLUMN "location" TEXT,
ADD COLUMN "totalExperience" TEXT,
ADD COLUMN "careerBreak" JSONB,
ADD COLUMN "preferredLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "availability" TEXT;
