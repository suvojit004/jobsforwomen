import type { Request, Response, NextFunction } from "express"
import { ZodError } from "zod"
import { logger } from "../utils/logger"
import { sendError } from "../utils/response"

export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 400) {
    super(message)
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const reqId = req.headers["x-request-id"] || "N/A"

  // Zod Validation Error handling
  if (err instanceof ZodError) {
    logger.warn(`[Req: ${reqId}] Validation failed: ${JSON.stringify(err.issues)}`)
    return sendError(res, "Validation failed", err.flatten().fieldErrors, 400)
  }

  // Check for Prisma / DB errors
  if (err.code && err.meta) {
    // P2002 = unique constraint violation -- this is a client-side conflict
    // (duplicate entry), not a genuine server failure, so it's a 409 not a 400.
    if (err.code === "P2002") {
      logger.warn(`[Req: ${reqId}] Duplicate record conflict: ${err.message}`)
      return sendError(res, "A record with these details already exists", null, 409)
    }
    // P2025 = record not found for update/delete
    if (err.code === "P2025") {
      logger.warn(`[Req: ${reqId}] Record not found: ${err.message}`)
      return sendError(res, "The requested record was not found", null, 404)
    }
    logger.error(`[Req: ${reqId}] Database Error: ${err.message}`)
    return sendError(res, "Database operation failed", null, 400)
  }

  // Handle AppError
  if (err instanceof AppError) {
    logger.warn(`[Req: ${reqId}] AppError: ${err.message} (${err.statusCode})`)
    return sendError(res, err.message, null, err.statusCode)
  }

  // Map known error messages to correct HTTP status codes.
  // NOTE: most service methods throw plain `new Error("...")` rather than
  // AppError, so without this mapping every business-rule rejection (not
  // found / forbidden / already exists / bad state transition) falls through
  // to the generic 500 branch below and gets logged as an "Unhandled
  // Exception" even though it's an entirely expected, non-server-side
  // failure. This won't catch every case (that would need every service to
  // throw AppError with an explicit code), but it covers the common,
  // recurring shapes seen across the auth/admin/recruiter/candidate modules.
  const message = err.message || ""
  if (message.includes("Invalid email or password") || message.includes("invalid credentials")) {
    logger.warn(`[Req: ${reqId}] Authentication failure: ${message}`)
    return sendError(res, message, null, 401)
  }

  if (
    message.includes("verify your email address first") ||
    message.includes("account has been blocked") ||
    message.includes("account has been suspended") ||
    message.includes("account application was rejected") ||
    message.includes("configured for Google login")
  ) {
    logger.warn(`[Req: ${reqId}] Access forbidden: ${message}`)
    return sendError(res, message, null, 403)
  }

  // Recruiter company-approval gate (AuthService.assertRecruiterCompanyApproved,
  // called from createAuthSession on login/oauth/refresh). Without this
  // mapping these three business-rule rejections would fall through to the
  // generic 500 branch below and be logged as server faults even though
  // they're an entirely expected "your company isn't approved yet" outcome.
  if (
    message.includes("company verification is still pending") ||
    message.includes("Company verification rejected") ||
    message.includes("Additional information is required to complete your company verification")
  ) {
    logger.warn(`[Req: ${reqId}] Recruiter company approval gate: ${message}`)
    return sendError(res, message, null, 403)
  }

  if (message.includes("Forbidden") || message.includes("Access denied") || message.includes("not authorized") || message.includes("Not authorized")) {
    logger.warn(`[Req: ${reqId}] Forbidden: ${message}`)
    return sendError(res, message, null, 403)
  }

  if (message.toLowerCase().includes("not found")) {
    logger.warn(`[Req: ${reqId}] Not found: ${message}`)
    return sendError(res, message, null, 404)
  }

  if (
    message.includes("already exists") ||
    message.includes("already applied") ||
    message.includes("duplicate") ||
    message.includes("Cannot delete built-in system role") ||
    message.includes("currently assigned to")
  ) {
    logger.warn(`[Req: ${reqId}] Conflict: ${message}`)
    return sendError(res, message, null, 409)
  }

  // Public company-verification resubmission flow (Part 3). Both are
  // client-facing, expected outcomes -- an expired/reused link, or a
  // malformed document category -- not server faults.
  if (
    message.includes("verification link is invalid or has expired") ||
    message.includes("Invalid document category")
  ) {
    logger.warn(`[Req: ${reqId}] Company verification request rejected: ${message}`)
    return sendError(res, message, null, 400)
  }

  if (
    message.includes("Invalid status transition") ||
    message.includes("terminal state") ||
    message.includes("requires additional details") ||
    message.includes("Cannot schedule") ||
    message.includes("Cannot release")
  ) {
    logger.warn(`[Req: ${reqId}] Invalid state transition: ${message}`)
    return sendError(res, message, null, 400)
  }

  // Fallback for general unhandled exceptions
  logger.error(`[Req: ${reqId}] Unhandled Exception: ${err.stack || err.message || err}`)
  
  const isProduction = process.env.NODE_ENV === "production"
  return sendError(
    res,
    isProduction ? "Internal server error" : err.message || "Something went wrong",
    isProduction ? null : err.stack,
    err.status || err.statusCode || 500
  )
}

export default errorHandler
