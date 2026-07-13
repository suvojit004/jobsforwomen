import type { CookieOptions } from "express"
import env from "../config/env"

// Name of the HttpOnly refresh-token cookie. Every place that sets, reads, or
// clears this cookie (login, oauth, googleCallback, refresh, logout) must use
// this exact constant so the options can never drift out of sync with each
// other -- previously these were 4 separately hand-written option literals in
// auth.controller.ts that happened to agree, but nothing enforced that.
export const REFRESH_COOKIE_NAME = "jid"
export const REFRESH_COOKIE_PATH = "/api/v1/auth/refresh"
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// This app is deployed as two separate origins in every real environment
// that matters (Vercel frontend + Render backend), so the refresh cookie
// must be sent cross-site. A SameSite=None cookie is REQUIRED to be Secure
// (browsers silently drop it otherwise), and SameSite=Lax cookies are never
// sent on cross-site fetch/XHR at all (only top-level navigations) -- so
// "not secure/cross-site-capable" isn't a softer fallback, it's a cookie
// that silently never reaches the backend on the very next API call.
//
// Previously this was gated on `process.env.NODE_ENV === "production"`, but
// env.ts's schema defaults NODE_ENV to "development" when the variable isn't
// set -- and Render does not automatically set NODE_ENV=production for a
// generic Node web service. If that env var is ever missing on Render, this
// condition silently flips every cookie in the app to
// { secure: false, sameSite: "lax" }, which browsers refuse to send back on
// the cross-site POST /api/v1/auth/refresh call that follows every login --
// producing exactly the "callback succeeds, refresh 401s" symptom this cookie
// module was introduced to fix.
//
// Inverting the condition (opt OUT of secure cross-site cookies only when
// explicitly in local development, rather than opting IN only when
// explicitly "production") means any future NODE_ENV misconfiguration fails
// safe -- deployed traffic keeps working instead of silently breaking.
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
