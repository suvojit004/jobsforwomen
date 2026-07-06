import type { Request, Response, NextFunction } from "express"
import { verifyAccessToken } from "../utils/token"
import { sendError } from "../utils/response"
import { logger } from "../utils/logger"

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    logger.warn("Access token missing in Authorization header")
    return sendError(res, "Access token required", null, 401)
  }

  const payload = verifyAccessToken(token)
  if (!payload) {
    logger.warn("Invalid or expired access token presented")
    return sendError(res, "Invalid or expired access token", null, 401)
  }

  req.user = payload
  next()
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "Authentication required", null, 401)
    }

    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r))
    if (!hasRole) {
      logger.warn(`User ${req.user.email} lacking required roles: ${allowedRoles.join(", ")}`)
      return sendError(res, "Forbidden: Insufficient role credentials", null, 403)
    }

    next()
  }
}

export function requirePermission(requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "Authentication required", null, 401)
    }

    const hasPermission = requiredPermissions.every((p) => req.user!.permissions.includes(p))
    if (!hasPermission) {
      logger.warn(`User ${req.user.email} lacking required permissions: ${requiredPermissions.join(", ")}`)
      return sendError(res, "Forbidden: Insufficient privileges", null, 403)
    }

    next()
  }
}
