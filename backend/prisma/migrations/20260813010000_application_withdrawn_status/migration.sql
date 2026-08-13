-- AlterEnum
-- Adds a real "Withdrawn" state distinct from "Rejected" -- a candidate
-- withdrawing their own application is not the same event as a recruiter
-- rejecting it, and conflating the two hid this from both sides of the app.
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside an explicit
-- transaction block, so this migration is intentionally just this one
-- statement (matches how Prisma itself generates enum-value-add migrations).
ALTER TYPE "ApplicationStatus" ADD VALUE 'Withdrawn';
