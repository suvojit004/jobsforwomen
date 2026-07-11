export type JobLogoTone = "purple" | "green" | "blue" | "pink"

export interface Job {
  id: string
  title: string
  company: string
  companyCode: string
  logoTone: JobLogoTone
  salary: string
  location: string
  experience: string
  type: string
  workMode: "Remote" | "Hybrid" | "On-site"
  postedAt: string
}

export interface ExtendedJob extends Job {
  womenReturnship: boolean
  menstrualLeaveChampion: boolean
  description: string
  requirements: string[]
  responsibilities: string[]
  benefits: string[]
  companyDescription?: string
}
