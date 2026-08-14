-- Add avatar fields to RecruiterProfile and AdminProfile, mirroring
-- CandidateProfile.avatarUrl/avatarPublicId, so every role can upload a
-- profile picture (not just candidates).
ALTER TABLE "RecruiterProfile" ADD COLUMN "avatarUrl" TEXT, ADD COLUMN "avatarPublicId" TEXT;
ALTER TABLE "AdminProfile" ADD COLUMN "avatarUrl" TEXT, ADD COLUMN "avatarPublicId" TEXT;
