import type { NormalizedResume } from "../utils/resumeMapper"

export interface WorkExperience {
  id: string
  jobTitle: string
  company: string
  duration: string
  description: string
}

export interface Education {
  id: string
  degree: string
  institution: string
  duration: string
  grade?: string
  // e.g. degree "B.Tech / B.E." + specialization "Computer Science
  // Engineering (CSE)" -- optional since it doesn't apply to every
  // qualification (10th/12th, most certifications, etc.).
  specialization?: string
}

export interface SocialLink {
  id: string
  platform: "LinkedIn" | "GitHub" | "Portfolio" | "Twitter"
  url: string
}

export interface JobPreferences {
  expectedSalary: string
  preferredLocation: string[]
  availability: string
  noticePeriod: string
}

export interface ExtendedCandidate {
  fullName: string
  role: string
  email: string
  phone: string
  location: string
  experience: string
  currentCtc: string
  bio: string
  avatarUrl: string
  profileCompletion: number
  skills: string[]
  languages: string[]
  socialLinks: SocialLink[]
  careerBreak: {
    hasBreak: boolean
    reason: string
    duration: string
    summary: string
  }
  resume: NormalizedResume
  education: Education[]
  workExperience: WorkExperience[]
  preferences: JobPreferences
}
