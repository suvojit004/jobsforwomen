# 10. RBAC Documentation

Access control on the platform is governed by a robust Role-Based Access Control (RBAC) engine.

---

## 10.1 Role-Permission Authorization Matrix

Permissions are seeded dynamically in the database and mapped to roles:

| Role Name | Allowed Core Permissions | Description |
| :--- | :--- | :--- |
| **`Candidate`** | `read:job` | Basic candidate capabilities (browsing). |
| **`Recruiter`** | `manage:job`, `read:job` | Job posting and management rights. `manage:job` covers create/update/delete -- these were three separate permissions until they were consolidated, since no role ever held one without the others. |
| **`Moderator`** | `read:job`, `moderate:job`, `manage:companies`, `manage:perks` | Company audits and job approvals. `moderate:job` covers approve/reject, consolidated for the same reason as `manage:job`. |
| **`Admin`** | Includes Moderator permissions plus: `manage:users`, `manage:reports`, `manage:notifications`, `manage:features`, `manage:support-tickets`, `verify:recruiters`, `manage:invitations`, `manage:platform-settings` | System configurations and user suspensions. |
| **`Super Admin`**| Includes Admin permissions plus: `manage:roles`, `manage:permissions`, `manage:admins` | Full control including RBAC matrix mutations. |
| **`Support Executive`** | `read:job`, `manage:support-tickets`, `manage:perks` | Support ticket queue ownership; read-only elsewhere. |

Permission names are plain, unconstrained strings (`Permission.name` is a unique `String` column, not an enum) -- adding a new one is pure seed data, no schema migration required. Renaming or merging existing ones (as happened with the job-lifecycle consolidation above) does need a migration, since existing `RolePermission` rows reference them by ID and any already-seeded database needs those rows carried over rather than orphaned.

---

## 10.2 Permission Cache Engine (Redis)

To avoid hitting PostgreSQL on every single API request, the system uses a **Redis Permission Cache** (`backend/src/shared/utils/permissionCache.ts`):

* **Cache Strategy**: User roles and associated permission arrays are stored in Redis under the key `user:permissions:<userId>` with an expiration of 24 hours.
* **Retrieval Flow**:
  1. The `requirePermission` middleware calls `PermissionCacheManager.getUserPermissions(userId)`.
  2. If the cache exists in Redis, the permissions array is returned immediately.
  3. If it's a cache miss, the system queries PostgreSQL, maps roles and permissions, writes the result to Redis, and returns the array.
* **Cache Invalidation**: When user roles or permissions are updated, the platform invalidates the cache:
  * `PermissionCacheManager.invalidateUserCache(userId)`: Deletes the specific user's Redis entry.
  * `PermissionCacheManager.invalidateAll()`: Flushes all user permissions keys.

---

## 10.3 Authorization Middleware Guards

The backend enforces guards on Express routers:

```typescript
// Example: Restricting route to Super Admins and Admins
router.patch(
  "/feature-flags/:key",
  requireAuth,
  requireActiveUser,
  requirePermission(["manage:features"]),
  controller.updateFlag
)
```

### 1. `requirePermission(requiredPermissions: string[])`
An Express middleware wrapper:
```typescript
const permissions = await PermissionCacheManager.getUserPermissions(user.userId)
const hasPermission = requiredPermissions.every((p) => permissions.includes(p))
if (!hasPermission) {
  return sendError(res, "Forbidden: Insufficient privileges", null, 403)
}
```

### 2. `requireOwnership(modelName: string, idParamName: string)`
Verifies the requesting user is the creator of the target model instance (e.g., matching the `recruiter.userId` on a `Job` or `candidate.userId` on an `Application`). 
* Admins and Super Admins **bypass** the ownership check automatically.

### 3. `requireSuperAdmin`
Explicit middleware for critical operations:
```typescript
if (!user.roles.includes("Super Admin")) {
  return sendError(res, "Forbidden: Super Admin role required", null, 403)
}
```
