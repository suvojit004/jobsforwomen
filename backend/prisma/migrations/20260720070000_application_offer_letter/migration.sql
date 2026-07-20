-- AlterTable
-- Adds an optional attached offer letter document (PDF/DOC/DOCX) to
-- Application, uploaded to Cloudinary the same way resumes/verification
-- documents already are. Both columns are nullable, so this is a purely
-- additive, non-breaking change for existing rows.
ALTER TABLE "Application"
ADD COLUMN "offerLetterUrl" TEXT,
ADD COLUMN "offerLetterPublicId" TEXT;
