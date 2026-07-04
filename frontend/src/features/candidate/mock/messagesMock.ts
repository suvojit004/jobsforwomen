import { initialConversations as centralConvs } from "@/mock/messages/messagesMock"

export interface Message {
  id: string
  sender: "candidate" | "recruiter"
  text: string
  timestamp: string
}

export interface Conversation {
  id: string
  recruiterName: string
  companyName: string
  avatarLetters: string
  online: boolean
  lastMessageText: string
  lastMessageTime: string
  unreadCount: number
  thread: Message[]
}

export const initialConversations: Conversation[] = centralConvs as any
export default initialConversations
