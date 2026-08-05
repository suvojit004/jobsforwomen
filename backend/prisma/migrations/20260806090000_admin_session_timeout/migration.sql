-- AlterTable
-- Correlates a RefreshToken back to the Session row it was issued alongside
-- so sessionTimeout.middleware.ts can revoke a session's refresh token when
-- it force-expires that session for inactivity (otherwise the frontend's
-- automatic 401 -> POST /auth/refresh retry would silently resurrect an
-- inactivity-expired session).
ALTER TABLE "RefreshToken" ADD COLUMN "sessionId" TEXT;
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");

-- CreateTable
-- Singleton row (fixed id 'singleton') holding platform-wide admin security
-- policy -- currently just the inactivity session timeout. Only a Super
-- Admin can change it; every admin-tier role can read it. See
-- AdminService.getSecuritySettings/updateSecuritySettings and
-- sessionTimeout.middleware.ts.
CREATE TABLE "SecurityPolicy" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "adminSessionTimeoutMinutes" INTEGER,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityPolicy_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SecurityPolicy" ADD CONSTRAINT "SecurityPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the singleton row with enforcement disabled (null) -- honest default,
-- matching the fact there was no real enforcement before this migration.
INSERT INTO "SecurityPolicy" ("id", "adminSessionTimeoutMinutes", "updatedById", "updatedAt")
VALUES ('singleton', NULL, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
