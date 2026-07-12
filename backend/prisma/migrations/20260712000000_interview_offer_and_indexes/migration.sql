-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'OfferReleased';

-- AlterTable
ALTER TABLE "Application"
ADD COLUMN "offerDetails" TEXT,
ADD COLUMN "offerReleasedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");

CREATE INDEX "Job_recruiterId_idx" ON "Job"("recruiterId");

CREATE INDEX "Job_status_idx" ON "Job"("status");

CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

CREATE INDEX "Application_candidateId_idx" ON "Application"("candidateId");

CREATE INDEX "Notification_recipientId_idx" ON "Notification"("recipientId");

-- AlterTable
ALTER TABLE "Invitation"
ADD COLUMN "companyId" TEXT;

-- AddForeignKey
ALTER TABLE "Invitation"
ADD CONSTRAINT "Invitation_companyId_fkey"
FOREIGN KEY ("companyId")
REFERENCES "Company"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;