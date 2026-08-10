import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { GenericDashboardSkeleton } from "@/components/shared/skeletons/PageSkeletons"

const Dashboard = lazy(() => import("@/features/recruiter/pages/Dashboard").then(m => ({ default: m.Dashboard })))
const PostJob = lazy(() => import("@/features/recruiter/pages/PostJob").then(m => ({ default: m.PostJob })))
const ManageJobs = lazy(() => import("@/features/recruiter/pages/ManageJobs").then(m => ({ default: m.ManageJobs })))
const JobDetails = lazy(() => import("@/features/recruiter/pages/JobDetails").then(m => ({ default: m.JobDetails })))
const Applicants = lazy(() => import("@/features/recruiter/pages/Applicants").then(m => ({ default: m.Applicants })))
const CandidatePreview = lazy(() => import("@/features/recruiter/pages/CandidatePreview").then(m => ({ default: m.CandidatePreview })))
const CompanyProfile = lazy(() => import("@/features/recruiter/pages/CompanyProfile").then(m => ({ default: m.CompanyProfile })))
const Perks = lazy(() => import("@/features/recruiter/pages/Perks").then(m => ({ default: m.Perks })))
const ApprovalRequests = lazy(() => import("@/features/recruiter/pages/ApprovalRequests").then(m => ({ default: m.ApprovalRequests })))
const Analytics = lazy(() => import("@/features/recruiter/pages/Analytics").then(m => ({ default: m.Analytics })))
const Notifications = lazy(() => import("@/features/recruiter/pages/Notifications").then(m => ({ default: m.Notifications })))
const Settings = lazy(() => import("@/features/recruiter/pages/Settings").then(m => ({ default: m.Settings })))
const Help = lazy(() => import("@/features/recruiter/pages/Help").then(m => ({ default: m.Help })))
const Logout = lazy(() => import("@/features/recruiter/pages/Logout").then(m => ({ default: m.Logout })))
const Team = lazy(() => import("@/features/recruiter/pages/Team").then(m => ({ default: m.Team })))

export function RecruiterRoutes() {
  return (
    <Suspense fallback={<GenericDashboardSkeleton />}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="post-job" element={<PostJob />} />
        <Route path="manage-jobs" element={<ManageJobs />} />
        <Route path="jobs/:id" element={<JobDetails />} />
        <Route path="applicants" element={<Applicants />} />
        <Route path="applicants/:id" element={<CandidatePreview />} />
        <Route path="company" element={<CompanyProfile />} />
        <Route path="perks" element={<Perks />} />
        <Route path="approvals" element={<ApprovalRequests />} />
        <Route path="team" element={<Team />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="help" element={<Help />} />
        <Route path="logout" element={<Logout />} />
        {/* Absolute path -- verified via react-router's matchRoutes/resolvePath
            that the relative form ("dashboard") already resolves correctly
            for direct fallthrough cases (e.g. "/recruiter/jobs"), but an
            absolute target removes any ambiguity if this route tree is ever
            nested differently, and matches the other two role routers. */}
        <Route path="*" element={<Navigate to="/recruiter/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
export default RecruiterRoutes
