-- AlterTable
-- Durable admin-tier account lockout state, set once failed-login attempts
-- (tracked in Redis, see shared/utils/loginSecurity.ts) cross the
-- configured threshold within the sliding window. See AuthService.login()
-- and admin.service.ts's "account-unlock" administrative action.
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
