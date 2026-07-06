import type { Response } from "express"

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
  const responsePayload: ApiResponse<T> = {
    success: true,
    message,
    data,
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
