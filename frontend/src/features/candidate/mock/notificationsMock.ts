import { initialNotifications as centralNotifs } from "@/mock/notifications/notificationsMock"

export interface NotificationItemType {
  id: string
  title: string
  description: string
  category: "General" | "Jobs" | "Interviews"
  read: boolean
  time: string
  dateGroup: "Today" | "Yesterday" | "Earlier"
}

export const initialNotifications: NotificationItemType[] = centralNotifs as any
export default initialNotifications
