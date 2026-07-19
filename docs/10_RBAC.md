# 10. RBAC Documentation

Access control on the platform is governed by a robust Role-Based Access Control (RBAC) engine.

---

## 10.1 Role-Permission Authorization Matrix

Permissions are seeded dynamically in the database and mapped to roles:

| Role Name | Allowed Core Permissions | Description |
| :--- | :--- | :--- |
| **`Candidate`** | `read:job` | Basic candidate capabilities (browsing). |
| **`Recruiter`** | `create:job`, `read:job`, `update:job`, `delete:job` | Job posting and management rights. |
| **`Moderator`** | `read:job`, `approve:job`, `reject:job`, `manage:companies` | Company audits and job approvals. |
| **`Admin`** | Includes Moderator permissions plus: `manage:users`, `manage:reports`, `manage:notifications`, `manage:features` | System configurations and user suspensions. |
| **`Super Admin`**| Includes Admin permissions plus: `manage:roles`, `manage:permissions` | Full control including RBAC matrix mutations. |

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
