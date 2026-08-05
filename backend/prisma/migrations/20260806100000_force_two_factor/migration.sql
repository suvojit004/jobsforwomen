-- AlterTable
-- twoFactorEnabled already existed but was never read/written by any code
-- path. twoFactorSecret holds the AES-256-GCM-encrypted TOTP secret (see
-- shared/utils/twoFactor.ts) -- null until enrollment is confirmed.
ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT;

-- AlterTable
-- Platform-wide "Force Two-Factor (2FA)" policy for admin-tier accounts,
-- enforced in securityPolicy.middleware.ts's enforceTwoFactorPolicy.
ALTER TABLE "SecurityPolicy" ADD COLUMN "forceTwoFactorForAdmins" BOOLEAN NOT NULL DEFAULT false;
