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
import { LandingPage } from "@/features/landing/LandingPage"
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

  const role = user.roles[0]?.toLowerCase()
  if (role === "admin" || role === "super admin") {
    return <Navigate to="/admin/dashboard" replace />
  } else if (role === "recruiter") {
    return <Navigate to="/recruiter/dashboard" replace />
  } else {
    return <Navigate to="/candidate/dashboard" replace />
  }
}

export function AppRouter() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<Navigate to="/#about" replace />} />
      <Route path="/contact" element={<Navigate to="/#contact" replace />} />
      <Route path="/faq" element={<Navigate to="/#faq" replace />} />

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

      {/* Admin Module Routes (Protected) */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={["Admin", "Super Admin"]}>
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
