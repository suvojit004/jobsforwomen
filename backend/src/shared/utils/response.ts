import type { Response } from "express"
import { signFileUrlsDeep } from "./fileStorage"

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  errors?: any
  requestId?: string
}

export function sendSuccess<T = any>(
  res: Response,
  data: T,
  message = "Operation completed successfully",
  statusCode = 200
) {
  // Every private-document URL (resume, offer letter, verification/perk
  // document) gets a fresh time-limited signature stamped on here, right
  // before it leaves the server -- see fileStorage.ts's signFileUrlsDeep()
  // for why this is the one place that needs to know about signing rather
  // than every DTO/service that happens to return a file URL.
  const responsePayload: ApiResponse<T> = {
    success: true,
    message,
    data: signFileUrlsDeep(data),
    requestId: res.getHeader("x-request-id") as string || undefined,
  }
  return res.status(statusCode).json(responsePayload)
}

export function sendError(
  res: Response,
  message = "An error occurred",
  errors: any = null,
  statusCode = 500
) {
  const responsePayload: ApiResponse = {
    success: false,
    message,
    errors,
    requestId: res.getHeader("x-request-id") as string || undefined,
  }
  return res.status(statusCode).json(responsePayload)
}
