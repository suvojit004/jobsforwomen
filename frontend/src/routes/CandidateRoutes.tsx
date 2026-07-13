import { lazy } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

const Dashboard = lazy(() => import("@/features/candidate/pages/Dashboard").then(m => ({ default: m.Dashboard })))
const Profile = lazy(() => import("@/features/candidate/pages/Profile").then(m => ({ default: m.Profile })))
const BrowseJobs = lazy(() => import("@/features/candidate/pages/BrowseJobs").then(m => ({ default: m.BrowseJobs })))
const JobDetails = lazy(() => import("@/features/candidate/pages/JobDetails").then(m => ({ default: m.JobDetails })))
const SavedJobs = lazy(() => import("@/features/candidate/pages/SavedJobs").then(m => ({ default: m.SavedJobs })))
const Applications = lazy(() => import("@/features/candidate/pages/Applications").then(m => ({ default: m.Applications })))
const Notifications = lazy(() => import("@/features/candidate/pages/Notifications").then(m => ({ default: m.Notifications })))
const Messages = lazy(() => import("@/features/candidate/pages/Messages").then(m => ({ default: m.Messages })))
const Settings = lazy(() => import("@/features/candidate/pages/Settings").then(m => ({ default: m.Settings })))

export function CandidateRoutes() {
  return (
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
      <Route path="*" element={<Navigate to="/candidate/dashboard" replace />} />
    </Routes>
  )
}
export default CandidateRoutes
