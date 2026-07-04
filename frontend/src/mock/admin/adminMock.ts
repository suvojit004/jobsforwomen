export interface CandidateUser {
  id: string
  name: string
  email: string
  role: string
  status: "Active" | "Blocked"
  verified: boolean
  careerBreak: boolean
}

export interface RecruiterUser {
  id: string
  name: string
  email: string
  company: string
  status: "Active" | "Blocked"
  verified: boolean
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  status: "Active" | "Blocked"
  permissions: string[]
}

export const initialAdminData = {
  name: "Platform Administrator",
  email: "admin@jobsforwomen.info",
  metrics: {
    totalCandidates: 1420,
    totalRecruiters: 85,
    pendingVerifications: 12,
    reportedJobs: 2,
    activeListings: 245,
  }
}

export const mockCandidates: CandidateUser[] = [
  {
    id: "cand-1",
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    role: "Frontend Developer",
    status: "Active",
    verified: true,
    careerBreak: true,
  },
  {
    id: "cand-2",
    name: "Meera Nair",
    email: "meera.nair@example.com",
    role: "Product Manager",
    status: "Active",
    verified: false,
    careerBreak: true,
  },
  {
    id: "cand-3",
    name: "Sneha Patel",
    email: "sneha.patel@tech.com",
    role: "Data Scientist",
    status: "Active",
    verified: true,
    careerBreak: false,
  },
  {
    id: "cand-4",
    name: "Aditi Rao",
    email: "aditi.rao@design.co",
    role: "UX Designer",
    status: "Blocked",
    verified: false,
    careerBreak: false,
  },
  {
    id: "cand-5",
    name: "Kavitha Krishnan",
    email: "kavitha.k@qa.org",
    role: "QA Automation Lead",
    status: "Active",
    verified: false,
    careerBreak: true,
  },
]

export const mockRecruiters: RecruiterUser[] = [
  {
    id: "rec-1",
    name: "Anjali Rao",
    email: "anjali.rao@technova.com",
    company: "TechNova Solutions",
    status: "Active",
    verified: true,
  },
  {
    id: "rec-2",
    name: "Ritu Goel",
    email: "ritu.goel@creativeminds.io",
    company: "Creative Minds Agency",
    status: "Active",
    verified: false,
  },
  {
    id: "rec-3",
    name: "Shreya Iyer",
    email: "shreya.iyer@appstudio.dev",
    company: "AppStudio Technologies",
    status: "Active",
    verified: true,
  },
  {
    id: "rec-4",
    name: "Deepa Sen",
    email: "deepa.sen@innotech.com",
    company: "InnoTech Private Ltd",
    status: "Blocked",
    verified: false,
  },
]

export const mockAdmins: AdminUser[] = [
  {
    id: "admin-1",
    name: "SysAdmin Control",
    email: "admin@jobsforwomen.info",
    role: "Principal Platform Admin",
    status: "Active",
    permissions: ["Full Access", "User Management", "Moderation", "Settings Toggles"],
  },
  {
    id: "admin-2",
    name: "Audit Mod",
    email: "audit.analyst@jobsforwomen.info",
    role: "Audit Operations Analyst",
    status: "Active",
    permissions: ["Audit Logs Only", "View Metrics"],
  },
  {
    id: "admin-3",
    name: "Content Moderator",
    email: "content.mod@jobsforwomen.info",
    role: "Job & Post Moderator",
    status: "Active",
    permissions: ["Job Moderation Only", "Verify Companies"],
  },
]

export default initialAdminData
