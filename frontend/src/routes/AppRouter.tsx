import { Route, Routes, Navigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { CandidateLayout } from "@/layouts/CandidateLayout"
import { RecruiterLayout } from "@/layouts/RecruiterLayout"
import { AdminLayout } from "@/layouts/AdminLayout"
import { CandidateRoutes } from "./CandidateRoutes"
import { RecruiterRoutes } from "./RecruiterRoutes"
import { AdminRoutes } from "./AdminRoutes"
import { AuthRoutes } from "./AuthRoutes"
import { ProtectedRoute } from "./ProtectedRoute"
import { OAuthCallback } from "@/features/auth/pages/OAuthCallback"
import { CompanyVerification } from "@/features/auth/pages/CompanyVerification"
import { NotFoundPage } from "@/components/shared/errors/NotFoundPage"
import { UnauthorizedPage } from "@/components/shared/errors/UnauthorizedPage"
import { ServerErrorPage } from "@/components/shared/errors/ServerErrorPage"

export function DashboardRedirect() {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#6B2C91]" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth/login" replace />
  }

  // Checks against the user's full role list, not just roles[0] -- an admin
  // account can hold multiple roles, and relying on array order would send
  // some legitimately admin-tier users to the wrong dashboard entirely.
  const roles = (user.roles || []).map((r) => r.toLowerCase())
  const isAdminTier = roles.some((r) =>
    ["admin", "super admin", "moderator", "support executive"].includes(r)
  )
  if (isAdminTier) {
    return <Navigate to="/admin/dashboard" replace />
  } else if (roles.includes("recruiter")) {
    return <Navigate to="/recruiter/dashboard" replace />
  } else {
    return <Navigate to="/candidate/dashboard" replace />
  }
}

export function AppRouter() {
  return (
    <Routes>
      {/* No standalone home page -- this app is hosted on a subdomain and
          reached only via hyperlinks pointing directly at specific routes
          (e.g. /auth/login, /auth/register/candidate) from elsewhere. "/"
          itself just routes through the same dynamic redirector as the
          catch-all below: authenticated users land on their dashboard,
          ProtectedRoute bounces everyone else to /auth/login. */}
      <Route path="/" element={<DashboardRedirect />} />

      {/* Google OAuth handoff -- backend's googleCallback redirects here with
          ?token=<accessToken> after a successful login. Must be registered
          as its own top-level public route, or it falls through to the
          catch-all below and silently discards the token. */}
      <Route path="/oauth/callback" element={<OAuthCallback />} />

      {/* Secure, token-based company verification resubmission page (Part 3
          of the recruiter onboarding/approval spec) -- public, unauthenticated,
          reached only via the mailed link. Must be a top-level route, not
          nested under /auth/* or any ProtectedRoute. */}
      <Route path="/company-verification/:token" element={<CompanyVerification />} />

      {/* Dynamic Role-Based Redirector */}
      <Route path="/dashboard" element={<DashboardRedirect />} />

      {/* Candidate Module Routes (Protected) */}
      <Route
        path="/candidate/*"
        element={
          <ProtectedRoute allowedRoles={["Candidate"]}>
            <CandidateLayout />
          </ProtectedRoute>
        }
      >
        <Route path="*" element={<CandidateRoutes />} />
      </Route>

      {/* Recruiter Module Routes (Protected) */}
      <Route
        path="/recruiter/*"
        element={
          <ProtectedRoute allowedRoles={["Recruiter", "Admin", "Super Admin"]}>
            <RecruiterLayout />
          </ProtectedRoute>
        }
      >
        <Route path="*" element={<RecruiterRoutes />} />
      </Route>

      {/* Admin Module Routes (Protected) -- all four admin-tier roles belong
          here (must match admin.routes.ts's ADMIN_TIER_ROLES on the backend).
          Moderator and Support Executive were previously missing from this
          list, so those accounts could authenticate fine but got bounced to
          /unauthorized the moment React Router tried to render anything
          under /admin/*, even though the backend already permitted them. */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={["Admin", "Super Admin", "Moderator", "Support Executive"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="*" element={<AdminRoutes />} />
      </Route>

      {/* Auth Routes */}
      <Route path="/auth/*" element={<AuthRoutes />} />

      {/* Error and Fallback Pages */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/500" element={<ServerErrorPage />} />
      <Route path="/404" element={<NotFoundPage />} />

      {/* Fallback Catch-All redirects to Dynamic Redirector */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default AppRouter
