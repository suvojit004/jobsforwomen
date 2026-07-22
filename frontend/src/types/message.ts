export interface Message {
  id: string
  sender: "recruiter" | "candidate"
  text: string
  timestamp: string
  // True for a message that's been shown locally but hasn't been confirmed
  // by the server yet (optimistic send) -- rendered dimmed with a pending
  // icon until the real response arrives, instead of leaving the composer
  // looking like it did nothing for the second or two a real round trip
  // takes.
  pending?: boolean
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
