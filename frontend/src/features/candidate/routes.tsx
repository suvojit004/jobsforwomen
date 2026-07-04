import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { DashboardPageSkeleton } from "@/components/dashboard/DashboardSkeletons"

const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard }))
)
const Profile = lazy(() =>
  import("./pages/Profile").then((m) => ({ default: m.Profile }))
)
const BrowseJobs = lazy(() =>
  import("./pages/BrowseJobs").then((m) => ({ default: m.BrowseJobs }))
)
const JobDetails = lazy(() =>
  import("./pages/JobDetails").then((m) => ({ default: m.JobDetails }))
)
const SavedJobs = lazy(() =>
  import("./pages/SavedJobs").then((m) => ({ default: m.SavedJobs }))
)
const Applications = lazy(() =>
  import("./pages/Applications").then((m) => ({ default: m.Applications }))
)
const Notifications = lazy(() =>
  import("./pages/Notifications").then((m) => ({ default: m.Notifications }))
)
const Messages = lazy(() =>
  import("./pages/Messages").then((m) => ({ default: m.Messages }))
)
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings }))
)

export function CandidateRoutes() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="jobs" element={<BrowseJobs />} />
        <Route path="jobs/:id" element={<JobDetails />} />
        <Route path="saved-jobs" element={<SavedJobs />} />
        <Route path="applications" element={<Applications />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="messages" element={<Messages />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
