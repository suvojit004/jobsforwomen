export const UserRole = {
  CANDIDATE: "candidate",
  RECRUITER: "recruiter",
  ADMIN: "admin",
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]
