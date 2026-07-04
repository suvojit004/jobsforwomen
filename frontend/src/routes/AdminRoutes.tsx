import { lazy, Suspense } from "react"
import { Route, Routes, Navigate } from "react-router-dom"
import { DashboardPageSkeleton } from "@/components/dashboard/DashboardSkeletons"

const Dashboard = lazy(() => import("@/features/admin/pages/Dashboard").then(m => ({ default: m.Dashboard })))
const UserModeration = lazy(() => import("@/features/admin/pages/UserModeration").then(m => ({ default: m.UserModeration })))
const JobModeration = lazy(() => import("@/features/admin/pages/JobModeration").then(m => ({ default: m.JobModeration })))
const CompanyVerification = lazy(() => import("@/features/admin/pages/CompanyVerification").then(m => ({ default: m.CompanyVerification })))
const AuditLogs = lazy(() => import("@/features/admin/pages/AuditLogs").then(m => ({ default: m.AuditLogs })))
const Reports = lazy(() => import("@/features/admin/pages/Reports").then(m => ({ default: m.Reports })))
const SystemHealth = lazy(() => import("@/features/admin/pages/SystemHealth").then(m => ({ default: m.SystemHealth })))
const RolesPermissions = lazy(() => import("@/features/admin/pages/RolesPermissions").then(m => ({ default: m.RolesPermissions })))
const FeatureConfigs = lazy(() => import("@/features/admin/pages/FeatureConfigs").then(m => ({ default: m.FeatureConfigs })))
const Settings = lazy(() => import("@/features/admin/pages/Settings").then(m => ({ default: m.Settings })))
const Logout = lazy(() => import("@/features/admin/pages/Logout").then(m => ({ default: m.Logout })))

export function AdminRoutes() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="users" element={<UserModeration />} />
        <Route path="jobs" element={<JobModeration />} />
        <Route path="companies" element={<CompanyVerification />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="reports" element={<Reports />} />
        <Route path="health" element={<SystemHealth />} />
        <Route path="permissions" element={<RolesPermissions />} />
        <Route path="features" element={<FeatureConfigs />} />
        <Route path="settings" element={<Settings />} />
        <Route path="logout" element={<Logout />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
export default AdminRoutes
