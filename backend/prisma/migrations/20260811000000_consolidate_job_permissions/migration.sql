-- Consolidate job-related permissions in the RBAC Matrix.
--
-- approve:job + reject:job -> moderate:job
-- create:job + update:job + delete:job -> manage:job
-- (read:job is untouched -- it's a genuinely separate capability)
--
-- Every route that checked the old pairs required ALL of them together
-- (requirePermission uses AND semantics), and seed.ts never granted one of
-- a pair/trio to a role without also granting the others -- so no role's
-- real access changes here. This just collapses permissions that were only
-- ever toggled as a unit into a single row in the RBAC Matrix, matching
-- what admin.routes.ts / recruiter.routes.ts now check.
--
-- Safe to run against a database that was never seeded (every UPDATE/DELETE
-- below simply matches zero rows) or one seeded under the old permission
-- names (renames the surviving row in place so its RolePermission joins --
-- and hence every role's current grants -- carry over unchanged, then
-- removes the now-redundant duplicate rows).
--
-- NOTE: PermissionCacheManager caches each user's effective permissions in
-- Redis for up to 24h. Deploying this migration should be paired with a
-- cache flush (PermissionCacheManager.invalidateAll(), same call already
-- triggered by any role/permission edit) so already-cached sessions don't
-- keep evaluating against the old permission names until their TTL expires.

-- create:job -> manage:job (rename the surviving row; its id and existing
-- RolePermission joins are unaffected by the rename)
UPDATE "Permission" SET "name" = 'manage:job' WHERE "name" = 'create:job';

-- update:job / delete:job are now redundant with manage:job -- every role
-- that held either already held create:job too, so their RolePermission
-- joins are exact duplicates of what manage:job now covers.
DELETE FROM "RolePermission" WHERE "permissionId" IN (
  SELECT "id" FROM "Permission" WHERE "name" IN ('update:job', 'delete:job')
);
DELETE FROM "Permission" WHERE "name" IN ('update:job', 'delete:job');

-- approve:job -> moderate:job, same pattern
UPDATE "Permission" SET "name" = 'moderate:job' WHERE "name" = 'approve:job';
DELETE FROM "RolePermission" WHERE "permissionId" IN (
  SELECT "id" FROM "Permission" WHERE "name" = 'reject:job'
);
DELETE FROM "Permission" WHERE "name" = 'reject:job';
