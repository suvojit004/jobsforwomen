import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { ConversationList } from "../components/Messages/ConversationList"
import { ChatWindow } from "../components/Messages/ChatWindow"
import { InboxPageSkeleton } from "@/components/shared/skeletons/PageSkeletons"
import type { Conversation, Message } from "@/types/message"
import { cn } from "@/lib/utils"
import { candidateApi } from "../services/candidateApi"
import { getSocket } from "@/api/socket"
import { useAuth } from "@/hooks/useAuth"

export function Messages() {
  const { user } = useAuth()
  // Supports deep-linking here from "Message Recruiter" on the Applications
  // page (?conversation=<id>) after a brand-new conversation is created --
  // without this, a freshly-started conversation had no way to actually be
  // opened; the page would just fall back to selecting the first item.
  const [searchParams] = useSearchParams()
  const deepLinkedConversationId = searchParams.get("conversation")
  // The real signed-in user id, used to tell "my" messages apart from the
  // other party's. Previously this compared against
  // localStorage.getItem("user_id"), a key nothing in the app ever sets --
  // so it was always null, and every message (including the candidate's own)
  // was misattributed to the recruiter.
  const currentUserId = user?.id
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string>("")
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(true)

  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0]
  // dedup guard so a duplicate/replayed
  // socket "notification" event for the same message can never increment an
  // inactive conversation's unread badge twice. A plain ref-backed Set is
  // enough here -- no new state-management dependency needed.
  const seenIncomingMessageIds = useRef<Set<string>>(new Set())

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
            // Real server-side unread count (messages from the other
            // participant with readAt still null).
            unreadCount: c.unreadCount ?? 0,
            online: true,
            thread: [],
          }
        })
        setConversations(formatted)
        if (deepLinkedConversationId && formatted.some((c: any) => c.id === deepLinkedConversationId)) {
          setActiveId(deepLinkedConversationId)
        } else if (formatted.length > 0) {
          setActiveId(formatted[0].id)
        }
      } catch (err: any) {
        console.error("Failed to load conversations", err)
        toast.error(err?.message || "Failed to load conversations.")
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
          sender: m.senderId === currentUserId ? "candidate" : "recruiter",
          text: m.content,
          timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }))
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, thread: formattedMsgs } : c))
        )

        // mark received-unread messages
        // as read once their conversation is actually opened. The server
        // verifies participant membership and only touches messages sent by
        // the OTHER participant, so this can never mark the candidate's own
        // outgoing messages as read. Reconciling the local badge to 0
        // immediately (rather than waiting for a full conversations refetch)
        // is what keeps it in sync with Part 11's real unread counts.
        try {
          await candidateApi.markConversationAsRead(activeId)
          setConversations((prev) =>
            prev.map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c))
          )
        } catch (err: any) {
          console.error("Failed to mark conversation as read", err)
        }
      } catch (err: any) {
        console.error("Failed to load messages", err)
        toast.error(err?.message || "Failed to load messages.")
      }
    }
    loadMessages()
  }, [activeId])

  useEffect(() => {
    if (!activeId) return
    const socket = getSocket("candidate")

    socket.emit("join:conversation", { conversationId: activeId })

    const handleTyping = (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      // The socket may still be subscribed to a previously-open conversation's
      // room; only reflect typing state for the conversation currently on screen.
      if (data.conversationId !== activeId) return
      setIsTyping(data.isTyping)
    }

    const handleNotification = (data: any) => {
      if (data.type === "message" || data.type === "MESSAGE") {
        // a
        // message notification for a conversation OTHER than the one
        // currently open used to be silently dropped entirely -- the
        // sidebar's unread badge never moved for background conversations,
        // only updating (to a stale value) on the next full page reload.
        if (data.conversationId && data.conversationId !== activeId) {
          if (data.messageId) {
            if (seenIncomingMessageIds.current.has(data.messageId)) return
            seenIncomingMessageIds.current.add(data.messageId)
          }
          setConversations((prev) =>
            prev.map((c) =>
              c.id === data.conversationId ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c
            )
          )
          return
        }
        async function reloadMessages() {
          const msgs = await candidateApi.getMessages(activeId)
          const formattedMsgs: Message[] = msgs.map((m: any) => ({
            id: m.id,
            sender: m.senderId === currentUserId ? "candidate" : "recruiter",
            text: m.content,
            timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }))
          setConversations((prev) =>
            prev.map((c) => (c.id === activeId ? { ...c, thread: formattedMsgs } : c))
          )
        }
        reloadMessages()
      }
    }

    socket.on("typing", handleTyping)
    socket.on("notification", handleNotification)

    return () => {
      socket.off("typing", handleTyping)
      socket.off("notification", handleNotification)
      socket.emit("leave:conversation", { conversationId: activeId })
    }
  }, [activeId])

  const handleSelectConversation = (id: string) => {
    setActiveId(id)
    setMobileShowChat(true)
  }

  const handleSendMessage = async (text: string) => {
    const conversationId = activeId
    const tempId = `temp-${Date.now()}`
    const nowLabel = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    // Optimistic send: the message appears immediately (dimmed, pending
    // icon via ChatWindow) instead of the composer looking like it did
    // nothing for the second or two a real send + response takes.
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessageText: text,
              lastMessageTime: nowLabel,
              thread: [...c.thread, { id: tempId, sender: "candidate", text, timestamp: nowLabel, pending: true }],
            }
          : c
      )
    )

    try {
      const result = await candidateApi.sendMessage(conversationId, text)
      const socket = getSocket("candidate")
      socket.emit("typing", { conversationId, isTyping: false })

      // Swap the optimistic placeholder for the real, server-confirmed
      // message (real id/timestamp) rather than doing a full getMessages()
      // refetch -- the send response already contains it.
      const real = result?.message
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                thread: c.thread.map((m) =>
                  m.id === tempId
                    ? real
                      ? {
                          id: real.id,
                          sender: real.senderId === currentUserId ? "candidate" : "recruiter",
                          text: real.content,
                          timestamp: new Date(real.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        }
                      : { ...m, pending: false }
                    : m
                ),
              }
            : c
        )
      )
    } catch (err: any) {
      console.error("Failed to send message", err)
      toast.error(err?.message || "Failed to send message.")
      // Remove the optimistic bubble -- it never actually sent, so leaving
      // it in the thread (even marked pending) would be misleading.
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, thread: c.thread.filter((m) => m.id !== tempId) } : c
        )
      )
    }
  }

  if (isLoading) {
    return <InboxPageSkeleton />
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
          "h-full min-w-0 md:col-span-4",
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
          "h-full min-w-0 md:col-span-8",
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
