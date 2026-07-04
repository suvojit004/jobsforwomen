import type { Activity, Candidate } from "@/types/dashboard"

export const candidate: Candidate = {
  fullName: "Priya Sharma",
  role: "Frontend Developer",
  email: "priya.sharma@email.com",
  phone: "+91 98765 43210",
  location: "Bengaluru, Karnataka",
  experience: "2.5 Years",
  currentCtc: "₹ 8.5 LPA",
  expectedCtc: "₹ 12 LPA",
  noticePeriod: "15 Days",
  availability: "Immediate",
  profileCompletion: 85,
  skills: ["React", "JavaScript", "Tailwind", "HTML", "CSS", "C/C++", "+3"],
  careerBreak: {
    reason: "Family care",
    duration: "Jun 2022 - Mar 2023",
    summary:
      "I took a career break to focus on my family commitments and personal growth. I used this time to enhance my skills through online courses and personal projects.",
  },
  resume: {
    name: "Priya_Sharma_Resume.pdf",
    uploadDate: "10 May 2025",
    verified: true,
  },
}

export const activityFeed: Activity[] = [
  {
    id: "activity-1",
    title: "Application Submitted",
    description: "TechNova Solutions viewed your profile",
    time: "10 mins ago",
    type: "submitted",
  },
  {
    id: "activity-2",
    title: "Profile Updated",
    description: "Your profile strength improved to 85%",
    time: "1 hour ago",
    type: "profile",
  },
  {
    id: "activity-3",
    title: "Resume Downloaded",
    description: "Creative Minds downloaded your resume",
    time: "Tomorrow, 11:00 AM",
    type: "resume",
  },
  {
    id: "activity-4",
    title: "Interview Scheduled",
    description: "Interview scheduled with Creative Minds",
    time: "2 hours ago",
    type: "interview",
  },
  {
    id: "activity-5",
    title: "Application Rejected",
    description: "BrandCraft closed the Digital Marketing Executive role",
    time: "3 hours ago",
    type: "rejected",
  },
]
