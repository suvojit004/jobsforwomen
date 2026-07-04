import { Search } from "lucide-react"
import { useState } from "react"
import type { Conversation } from "../../mock/messagesMock"
import { cn } from "@/lib/utils"

type ConversationListProps = {
  conversations: Conversation[]
  activeId: string
  onSelect: (id: string) => void
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
}: ConversationListProps) {
  const [search, setSearch] = useState("")

  const filtered = conversations.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.recruiterName.toLowerCase().includes(q) ||
      c.companyName.toLowerCase().includes(q)
    );
  })

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden dark:bg-slate-900 dark:border-slate-800">
      {/* Search contacts */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          />
        </div>
      </div>

      {/* Recruiter contact cards */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850">
        {filtered.length > 0 ? (
          filtered.map((c) => {
            const isActive = c.id === activeId
            return (
              <div
                key={c.id}
                onClick={() => onSelect(c.id)}
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
                      {c.recruiterName}
                    </h4>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold shrink-0">
                      {c.lastMessageTime}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-[#6B2C91] dark:text-pink-300 truncate">
                    {c.companyName}
                  </p>
                  <p className={cn(
                    "text-[11px] truncate leading-normal",
                    c.unreadCount > 0
                      ? "font-bold text-slate-900 dark:text-slate-100"
                      : "text-slate-500 dark:text-slate-400"
                  )}>
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
            No contacts match search query.
          </div>
        )}
      </div>
    </div>
  )
}
