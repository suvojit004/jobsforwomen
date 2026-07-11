import { useState, useRef, useEffect } from "react"
import { Send, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Conversation } from "@/types/message"
import { cn } from "@/lib/utils"

type ChatWindowProps = {
  conversation: Conversation
  onSendMessage: (text: string) => void
  isTyping: boolean
  onBackToList?: () => void
}

export function ChatWindow({
  conversation,
  onSendMessage,
  isTyping,
  onBackToList,
}: ChatWindowProps) {
  const [inputText, setInputText] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversation.thread, isTyping])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return

    onSendMessage(inputText.trim())
    setInputText("")
  }

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden dark:bg-slate-900 dark:border-slate-800">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 dark:border-slate-800">
        <div className="flex items-center gap-3">
          {onBackToList && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onBackToList}
              className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-white md:hidden"
              aria-label="Back to contacts list"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}

          <div className="relative">
            <div className="size-9 rounded-full bg-[#6B2C91]/10 text-[#6B2C91] dark:bg-pink-500/10 dark:text-pink-200 flex items-center justify-center font-extrabold text-xs">
              {conversation.avatarLetters}
            </div>
            {conversation.online && (
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
            )}
          </div>

          <div>
            <h3 className="text-xs font-extrabold text-slate-950 dark:text-white">
              {conversation.recruiterName}
            </h3>
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              Recruiter · {conversation.companyName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
          <span className={cn(
            "size-1.5 rounded-full",
            conversation.online ? "bg-emerald-500" : "bg-slate-300"
          )} />
          {conversation.online ? "Online" : "Offline"}
        </div>
      </div>

      {/* Messages history scroll list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/20 scrollbar-thin"
      >
        {conversation.thread.map((msg) => {
          const isMe = msg.sender === "candidate"
          return (
            <div
              key={msg.id}
              className={cn("flex", isMe ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[72%] rounded-2xl px-4 py-2 text-xs leading-5 shadow-sm relative",
                  isMe
                    ? "bg-[#6B2C91] text-white rounded-tr-none dark:bg-pink-600 dark:text-white"
                    : "bg-white text-slate-800 rounded-tl-none border border-slate-100 dark:bg-slate-800 dark:border-slate-700/60 dark:text-slate-200"
                )}
              >
                <p className="break-words">{msg.text}</p>
                <span className={cn(
                  "block text-[9px] mt-1 font-semibold text-right",
                  isMe ? "text-pink-100/70" : "text-slate-400 dark:text-slate-500"
                )}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          )
        })}

        {/* Dynamic Typing Indicator simulation */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white text-slate-800 rounded-2xl rounded-tl-none border border-slate-100 px-4 py-3 shadow-sm dark:bg-slate-800 dark:border-slate-700/60 dark:text-slate-200">
              <div className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-slate-400 animate-bounce delay-0" />
                <span className="size-1.5 rounded-full bg-slate-400 animate-bounce delay-150" />
                <span className="size-1.5 rounded-full bg-slate-400 animate-bounce delay-300" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Message Input Footer */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2 shrink-0"
      >
        <input
          type="text"
          placeholder="Type your reply..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!inputText.trim()}
          className="bg-[#6B2C91] text-white hover:bg-[#5a237b] size-8 shrink-0 rounded-lg dark:bg-pink-600 dark:hover:bg-pink-700"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}
