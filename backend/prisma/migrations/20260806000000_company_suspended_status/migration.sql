-- AlterEnum
-- Adds a moderation state distinct from the existing verification-workflow
-- states (draft/submitted/pending/.../rejected/info_requested): a company
-- that WAS approved and operating can now be suspended (and later
-- unsuspended back to `approved`) without losing/overloading its
-- verification history. See AdminService.suspendCompany/unsuspendCompany.
ALTER TYPE "CompanyStatus" ADD VALUE 'suspended';
