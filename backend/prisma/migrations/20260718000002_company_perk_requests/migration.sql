-- Parts 6/7/20 of the recruiter-onboarding/approval spec: a real per-perk
-- approval workflow, independent from company registration approval.
-- CompanyBenefit is intentionally left untouched (dormant, not dropped) --
-- new code reads/writes CompanyPerkRequest exclusively.
CREATE TYPE "PerkStatus" AS ENUM ('pending', 'approved', 'rejected', 'info_requested');

CREATE TABLE "CompanyPerkRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "perkName" TEXT NOT NULL,
    "status" "PerkStatus" NOT NULL DEFAULT 'pending',
    "documents" JSONB,
    "adminComment" TEXT,
    "recruiterComment" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPerkRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyPerkRequest_companyId_idx" ON "CompanyPerkRequest"("companyId");
CREATE INDEX "CompanyPerkRequest_status_idx" ON "CompanyPerkRequest"("status");

ALTER TABLE "CompanyPerkRequest" ADD CONSTRAINT "CompanyPerkRequest_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
