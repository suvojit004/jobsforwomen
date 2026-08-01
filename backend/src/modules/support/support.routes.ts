import { Router } from "express"
import { SupportController } from "./support.controller"
import { authenticateToken, requireRole } from "../../shared/middleware/auth.middleware"
import { requireActiveUser } from "../rbac/rbac.middleware"

const router = Router()
const controller = new SupportController()

// "Report Platform Issue" tickets -- reachable by every portal (Candidate,
// Recruiter, Admin-tier), unlike the admin-only routes in admin.routes.ts.
const ADMIN_TIER_ROLES = ["Admin", "Super Admin", "Moderator", "Support Executive"]
// Moderator is deliberately excluded here -- read-only progress visibility
// per spec, Support Executive owns the queue, Admin/Super Admin can override.
const TICKET_MANAGER_ROLES = ["Support Executive", "Admin", "Super Admin"]

router.use(authenticateToken)
router.use(requireActiveUser)

// Any authenticated, active user (Candidate/Recruiter/Admin-tier) can file a
// ticket and see their own ticket history.
router.post("/", controller.createTicket)
router.get("/mine", controller.listMyTickets)

// Admin-tier queue/progress view -- Support Executive works tickets here,
// Admin/Super Admin/Moderator get read visibility via the same list+detail
// routes (the route-level gate below only restricts the mutating endpoint).
router.get("/", requireRole(ADMIN_TIER_ROLES), controller.listAllTickets)
router.get("/:id", controller.getTicketById) // service layer enforces owner-or-admin-tier
router.put("/:id/status", requireRole(TICKET_MANAGER_ROLES), controller.updateTicketStatus)
// Owner-or-manager, not a fixed role list (the owner can be any role) --
// service layer enforces it, same pattern as getTicketById above.
router.post("/:id/comments", controller.addComment)

export default router
