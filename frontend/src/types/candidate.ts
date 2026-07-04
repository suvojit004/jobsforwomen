export interface CandidateCareerBreak {
  reason: string
  duration: string
  summary: string
}

export interface CandidateResume {
  name: string
  uploadDate: string
  verified: boolean
}

export interface Candidate {
  fullName: string
  role: string
  email: string
  phone: string
  location: string
  experience: string
  currentCtc: string
  expectedCtc: string
  noticePeriod: string
  availability: string
  profileCompletion: number
  skills: string[]
  careerBreak: CandidateCareerBreak
  resume: CandidateResume
}
