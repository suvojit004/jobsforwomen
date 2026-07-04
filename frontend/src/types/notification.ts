export interface Notification {
  id: string
  title: string
  description: string
  time: string
  type: "application" | "interview" | "system" | "partner" | "submitted" | "profile" | "resume" | "rejected"
  read: boolean
}
