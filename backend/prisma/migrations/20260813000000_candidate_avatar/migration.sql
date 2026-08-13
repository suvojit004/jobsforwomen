-- AlterTable
-- Companion to avatarUrl for the candidate profile photo upload feature --
-- same "store both the URL and the storage publicId" pattern already used
-- for Company.logoUrl/logoPublicId and CandidateProfile.resumeUrl/
-- resumePublicId, needed so a re-upload/removal can clean up the previous
-- asset on disk instead of leaking orphaned files.
ALTER TABLE "CandidateProfile" ADD COLUMN "avatarPublicId" TEXT;
