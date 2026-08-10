import type { Request, Response, NextFunction, RequestHandler } from "express"
import prisma from "../../shared/database/db"
import env from "../../shared/config/env"
import { sendError } from "../../shared/utils/response"
import { logger } from "../../shared/utils/logger"
import { PermissionCacheManager } from "../../shared/utils/permissionCache"
import { calculateProfileCompletion } from "../../shared/utils/profileCompletion"
import { UserStatus } from "@prisma/client"

/**
 * Asserts the user is active (not blocked, suspended, or pending verification).
 */
export async function requireActiveUser(req: Request, res: Response, next: NextFunction) {
  const user = req.user
  if (!user) {
    return sendError(res, "Authentication required", null, 401)
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
    })

    if (!dbUser) {
      return sendError(res, "User record not found", null, 404)
    }

    if (dbUser.status !== UserStatus.Active) {
      logger.warn(`[requireActiveUser] User ${user.email} is in status: ${dbUser.status}`)
      return sendError(res, `Forbidden: User account is in status ${dbUser.status}`, null, 403)
    }

    next()
  } catch (err: any) {
    logger.error(`[requireActiveUser] Error checking user state: ${err.message}`)
    return sendError(res, "Internal server error during authorization", null, 500)
  }
}

/**
 * Asserts the user is not Blocked.
 */
export async function requireNotBlocked(req: Request, res: Response, next: NextFunction) {
  const user = req.user
  if (!user) {
    return sendError(res, "Authentication required", null, 401)
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
    })

    if (!dbUser || dbUser.status === UserStatus.Blocked) {
      logger.warn(`[requireNotBlocked] User ${user.email} is blocked`)
      return sendError(res, "Forbidden: User account is blocked", null, 403)
    }

    next()
  } catch (err: any) {
    logger.error(`[requireNotBlocked] Error checking user state: ${err.message}`)
    return sendError(res, "Internal server error during authorization", null, 500)
  }
}

/**
 * Asserts the user is not Suspended.
 */
export async function requireNotSuspended(req: Request, res: Response, next: NextFunction) {
  const user = req.user
  if (!user) {
    return sendError(res, "Authentication required", null, 401)
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
    })

    if (!dbUser || dbUser.status === UserStatus.Suspended) {
      logger.warn(`[requireNotSuspended] User ${user.email} is suspended`)
      return sendError(res, "Forbidden: User account is suspended", null, 403)
    }

    next()
  } catch (err: any) {
    logger.error(`[requireNotSuspended] Error checking user state: ${err.message}`)
    return sendError(res, "Internal server error during authorization", null, 500)
  }
}

/**
 * Asserts user status is not PendingVerification.
 */
export async function requireVerifiedEmail(req: Request, res: Response, next: NextFunction) {
  const user = req.user
  if (!user) {
    return sendError(res, "Authentication required", null, 401)
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
    })

    if (!dbUser || dbUser.status === UserStatus.PendingVerification) {
      logger.warn(`[requireVerifiedEmail] User ${user.email} email is not verified`)
      return sendError(res, "Forbidden: Email verification required", null, 403)
    }

    next()
  } catch (err: any) {
    logger.error(`[requireVerifiedEmail] Error checking verification: ${err.message}`)
    return sendError(res, "Internal server error during authorization", null, 500)
  }
}

/**
 * Asserts that if user is recruiter, company verification status is approved.
 */
export async function requireApprovedCompany(req: Request, res: Response, next: NextFunction) {
  const user = req.user
  if (!user) {
    return sendError(res, "Authentication required", null, 401)
  }

  try {
    // If not a recruiter, bypass
    if (!user.roles.includes("Recruiter")) {
      return next()
    }

    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId: user.userId },
      include: { company: true },
    })

    if (!profile || !profile.company || profile.company.status !== "approved") {
      logger.warn(`[requireApprovedCompany] Recruiter ${user.email} lacks an approved company`)
      return sendError(res, "Forbidden: Recruiter company approval is pending/rejected", null, 403)
    }

    next()
  } catch (err: any) {
    logger.error(`[requireApprovedCompany] Error checking company status: ${err.message}`)
    return sendError(res, "Internal server error during authorization", null, 500)
  }
}

/**
 * Asserts profile completion is above threshold.
 */
export async function requireProfileCompleted(req: Request, res: Response, next: NextFunction) {
  const user = req.user
  if (!user) {
    return sendError(res, "Authentication required", null, 401)
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      include: {
        roles: { include: { role: true } },
        candidateProfile: { include: { skills: true } },
        recruiterProfile: { include: { company: true } },
      },
    })

    if (!dbUser) {
      return sendError(res, "User not found", null, 404)
    }

    const completion = calculateProfileCompletion(dbUser)
    const threshold = env.PROFILE_COMPLETION_THRESHOLD

    if (completion < threshold) {
      logger.warn(`[requireProfileCompleted] User ${user.email} profile incomplete (${completion}% / ${threshold}%)`)
      return sendError(res, `Forbidden: Profile incomplete (${completion}%). Threshold is ${threshold}%.`, null, 403)
    }

    next()
  } catch (err: any) {
    logger.error(`[requireProfileCompleted] Error checking profile completion: ${err.message}`)
    return sendError(res, "Internal server error during authorization", null, 500)
  }
}

