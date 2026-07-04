import { Route, Routes, Navigate } from "react-router-dom"
import { CandidateLayout } from "@/layouts/CandidateLayout"
import { RecruiterLayout } from "@/layouts/RecruiterLayout"
import { AdminLayout } from "@/layouts/AdminLayout"
import { CandidateRoutes } from "./CandidateRoutes"
import { RecruiterRoutes } from "./RecruiterRoutes"
import { AdminRoutes } from "./AdminRoutes"
import { AuthRoutes } from "./AuthRoutes"
import { ProtectedRoute } from "./ProtectedRoute"
import { UserRole } from "@/constants/roles"
import { NotFoundPage } from "@/components/shared/errors/NotFoundPage"
import { UnauthorizedPage } from "@/components/shared/errors/UnauthorizedPage"
import { ServerErrorPage } from "@/components/shared/errors/ServerErrorPage"

export function AppRouter() {
  return (
    <Routes>
      {/* Candidate Module Routes */}
      <Route element={<CandidateLayout />}>
        <Route path="/*" element={<CandidateRoutes />} />
      </Route>

      {/* Recruiter Module Routes (Protected) */}
      <Route
        path="/recruiter/*"
        element={
          <ProtectedRoute allowedRoles={[UserRole.RECRUITER, UserRole.ADMIN]}>
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
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="*" element={<AdminRoutes />} />
      </Route>

      {/* Auth Routes */}
      <Route path="/auth/*" element={<AuthRoutes />} />

      {/* Error and Fallback pages */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/500" element={<ServerErrorPage />} />
      <Route path="/404" element={<NotFoundPage />} />

      {/* Fallback Catch-All */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
export default AppRouter
