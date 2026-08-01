-- CreateEnum
-- "Report Platform Issue" ticket lifecycle. A small internal helpdesk queue,
-- not a full ITSM workflow (no Reopened/Escalated/Pending-on-Customer
-- states).
CREATE TYPE "TicketStatus" AS ENUM ('Open', 'InProgress', 'Resolved');

-- CreateTable
-- Previously "Report Platform Issue" was admin-only and email-only, with no
-- DB record at all (see admin.service.ts's old submitSupportTicket -- it
-- just enqueued an email and wrote an AuditLog entry). This makes it a real,
-- queryable ticket: submittable by Candidate/Recruiter/Admin-tier alike,
-- assignable to a Support Executive, with a status workflow the whole admin
-- tier can see progress on.
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'Open',
    "submittedById" TEXT NOT NULL,
    "submitterRole" TEXT NOT NULL,
    "assignedToId" TEXT,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_submittedById_idx" ON "SupportTicket"("submittedById");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedToId_idx" ON "SupportTicket"("assignedToId");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
