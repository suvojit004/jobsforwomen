import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import {
  Search,
  Send,
  ArrowLeft,
  FileText,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ChatMessage {
  id: string
  sender: "recruiter" | "candidate"
  text: string
  timestamp: string
}

interface RecruiterConversation {
  id: string
  candidateName: string
  candidateRole: string
  avatarLetters: string
  lastMessageText: string
  lastMessageTime: string
  unreadCount: number
  online: boolean
  thread: ChatMessage[]
}

export function Messages() {
  const [conversations, setConversations] = useState<RecruiterConversation[]>([
    {
      id: "conv-priya",
      candidateName: "Priya Sharma",
      candidateRole: "Frontend Developer",
      avatarLetters: "PS",
      lastMessageText: "Thank you for the opportunity! I have prepared the coding task.",
      lastMessageTime: "12:30 PM",
      unreadCount: 2,
      online: true,
      thread: [
        {
          id: "m1",
          sender: "recruiter",
          text: "Hi Priya, we reviewed your profile and love your experience. How are you preparing for your return to frontend development after the break?",
          timestamp: "10:15 AM",
        },
        {
          id: "m2",
          sender: "candidate",
          text: "Hi Anjali! I kept up to date by taking courses and building a React + TS personal dashboard project. I feel fully prepared to jump back in.",
          timestamp: "10:20 AM",
        },
        {
          id: "m3",
          sender: "recruiter",
          text: "That is fantastic! We would love to schedule a technical round. I will send you a calendar invite shortly.",
          timestamp: "11:45 AM",
        },
        {
          id: "m4",
          sender: "candidate",
          text: "Thank you for the opportunity! I have prepared the coding task and look forward to the meeting.",
          timestamp: "12:30 PM",
        },
      ],
    },
    {
      id: "conv-anjali",
      candidateName: "Anjali Verma",
      candidateRole: "UI/UX Designer",
      avatarLetters: "AV",
      lastMessageText: "Sure, let me share the Figma link by tomorrow.",
      lastMessageTime: "Yesterday",
      unreadCount: 0,
      online: false,
      thread: [
        {
          id: "m5",
          sender: "recruiter",
          text: "Hello Anjali, could you send over a link to your case studies on design tokens?",
          timestamp: "Yesterday, 3:00 PM",
        },
        {
          id: "m6",
          sender: "candidate",
          text: "Sure, let me share the Figma link by tomorrow.",
          timestamp: "Yesterday, 4:10 PM",
        },
      ],
    },
    {
      id: "conv-neha",
      candidateName: "Neha Singh",
      candidateRole: "Frontend Developer",
      avatarLetters: "NS",
      lastMessageText: "I am available on Tuesday afternoon.",
      lastMessageTime: "Yesterday",
      unreadCount: 0,
      online: false,
      thread: [
        {
          id: "m7",
          sender: "recruiter",
          text: "Hi Neha, does next Tuesday work for a quick conversation?",
          timestamp: "Yesterday, 11:00 AM",
        },
        {
          id: "m8",
          sender: "candidate",
          text: "I am available on Tuesday afternoon.",
          timestamp: "Yesterday, 11:32 AM",
        },
      ],
    },
  ])

  const [activeId, setActiveId] = useState<string>("conv-priya")
  const [inputText, setInputText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [mobileShowChat, setMobileShowChat] = useState(false)

  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0]
  const threadEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom of message logs
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeConversation?.thread, isTyping])

  // Clear unread count when opening active conversation
  useEffect(() => {
    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c))
    )
  }, [activeId])

  const handleSelectConv = (id: string) => {
    setActiveId(id)
    setMobileShowChat(true)
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return

    const timeStr = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })

    const newMsg: ChatMessage = {
      id: `msg-r-${Date.now()}`,
      sender: "recruiter",
      text: inputText,
      timestamp: timeStr,
    }

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeId) {
          return {
            ...c,
            lastMessageText: inputText,
            lastMessageTime: timeStr,
            thread: [...c.thread, newMsg],
          }
        }
        return c
      })
    )

    const typedText = inputText
    setInputText("")

    // Simulated candidate reply
    if (activeConversation.online) {
      setTimeout(() => {
        setIsTyping(true)

        setTimeout(() => {
          setIsTyping(false)
          const replyTime = new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })

          let replyText = `Thanks for the details! I will review the scheduling details and respond soon.`
          const lower = typedText.toLowerCase()
          if (lower.includes("meet") || lower.includes("interview") || lower.includes("time")) {
            replyText = `That slot works perfectly for me. Looking forward to the conversation!`
          } else if (lower.includes("resume") || lower.includes("break") || lower.includes("experience")) {
            replyText = `Yes, my career break duration really gave me space to sharpen my skills. I appreciate the focus on returnship entries.`
          }

          const replyMsg: ChatMessage = {
            id: `msg-c-${Date.now()}`,
            sender: "candidate",
            text: replyText,
            timestamp: replyTime,
          }

          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === activeId) {
                return {
                  ...c,
                  lastMessageText: replyText,
                  lastMessageTime: replyTime,
                  thread: [...c.thread, replyMsg],
                }
              }
              return c
            })
          )
        }, 2200)
      }, 1200)
    }
  }

  // Filter conversations
  const filteredConversations = conversations.filter(
    (c) =>
      c.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.candidateRole.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="h-[calc(100vh-140px)] flex flex-col space-y-4"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Inbox Messaging
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Communicate directly with applicants, coordinate schedules, and conduct screeners.
        </p>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 min-h-0 grid md:grid-cols-12 gap-5 relative select-none">
        {/* Left Side: Contact List */}
        <div
          className={cn(
            "h-full md:col-span-4 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden dark:bg-slate-900 dark:border-slate-800",
            mobileShowChat ? "hidden md:flex" : "flex"
          )}
        >
          {/* Search bar */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          {/* Conversations list container */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850">
            {filteredConversations.length > 0 ? (
              filteredConversations.map((c) => {
                const isActive = c.id === activeId
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConv(c.id)}
                    className={cn(
                      "p-4 cursor-pointer transition-colors flex gap-3 relative hover:bg-slate-50 dark:hover:bg-slate-800/40",
                      isActive && "bg-violet-50/50 hover:bg-violet-50/50 dark:bg-violet-500/10 dark:hover:bg-violet-500/10"
                    )}
                  >
                    {/* Avatar with status */}
                    <div className="relative shrink-0">
                      <div className="size-10 rounded-full bg-[#6B2C91]/10 text-[#6B2C91] dark:bg-pink-500/10 dark:text-pink-200 flex items-center justify-center font-extrabold text-xs">
                        {c.avatarLetters}
                      </div>
                      {c.online && (
                        <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                      )}
                    </div>

                    {/* Snippet info */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-slate-950 truncate dark:text-white">
                          {c.candidateName}
                        </h4>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold shrink-0">
                          {c.lastMessageTime}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-[#6B2C91] dark:text-pink-300 truncate">
                        {c.candidateRole}
                      </p>
                      <p
                        className={cn(
                          "text-[11px] truncate leading-normal",
                          c.unreadCount > 0
                            ? "font-bold text-slate-900 dark:text-slate-100"
                            : "text-slate-500 dark:text-slate-400"
                        )}
                      >
                        {c.lastMessageText}
                      </p>
                    </div>

                    {/* Unread badge */}
                    {c.unreadCount > 0 && !isActive && (
                      <span className="absolute right-4 bottom-4 flex size-4 items-center justify-center rounded-full bg-pink-500 text-[9px] font-extrabold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
                No candidates matched search filters.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Chat Window */}
        <div
          className={cn(
            "h-full md:col-span-8 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden dark:bg-slate-900 dark:border-slate-800",
            !mobileShowChat ? "hidden md:flex" : "flex"
          )}
        >
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileShowChat(false)}
                    className="h-8 w-8 text-slate-400 md:hidden hover:text-slate-700"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <div className="relative">
                    <div className="size-9 rounded-full bg-[#6B2C91]/10 text-[#6B2C91] dark:bg-pink-500/10 dark:text-pink-200 flex items-center justify-center font-extrabold text-xs">
                      {activeConversation.avatarLetters}
                    </div>
                    {activeConversation.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-950 dark:text-white">
                      {activeConversation.candidateName}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold dark:text-slate-550 flex items-center gap-1 leading-none mt-0.5">
                      {activeConversation.candidateRole}
                      <span>•</span>
                      {activeConversation.online ? (
                        <span className="text-emerald-500 font-bold uppercase">Online</span>
                      ) : (
                        <span>Offline</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-8 text-[10px] font-bold gap-1 cursor-pointer"
                    onClick={() =>
                      window.open(`/recruiter/applicants/${activeConversation.id === "conv-priya" ? "application-1" : activeConversation.id}`, "_blank")
                    }
                  >
                    <FileText className="size-3.5" />
                    Inspect Resume
                  </Button>
                </div>
              </div>

              {/* Message Thread area */}
              <div className="flex-1 p-4 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/20 space-y-4">
                {activeConversation.thread.map((msg) => {
                  const isMe = msg.sender === "recruiter"
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex w-full max-w-[80%] flex-col gap-1",
                        isMe ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2 text-xs leading-relaxed",
                          isMe
                            ? "bg-[#6B2C91] text-white rounded-tr-none dark:bg-pink-600"
                            : "bg-white border border-slate-200 text-slate-800 rounded-tl-none dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                        )}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 px-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  )
                })}

                {/* Simulated typing dot indicator */}
                {isTyping && (
                  <div className="flex items-center gap-2 mr-auto bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-2.5 dark:bg-slate-900 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold dark:text-slate-500 flex items-center gap-1.5 animate-pulse">
                      <Sparkles className="size-3 text-[#6B2C91] dark:text-pink-300 animate-spin" />
                      {activeConversation.candidateName} is writing...
                    </span>
                  </div>
                )}

                <div ref={threadEndRef} />
              </div>

              {/* Chat Input panel */}
              <form
                onSubmit={handleSend}
                className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 items-center bg-white dark:bg-slate-900 shrink-0"
              >
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="bg-[#6B2C91] text-white hover:bg-[#5a237b] h-9 w-9 shrink-0 cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700"
                >
                  <Send className="size-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Select a conversation to start messaging.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
export default Messages
