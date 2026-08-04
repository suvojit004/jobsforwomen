import jwt from "jsonwebtoken"
import crypto from "crypto"
import env from "../config/env"

interface TokenPayload {
  userId: string
  email: string
  roles: string[]
  permissions: string[]
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as any,
  })
}

export function generateRefreshToken(payload: TokenPayload): string {
  // jsonwebtoken's `iat` claim only has 1-second precision, so two logins
  // for the same user within the same second (double-click, frontend retry,
  // double form submit) previously produced a byte-for-byte identical
  // signed JWT -- payload, iat, and exp all matched -- which then collided
  // on the unique `token` column in refreshToken.create(). A random `jti`
  // per token makes every refresh token unique by construction instead of
  // relying on sub-second timing.
  return jwt.sign({ ...payload }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as any,
    jwtid: crypto.randomUUID(),
  })
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload
  } catch {
    return null
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload
  } catch {
    return null
  }
}
