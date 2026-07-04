export interface Message {
  id: string
  sender: "recruiter" | "candidate"
  text: string
  timestamp: string
}

export interface Conversation {
  id: string
  recruiterName?: string
  candidateName?: string
  companyName?: string
  candidateRole?: string
  avatarLetters: string
  lastMessageText: string
  lastMessageTime: string
  unreadCount: number
  online: boolean
  thread: Message[]
}
