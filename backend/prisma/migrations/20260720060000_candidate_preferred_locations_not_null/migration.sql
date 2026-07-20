-- AlterTable
-- CONFIRMED PRODUCTION BUG (fixed here): 20260713000000_candidate_profile_persistence
-- added CandidateProfile.preferredLocations as TEXT[] with a DEFAULT but
-- without NOT NULL, even though schema.prisma has always declared it as a
-- required `preferredLocations String[]` (Prisma requires scalar list
-- fields to be non-nullable at the DB level). A later migration,
-- 20260713061000_candidate_career_break_and_preferences, attempted to fix
-- this but was written as a full duplicate ADD COLUMN of all six columns
-- from the earlier migration (including the already-existing "phone"
-- column), rather than a targeted ALTER COLUMN -- so every `prisma migrate
-- deploy` failed with P3018 ("column phone already exists") the moment it
-- reached that migration, on production and on every fresh/staging
-- database alike. That duplicate migration has been deleted; this is the
-- narrow fix it was actually trying to make.
--
-- Backfill first: no code path can currently write NULL into this column
-- (schema.prisma types it as a required String[]), but this guards against
-- any row that predates the DEFAULT being backfilled, so the NOT NULL
-- constraint below can never fail on existing data.
UPDATE "CandidateProfile" SET "preferredLocations" = ARRAY[]::TEXT[] WHERE "preferredLocations" IS NULL;

ALTER TABLE "CandidateProfile" ALTER COLUMN "preferredLocations" SET NOT NULL;
