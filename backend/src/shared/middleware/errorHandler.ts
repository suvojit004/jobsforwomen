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
    logger.error(`[Req: ${reqId}] Database Error: ${err.message}`)
    return sendError(res, "Database operation failed", null, 400)
  }

  // Handle AppError
  if (err instanceof AppError) {
    logger.warn(`[Req: ${reqId}] AppError: ${err.message} (${err.statusCode})`)
    return sendError(res, err.message, null, err.statusCode)
  }

  // Map known error messages to correct HTTP status codes
  const message = err.message || ""
  if (message.includes("Invalid email or password") || message.includes("invalid credentials")) {
    logger.warn(`[Req: ${reqId}] Authentication failure: ${message}`)
    return sendError(res, message, null, 401)
  }

  if (
    message.includes("verify your email address first") ||
    message.includes("account has been blocked") ||
    message.includes("account has been suspended") ||
    message.includes("account application was rejected")
  ) {
    logger.warn(`[Req: ${reqId}] Access forbidden: ${message}`)
    return sendError(res, message, null, 403)
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
