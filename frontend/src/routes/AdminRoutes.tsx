import { lazy, Suspense } from "react"
import { Route, Routes, Navigate } from "react-router-dom"
import { DashboardPageSkeleton } from "@/components/dashboard/DashboardSkeletons"

const Dashboard = lazy(() => import("@/features/admin/pages/Dashboard").then(m => ({ default: m.Dashboard })))
const CompanyApprovals = lazy(() => import("@/features/admin/pages/CompanyApprovals").then(m => ({ default: m.CompanyApprovals })))
const CandidateManagement = lazy(() => import("@/features/admin/pages/CandidateManagement").then(m => ({ default: m.CandidateManagement })))
const CompanyDetails = lazy(() => import("@/features/admin/pages/CompanyDetails").then(m => ({ default: m.CompanyDetails })))
const JobModeration = lazy(() => import("@/features/admin/pages/JobModeration").then(m => ({ default: m.JobModeration })))
const UserModeration = lazy(() => import("@/features/admin/pages/UserModeration").then(m => ({ default: m.UserModeration }))) // Users
const ReportsAnalytics = lazy(() => import("@/features/admin/pages/ReportsAnalytics").then(m => ({ default: m.ReportsAnalytics })))
const Notifications = lazy(() => import("@/features/admin/pages/Notifications").then(m => ({ default: m.Notifications })))
const Settings = lazy(() => import("@/features/admin/pages/Settings").then(m => ({ default: m.Settings })))
const ActivityLogs = lazy(() => import("@/features/admin/pages/ActivityLogs").then(m => ({ default: m.ActivityLogs })))
const HelpSupport = lazy(() => import("@/features/admin/pages/HelpSupport").then(m => ({ default: m.HelpSupport })))
const Logout = lazy(() => import("@/features/admin/pages/Logout").then(m => ({ default: m.Logout })))

export function AdminRoutes() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="company-approvals" element={<CompanyApprovals />} />
        <Route path="candidate-management" element={<CandidateManagement />} />
        <Route path="company-details" element={<CompanyDetails />} />
        <Route path="job-moderation" element={<JobModeration />} />
        <Route path="users" element={<UserModeration />} />
        <Route path="reports-analytics" element={<ReportsAnalytics />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="activity-logs" element={<ActivityLogs />} />
        <Route path="help-support" element={<HelpSupport />} />
        <Route path="logout" element={<Logout />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
export default AdminRoutes
