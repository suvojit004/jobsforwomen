import type { CookieOptions } from "express"
import env from "../config/env"

// Name of the HttpOnly refresh-token cookie. Every place that sets, reads, or
// clears this cookie (login, oauth, googleCallback, refresh, logout) must use
// this exact constant so the options can never drift out of sync.
export const REFRESH_COOKIE_NAME = "jid"
export const REFRESH_COOKIE_PATH = "/api/v1/auth/refresh"
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// Frontend and backend are separate origins in every real deployment, so the
// refresh cookie must be cross-site: SameSite=None requires Secure (browsers
// drop it otherwise), and SameSite=Lax is never sent on cross-site fetch/XHR
// at all. Gated on "not local dev" rather than "is production" so a missing
// NODE_ENV on Render fails safe (stays secure/cross-site) instead of
// silently downgrading to a cookie the browser won't send back.
const isLocalDev = env.NODE_ENV === "development"

export function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: !isLocalDev,
    sameSite: isLocalDev ? "lax" : "none",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  }
}

// clearCookie must be called with the same name/path/secure/sameSite the
// cookie was originally set with, or the browser treats it as clearing a
// different cookie and leaves the real one in place. maxAge/httpOnly are not
// needed to clear a cookie, so they're intentionally omitted here.
export function getClearRefreshCookieOptions(): CookieOptions {
  return {
    path: REFRESH_COOKIE_PATH,
    secure: !isLocalDev,
    sameSite: isLocalDev ? "lax" : "none",
  }
}
