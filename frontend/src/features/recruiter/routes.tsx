import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { DashboardPageSkeleton } from "@/components/dashboard/DashboardSkeletons"

const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard }))
)
const PostJob = lazy(() =>
  import("./pages/PostJob").then((m) => ({ default: m.PostJob }))
)
const ManageJobs = lazy(() =>
  import("./pages/ManageJobs").then((m) => ({ default: m.ManageJobs }))
)
const JobDetails = lazy(() =>
  import("./pages/JobDetails").then((m) => ({ default: m.JobDetails }))
)
const Applicants = lazy(() =>
  import("./pages/Applicants").then((m) => ({ default: m.Applicants }))
)
const CandidatePreview = lazy(() =>
  import("./pages/CandidatePreview").then((m) => ({ default: m.CandidatePreview }))
)
const CompanyProfile = lazy(() =>
  import("./pages/CompanyProfile").then((m) => ({ default: m.CompanyProfile }))
)
const Analytics = lazy(() =>
  import("./pages/Analytics").then((m) => ({ default: m.Analytics }))
)
const Messages = lazy(() =>
  import("./pages/Messages").then((m) => ({ default: m.Messages }))
)
const Notifications = lazy(() =>
  import("./pages/Notifications").then((m) => ({ default: m.Notifications }))
)
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings }))
)
const Help = lazy(() =>
  import("./pages/Help").then((m) => ({ default: m.Help }))
)
const Logout = lazy(() =>
  import("./pages/Logout").then((m) => ({ default: m.Logout }))
)

export function RecruiterRoutes() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="post-job" element={<PostJob />} />
        <Route path="manage-jobs" element={<ManageJobs />} />
        <Route path="jobs/:id" element={<JobDetails />} />
        <Route path="applicants" element={<Applicants />} />
        <Route path="applicants/:id" element={<CandidatePreview />} />
        <Route path="company" element={<CompanyProfile />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="messages" element={<Messages />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="help" element={<Help />} />
        <Route path="logout" element={<Logout />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
