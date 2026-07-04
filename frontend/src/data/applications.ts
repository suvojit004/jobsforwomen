import type { Application } from "@/types/dashboard"

export const applications: Application[] = [
  {
    id: "application-1",
    company: "TechNova Solutions",
    companyCode: "TC",
    job: "Frontend Developer",
    appliedDate: "12 May 2025",
    status: "Applied",
    recruiter: "Ananya Mehta",
  },
  {
    id: "application-2",
    company: "Creative Minds",
    companyCode: "CM",
    job: "UI/UX Designer",
    appliedDate: "10 May 2025",
    status: "Interview Scheduled",
    interviewDate: "18 May 2025",
    recruiter: "Riya Kapoor",
  },
  {
    id: "application-3",
    company: "WriteAway",
    companyCode: "WA",
    job: "Content Writer",
    appliedDate: "08 May 2025",
    status: "Under Review",
    recruiter: "Neha Iyer",
  },
  {
    id: "application-4",
    company: "BrandCraft",
    companyCode: "BC",
    job: "Digital Marketing Executive",
    appliedDate: "05 May 2025",
    status: "Rejected",
  },
]
