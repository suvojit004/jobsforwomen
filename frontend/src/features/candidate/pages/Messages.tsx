import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ConversationList } from "../components/Messages/ConversationList"
import { ChatWindow } from "../components/Messages/ChatWindow"
import { initialConversations, type Conversation, type Message } from "../mock/messagesMock"
import { cn } from "@/lib/utils"

export function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [activeId, setActiveId] = useState<string>("conv-1")
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(false)

  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0]

  // Clear unread count when opening a conversation
  useEffect(() => {
    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c))
    )
  }, [activeId])

  const handleSelectConversation = (id: string) => {
    setActiveId(id)
    setMobileShowChat(true)
    
    // Simulate slight typing delay for recruiter online activity look
    const selected = conversations.find((c) => c.id === id)
    if (selected?.online) {
      setIsTyping(true)
      const timer = setTimeout(() => {
        setIsTyping(false)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }

  const handleSendMessage = (text: string) => {
    const timeStr = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })

    const newMsg: Message = {
      id: `msg-custom-${Date.now()}`,
      sender: "candidate",
      text,
      timestamp: timeStr,
    }

    // Append message to active conversation
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeId) {
          return {
            ...c,
            lastMessageText: text,
            lastMessageTime: timeStr,
            thread: [...c.thread, newMsg],
          }
        }
        return c
      })
    )

    // Trigger automated reply simulation
    const active = conversations.find((c) => c.id === activeId)
    if (active) {
      // 1.5s delay to start typing
      setTimeout(() => {
        setIsTyping(true)

        // 2s typing time (total 3.5s response delay)
        setTimeout(() => {
          setIsTyping(false)
          
          const replyTime = new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })

          // Custom smart mock responses
          let replyText = `Thanks for the update, Priya. I'll review this with the team and get back to you.`
          const lowerText = text.toLowerCase()
          if (lowerText.includes("thank") || lowerText.includes("thanks")) {
            replyText = `You're very welcome! I'll update our portal and coordinate next steps.`
          } else if (lowerText.includes("interview") || lowerText.includes("time") || lowerText.includes("confirm")) {
            replyText = `Excellent! I'll send over the Google Meet invite shortly. Looking forward to speaking with you.`
          } else if (lowerText.includes("resume") || lowerText.includes("portfolio")) {
            replyText = `Perfect, got it! Let me forward these details to the hiring manager.`
          }

          const replyMsg: Message = {
            id: `msg-sim-${Date.now()}`,
            sender: "recruiter",
            text: replyText,
            timestamp: replyTime,
          }

          setConversations((prevVal) =>
            prevVal.map((c) => {
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
        }, 2000)
      }, 1500)
    }
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