/**
 * Asserts user holds all required permissions, leveraging Redis permission cache.
 */
export function requirePermission(requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) {
      return sendError(res, "Authentication required", null, 401)
    }

    try {
      const permissions = await PermissionCacheManager.getUserPermissions(user.userId)
      const hasPermission = requiredPermissions.every((p) => permissions.includes(p))

      if (!hasPermission) {
        logger.warn(`[requirePermission] User ${user.email} lacks permissions: ${requiredPermissions.join(", ")}`)
        return sendError(res, "Forbidden: Insufficient privileges", null, 403)
      }

      next()
    } catch (err: any) {
      logger.error(`[requirePermission] Cache check error: ${err.message}`)
      return sendError(res, "Internal server error during authorization", null, 500)
    }
  }
}

/**
 * Restricts access to resource owners or Admin users.
 */
export function requireOwnership(modelName: string, idParamName: string = "id") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) {
      return sendError(res, "Authentication required", null, 401)
    }

    // Admin/Super Admin bypasses ownership
    const isAdmin = user.roles.some((r) => ["Super Admin", "Admin"].includes(r))
    if (isAdmin) {
      return next()
    }

    const resourceId = req.params[idParamName] as string
    if (!resourceId) {
      return sendError(res, `Required request param '${idParamName}' not found`, null, 400)
    }

    try {
      let isOwner = false

      switch (modelName) {
        case "User":
          isOwner = resourceId === user.userId
          break

        case "CandidateProfile":
          const candidate = await prisma.candidateProfile.findUnique({
            where: { id: resourceId },
          })
          isOwner = candidate?.userId === user.userId
          break

        case "RecruiterProfile":
          const recruiter = await prisma.recruiterProfile.findUnique({
            where: { id: resourceId },
          })
          isOwner = recruiter?.userId === user.userId
          break

        case "Job":
          const job: any = await prisma.job.findUnique({
            where: { id: resourceId },
            include: { recruiter: true },
          })
          const recruiterProfile = await prisma.recruiterProfile.findUnique({
            where: { userId: user.userId },
          })
          isOwner =
            job?.recruiter?.userId === user.userId ||
            (job?.companyId && recruiterProfile?.companyId && job.companyId === recruiterProfile.companyId)
          break

        case "Application":
          const app: any = await prisma.application.findUnique({
            where: { id: resourceId },
            include: {
              candidate: true,
              job: { include: { recruiter: true } },
            },
          })
          const recProfile = await prisma.recruiterProfile.findUnique({
            where: { userId: user.userId },
          })
          isOwner =
            app?.candidate?.userId === user.userId ||
            app?.job?.recruiter?.userId === user.userId ||
            (app?.job?.companyId && recProfile?.companyId && app.job.companyId === recProfile.companyId)
          break

        default:
          logger.warn(`[requireOwnership] Unsupported model name: ${modelName}`)
          return sendError(res, "Forbidden: Unsupported model requested", null, 403)
      }

      if (!isOwner) {
        logger.warn(`[requireOwnership] User ${user.email} fails ownership check for ${modelName}:${resourceId}`)
        return sendError(res, "Forbidden: You do not own this resource", null, 403)
      }

      next()
    } catch (err: any) {
      logger.error(`[requireOwnership] Error checking ownership of ${modelName}: ${err.message}`)
      return sendError(res, "Internal server error during authorization", null, 500)
    }
  }
}

/**
 * Restricts access to Super Admin users only.
 */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user
  if (!user) {
    return sendError(res, "Authentication required", null, 401)
  }

  if (!user.roles.includes("Super Admin")) {
    logger.warn(`[requireSuperAdmin] User ${user.email} fails Super Admin check`)
    return sendError(res, "Forbidden: Super Admin role required", null, 403)
  }

  next()
}

/**
 * Composes several Express middlewares so a route can require ALL of them to
 * pass. Every middleware in this module either calls next() with no error on
 * success, or sends its own 4xx/5xx response directly and never calls next()
 * at all on failure -- so a bare short-circuiting sequence is all that's
 * needed here, no error-first plumbing. Used to layer a real
 * requirePermission() check alongside an existing, more specific role-name
 * gate (e.g. requireSuperAdmin) without loosening it -- see admin.routes.ts
 * and rbac.routes.ts for examples. Previously duplicated as a private local
 * function inside admin.routes.ts; centralized here once rbac.routes.ts
 * needed the same pattern for its own routes.
 */
export function requireAll(...middlewares: RequestHandler[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    let i = 0
    const run = (err?: any) => {
      if (err) return next(err)
      if (i >= middlewares.length) return next()
      const mw = middlewares[i++]
      mw(req, res, run)
    }
    run()
  }
}
