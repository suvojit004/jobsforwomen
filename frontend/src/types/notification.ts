export interface Notification {
  id: string
  title: string
  description: string
  time: string
  type: "application" | "interview" | "system" | "partner" | "submitted" | "profile" | "resume" | "rejected"
  read: boolean
}

export interface NotificationItemType {
  id: string
  title: string
  description: string
  category: string
  read: boolean
  time: string
  dateGroup: "Today" | "Yesterday" | "Earlier"
  // Backend-generated internal path (see notification.listener.ts) --
  // never a full/external URL. Optional because not every notification
  // (e.g. a generic system message) has somewhere useful to navigate to.
  actionUrl?: string
}
