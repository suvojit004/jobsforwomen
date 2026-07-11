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

import { RecruiterApi } from "../services/recruiterApi"
import { getSocket } from "@/api/socket"

export function Messages() {
  const [conversations, setConversations] = useState<RecruiterConversation[]>([])
  const [activeId, setActiveId] = useState<string>("")
  const [inputText, setInputText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0]
  const threadEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadConversations() {
      try {
        setIsLoading(true)
        const list = await RecruiterApi.getConversations()
        const formatted = list.map((c: any) => {
          const otherParticipant = c.participants.find(
            (p: any) => p.user?.candidateProfile?.fullName
          )
          const name = otherParticipant?.user?.candidateProfile?.fullName || "Candidate Applicant"
          return {
            id: c.id,
            candidateName: name,
            candidateRole: otherParticipant?.user?.candidateProfile?.title || "Professional",
            avatarLetters: name.split(" ").map((n: any) => n[0]).join("").slice(0, 2).toUpperCase() || "CN",
            lastMessageText: c.messages?.[0]?.content || "No messages yet",
            lastMessageTime: c.messages?.[0]?.timestamp
              ? new Date(c.messages[0].timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Today",
            unreadCount: 0,
            online: true,
            thread: [],
          }
        })
        setConversations(formatted)
        if (formatted.length > 0) {
          setActiveId(formatted[0].id)
        }
      } catch (err) {
        console.error("Failed to load recruiter conversations", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadConversations()
  }, [])

  useEffect(() => {
    if (!activeId) return
    async function loadMessages() {
      try {
        const msgs = await RecruiterApi.getMessages(activeId)
        const formattedMsgs: ChatMessage[] = msgs.map((m: any) => ({
          id: m.id,
          sender: m.senderId === localStorage.getItem("user_id") ? "recruiter" : "candidate",
          text: m.content,
          timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }))
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, thread: formattedMsgs } : c))
        )
      } catch (err) {
        console.error("Failed to load messages", err)
      }
    }
    loadMessages()
  }, [activeId])

  useEffect(() => {
    if (!activeId) return
    const socket = getSocket("recruiter")

    socket.emit("join:conversation", { conversationId: activeId })

    socket.on("typing", (data: { userId: string; isTyping: boolean }) => {
      setIsTyping(data.isTyping)
    })

    socket.on("notification", (data: any) => {
      if (data.type === "message" || data.type === "MESSAGE") {
        async function reloadMessages() {
          const msgs = await RecruiterApi.getMessages(activeId)
          const formattedMsgs: ChatMessage[] = msgs.map((m: any) => ({
            id: m.id,
            sender: m.senderId === localStorage.getItem("user_id") ? "recruiter" : "candidate",
            text: m.content,
            timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }))
          setConversations((prev) =>
            prev.map((c) => (c.id === activeId ? { ...c, thread: formattedMsgs } : c))
          )
        }
        reloadMessages()
      }
    })

    return () => {
      socket.off("typing")
      socket.off("notification")
    }
  }, [activeId])

  // Scroll to bottom of message logs
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeConversation?.thread, isTyping])

  const handleSelectConv = (id: string) => {
    setActiveId(id)
    setMobileShowChat(true)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return

    try {
      await RecruiterApi.sendMessage(activeId, inputText)
      const socket = getSocket("recruiter")
      socket.emit("typing", { conversationId: activeId, isTyping: false })

      const msgs = await RecruiterApi.getMessages(activeId)
      const formattedMsgs: ChatMessage[] = msgs.map((m: any) => ({
        id: m.id,
        sender: m.senderId === localStorage.getItem("user_id") ? "recruiter" : "candidate",
        text: m.content,
        timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }))

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                lastMessageText: inputText,
                lastMessageTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                thread: formattedMsgs,
              }
            : c
        )
      )
      setInputText("")
    } catch (err) {
      console.error("Failed to send message", err)
    }
  }

  // Filter conversations
  const filteredConversations = conversations.filter(
    (c) =>
      c.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.candidateRole.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading inbox...</div>
  }

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
