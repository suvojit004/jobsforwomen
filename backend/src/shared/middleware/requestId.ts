import type { Request, Response, NextFunction } from "express"
import crypto from "crypto"
import { correlationLocalStorage } from "../utils/correlationContext"

export function requestId(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.header("x-correlation-id") || req.header("x-request-id") || crypto.randomUUID()) as string
  req.headers["x-correlation-id"] = correlationId
  req.headers["x-request-id"] = correlationId
  res.setHeader("x-correlation-id", correlationId)
  res.setHeader("x-request-id", correlationId)

  correlationLocalStorage.run(correlationId, () => {
    next()
  })
}

export default requestId
