import { Router } from "express"
import { RbacController } from "./rbac.controller"
import { authenticateToken } from "../../shared/middleware/auth.middleware"
import { requirePermission } from "./rbac.middleware"

const router = Router()
const controller = new RbacController()

// Apply authentication to all RBAC endpoints
router.use(authenticateToken)

// Roles endpoints (restricted to manage:roles permission)
router.post("/roles", requirePermission(["manage:roles"]), controller.createRole)
router.get("/roles", requirePermission(["manage:roles"]), controller.getRoles)
router.get("/roles/:id", requirePermission(["manage:roles"]), controller.getRoleById)
router.put("/roles/:id", requirePermission(["manage:roles"]), controller.updateRole)
router.delete("/roles/:id", requirePermission(["manage:roles"]), controller.deleteRole)
router.post("/roles/:id/permissions", requirePermission(["manage:roles"]), controller.assignPermissionsToRole)

// Permissions endpoints (restricted to manage:permissions permission)
router.post("/permissions", requirePermission(["manage:permissions"]), controller.createPermission)
router.get("/permissions", requirePermission(["manage:permissions"]), controller.getPermissions)
router.get("/permissions/:id", requirePermission(["manage:permissions"]), controller.getPermissionById)
router.put("/permissions/:id", requirePermission(["manage:permissions"]), controller.updatePermission)
router.delete("/permissions/:id", requirePermission(["manage:permissions"]), controller.deletePermission)

// User assignments & effective lookup (restricted to manage:users permission)
router.post("/users/:id/roles", requirePermission(["manage:users"]), controller.assignRolesToUser)
router.get("/users/:id/effective", requirePermission(["manage:users"]), controller.getUserEffectivePermissions)

export default router
