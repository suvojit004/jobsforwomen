-- CreateTable
-- Singleton row (fixed id "singleton") holding general, non-security
-- platform settings -- first field is the "Operations Support Contacts"
-- technical helpdesk email previously hardcoded in HelpSupport.tsx. See
-- AdminService.getPlatformSettings/updatePlatformSettings.
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "supportContactEmail" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlatformSettings" ADD CONSTRAINT "PlatformSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
