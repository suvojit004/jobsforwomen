import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"

// The backend's googleCallback redirects the browser here with
// `?token=<accessToken>` after a successful Google OAuth login (see
// auth.controller.ts's googleCallback). Previously there was no route
// registered for this exact path anywhere in the frontend router, so this
// URL always fell through to AppRouter's catch-all `<Navigate to="/dashboard"
// />` -- silently discarding the access token in the query string on every
// single Google login before any component ever had a chance to read it.
export function OAuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { refreshSession } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const ranRef = useRef(false)

  useEffect(() => {
    // React 18 StrictMode double-invokes effects in development; guard so we
    // don't process the token or navigate twice.
    if (ranRef.current) return
    ranRef.current = true

    async function completeOAuthLogin() {
      // The backend redirects here with ?error=<message> instead of ?token=
      // when OAuth itself fails or when the recruiter company-approval gate
      // (AuthService.createAuthSession) rejects the login -- e.g. a company
      // still pending or rejected. Show that specific message rather than
      // falling through to the generic "no token" case below.
      const oauthError = searchParams.get("error")
      if (oauthError) {
        setError(oauthError)
        return
      }

      const token = searchParams.get("token")
      if (!token) {
        setError("Google sign-in did not return a valid session. Please try again.")
        return
      }

      localStorage.setItem("jwt_token", token)

      // Re-syncs `user`/`isAuthenticated` in AuthContext from the freshly
      // issued refresh-token cookie (also set by googleCallback) and the
      // access token just stored above, exactly the same way a normal page
      // reload bootstraps the session. If this fails, the refresh-token
      // cookie itself wasn't accepted -- treat it as a failed login rather
      // than silently landing on a half-authenticated page.
      const user = await refreshSession()

      if (!user) {
        localStorage.removeItem("jwt_token")
        setError("We couldn't complete your Google sign-in. Please try again.")
        return
      }

      const role = user.roles[0]?.toLowerCase()
      if (role === "admin" || role === "super admin") {
        navigate("/admin/dashboard", { replace: true })
      } else if (role === "recruiter") {
        navigate("/recruiter/dashboard", { replace: true })
      } else {
        navigate("/candidate/dashboard", { replace: true })
      }
    }

    completeOAuthLogin()
  }, [searchParams, refreshSession, navigate])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FDFBFD] px-4 text-center dark:bg-slate-950">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{error}</p>
        <button
          type="button"
          onClick={() => navigate("/auth/login", { replace: true })}
          className="text-sm font-extrabold text-[#6B2C91] hover:underline dark:text-pink-300"
        >
          Back to login
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDFBFD] dark:bg-slate-950">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#6B2C91]" />
    </div>
  )
}

export default OAuthCallback
