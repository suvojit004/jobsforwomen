import { lazy, Suspense } from "react"
import { Route, Routes, Navigate } from "react-router-dom"
import { DashboardPageSkeleton } from "@/components/dashboard/DashboardSkeletons"

const Dashboard = lazy(() => import("@/features/admin/pages/Dashboard").then(m => ({ default: m.Dashboard })))
const CompanyApprovals = lazy(() => import("@/features/admin/pages/CompanyApprovals").then(m => ({ default: m.CompanyApprovals })))
const CompanyPerkRequests = lazy(() => import("@/features/admin/pages/CompanyPerkRequests").then(m => ({ default: m.CompanyPerkRequests })))
const CandidateManagement = lazy(() => import("@/features/admin/pages/CandidateManagement").then(m => ({ default: m.CandidateManagement })))
const CompanyDetails = lazy(() => import("@/features/admin/pages/CompanyDetails").then(m => ({ default: m.CompanyDetails })))
const CandidateDetails = lazy(() => import("@/features/admin/pages/CandidateDetails").then(m => ({ default: m.CandidateDetails })))
const JobModeration = lazy(() => import("@/features/admin/pages/JobModeration").then(m => ({ default: m.JobModeration })))
const UserModeration = lazy(() => import("@/features/admin/pages/UserModeration").then(m => ({ default: m.UserModeration }))) // Users
const ReportsAnalytics = lazy(() => import("@/features/admin/pages/ReportsAnalytics").then(m => ({ default: m.ReportsAnalytics })))
const Notifications = lazy(() => import("@/features/admin/pages/Notifications").then(m => ({ default: m.Notifications })))
const Settings = lazy(() => import("@/features/admin/pages/Settings").then(m => ({ default: m.Settings })))
const ActivityLogs = lazy(() => import("@/features/admin/pages/ActivityLogs").then(m => ({ default: m.ActivityLogs })))
const HelpSupport = lazy(() => import("@/features/admin/pages/HelpSupport").then(m => ({ default: m.HelpSupport })))
const SupportTickets = lazy(() => import("@/features/admin/pages/SupportTickets").then(m => ({ default: m.SupportTickets })))
const FeatureConfigs = lazy(() => import("@/features/admin/pages/FeatureConfigs").then(m => ({ default: m.FeatureConfigs })))
const RolesPermissions = lazy(() => import("@/features/admin/pages/RolesPermissions").then(m => ({ default: m.RolesPermissions })))
const AdminManagement = lazy(() => import("@/features/admin/pages/AdminManagement").then(m => ({ default: m.AdminManagement })))
const SystemHealth = lazy(() => import("@/features/admin/pages/SystemHealth").then(m => ({ default: m.SystemHealth })))
const Logout = lazy(() => import("@/features/admin/pages/Logout").then(m => ({ default: m.Logout })))

export function AdminRoutes() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="company-approvals" element={<CompanyApprovals />} />
        <Route path="company-perk-requests" element={<CompanyPerkRequests />} />
        <Route path="candidate-management" element={<CandidateManagement />} />
        <Route path="company-details" element={<CompanyDetails />} />
        <Route path="candidate-details" element={<CandidateDetails />} />
        <Route path="job-moderation" element={<JobModeration />} />
        <Route path="users" element={<UserModeration />} />
        <Route path="reports-analytics" element={<ReportsAnalytics />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="activity-logs" element={<ActivityLogs />} />
        <Route path="feature-configs" element={<FeatureConfigs />} />
        <Route path="roles-permissions" element={<RolesPermissions />} />
        <Route path="admin-management" element={<AdminManagement />} />
        <Route path="system-health" element={<SystemHealth />} />
        <Route path="help-support" element={<HelpSupport />} />
        <Route path="support-tickets" element={<SupportTickets />} />
        <Route path="logout" element={<Logout />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
export default AdminRoutes
