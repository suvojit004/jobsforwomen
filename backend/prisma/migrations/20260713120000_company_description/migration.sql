-- AlterTable
-- The recruiter Company Profile page (frontend CompanyProfile.tsx) has always
-- had an editable "About Company" description field bound via
-- register("description"), and recruiter.service.ts's onboardCompany was
-- already reading/writing data.description -- but the Company model never
-- had a description column, so this data had nowhere to be persisted.
-- Nullable, purely additive, non-breaking for existing rows.
ALTER TABLE "Company"
ADD COLUMN "description" TEXT;
