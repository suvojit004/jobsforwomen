import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ConversationList } from "../components/Messages/ConversationList"
import { ChatWindow } from "../components/Messages/ChatWindow"
import type { Conversation, Message } from "@/types/message"
import { cn } from "@/lib/utils"
import { candidateApi } from "../services/candidateApi"
import { getSocket } from "@/api/socket"

export function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string>("")
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(true)

  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0]

  useEffect(() => {
    async function loadConversations() {
      try {
        setIsLoading(true)
        const list = await candidateApi.getConversations()
        const formatted = list.map((c: any) => {
          const otherParticipant = c.participants.find(
            (p: any) => p.user?.recruiterProfile?.fullName
          )
          const name = otherParticipant?.user?.recruiterProfile?.fullName || "Hiring Recruiter"
          return {
            id: c.id,
            recruiterName: name,
            companyName: "Recruiter Coordinator",
            avatarLetters: name.split(" ").map((n: any) => n[0]).join("").slice(0, 2).toUpperCase() || "RC",
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
        console.error("Failed to load conversations", err)
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
        const msgs = await candidateApi.getMessages(activeId)
        const formattedMsgs: Message[] = msgs.map((m: any) => ({
          id: m.id,
          sender: m.senderId === localStorage.getItem("user_id") ? "candidate" : "recruiter",
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
    const socket = getSocket("candidate")

    socket.emit("join:conversation", { conversationId: activeId })

    socket.on("typing", (data: { userId: string; isTyping: boolean }) => {
      setIsTyping(data.isTyping)
    })

    socket.on("notification", (data: any) => {
      if (data.type === "message" || data.type === "MESSAGE") {
        async function reloadMessages() {
          const msgs = await candidateApi.getMessages(activeId)
          const formattedMsgs: Message[] = msgs.map((m: any) => ({
            id: m.id,
            sender: m.senderId === localStorage.getItem("user_id") ? "candidate" : "recruiter",
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

  const handleSelectConversation = (id: string) => {
    setActiveId(id)
    setMobileShowChat(true)
  }

  const handleSendMessage = async (text: string) => {
    try {
      await candidateApi.sendMessage(activeId, text)
      const socket = getSocket("candidate")
      socket.emit("typing", { conversationId: activeId, isTyping: false })

      const msgs = await candidateApi.getMessages(activeId)
      const formattedMsgs: Message[] = msgs.map((m: any) => ({
        id: m.id,
        sender: m.senderId === localStorage.getItem("user_id") ? "candidate" : "recruiter",
        text: m.content,
        timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }))
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                lastMessageText: text,
                lastMessageTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                thread: formattedMsgs,
              }
            : c
        )
      )
    } catch (err) {
      console.error("Failed to send message", err)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading conversations...</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="h-[calc(100vh-140px)] flex flex-col space-y-4"
    >
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Inbox
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Communicate directly with hiring recruiters and company coordinators.
        </p>
      </div>

      {/* Messaging Workspace Grid */}
      <div className="flex-1 min-h-0 grid md:grid-cols-12 gap-5 relative">
        {/* Contact List column */}
        <div className={cn(
          "h-full md:col-span-4",
          mobileShowChat ? "hidden md:block" : "block"
        )}>
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={handleSelectConversation}
          />
        </div>

        {/* Chat window column */}
        <div className={cn(
          "h-full md:col-span-8",
          !mobileShowChat ? "hidden md:block" : "block"
        )}>
          {activeConversation ? (
            <ChatWindow
              conversation={activeConversation}
              onSendMessage={handleSendMessage}
              isTyping={isTyping}
              onBackToList={() => setMobileShowChat(false)}
            />
          ) : (
            <div className="h-full bg-white border border-slate-200 rounded-xl flex items-center justify-center dark:bg-slate-900 dark:border-slate-800 text-slate-400 text-xs">
              Select a conversation to start messaging.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
