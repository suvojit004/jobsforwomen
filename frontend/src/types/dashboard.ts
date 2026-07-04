import type { Candidate } from "./candidate"
import type { Job } from "./job"
import type { Application, ApplicationStatus } from "./application"

export type Activity = {
  id: string
  title: string
  description: string
  time: string
  type: "submitted" | "profile" | "resume" | "interview" | "rejected"
}

export type {
  Candidate,
  Job,
  ApplicationStatus,
  Application,
}
