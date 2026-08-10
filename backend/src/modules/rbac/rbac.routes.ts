import { Router } from "express"
import { RbacController } from "./rbac.controller"
import { authenticateToken, requireRole } from "../../shared/middleware/auth.middleware"
import { requireActiveUser, requirePermission, requireSuperAdmin, requireAll } from "./rbac.middleware"
import { adminRateLimiter } from "../../shared/middleware/rateLimit.middleware"
import { ADMIN_TIER_ROLES } from "../../shared/constants/roles"

const router = Router()
const controller = new RbacController()

// This is the app's real, single Role/Permission CRUD API -- what
// RolesPermissions.tsx and AdminManagement.tsx call for everything RBAC
// (viewing the matrix, toggling a role's permissions, creating a role,
// assigning roles to a user). admin.routes.ts used to have its own parallel
// implementation of most of this at /api/v1/admins/rbac/*; that duplication
// was retired in favor of this router being the one real path.
router.use(authenticateToken)
router.use(requireActiveUser)
router.use(adminRateLimiter)

// Viewing the matrix (which roles exist, which permissions exist, who has
// what) has always been open to every admin-tier role -- Moderator and
// Support Executive don't hold manage:roles/manage:permissions, but they
// still need to load this page (see AdminLayout.tsx's nav entry, which has
// no superAdminOnly flag), same as the old /admins/rbac GET behavior.
// Mutations below stay genuinely permission-gated.
router.get("/roles", requireRole(ADMIN_TIER_ROLES), controller.getRoles)
router.get("/roles/:id", requireRole(ADMIN_TIER_ROLES), controller.getRoleById)
router.get("/permissions", requireRole(ADMIN_TIER_ROLES), controller.getPermissions)
router.get("/permissions/:id", requireRole(ADMIN_TIER_ROLES), controller.getPermissionById)

// Roles mutations (restricted to manage:roles permission)
router.post("/roles", requirePermission(["manage:roles"]), controller.createRole)
router.put("/roles/:id", requirePermission(["manage:roles"]), controller.updateRole)
router.delete("/roles/:id", requirePermission(["manage:roles"]), controller.deleteRole)
router.post("/roles/:id/permissions", requirePermission(["manage:roles"]), controller.assignPermissionsToRole)

// Permissions mutations (restricted to manage:permissions permission)
router.post("/permissions", requirePermission(["manage:permissions"]), controller.createPermission)
router.put("/permissions/:id", requirePermission(["manage:permissions"]), controller.updatePermission)
router.delete("/permissions/:id", requirePermission(["manage:permissions"]), controller.deletePermission)

// User role assignment -- LAYER (not replace): manage:users is seeded to
// both Admin and Super Admin, but granting a role to a user (which can
// include granting Super Admin itself) stays a deliberately narrower,
// Super-Admin-only action, same reasoning as when this route lived at
// /api/v1/admins/users/:id/roles. RbacService.assignRolesToUser also
// independently guards against privilege escalation and removing the last
// Super Admin, as defense-in-depth beneath this route gate.
router.post("/users/:id/roles", requireAll(requireSuperAdmin, requirePermission(["manage:users"])), controller.assignRolesToUser)
router.get("/users/:id/effective", requirePermission(["manage:users"]), controller.getUserEffectivePermissions)

export default router
