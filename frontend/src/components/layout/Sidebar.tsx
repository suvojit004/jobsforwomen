import {
  Bell,
  Bookmark,
  BriefcaseBusiness,
  CircleHelp,
  Home,
  LogOut,
  MessageSquare,
  Settings,
  UserRound,
} from "lucide-react"
import { motion } from "framer-motion"
import { NavLink } from "react-router-dom"
import { Logo } from "@/components/shared/Logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SidebarItem = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  badge?: string
}

const sidebarItems: SidebarItem[] = [
  { label: "Dashboard", icon: Home, href: "/dashboard" },
  { label: "Profile", icon: UserRound, href: "/profile" },
  { label: "Browse Jobs", icon: BriefcaseBusiness, href: "/jobs" },
  { label: "My Applications", icon: Bookmark, href: "/applications" },
  { label: "Saved Jobs", icon: Bookmark, href: "/saved-jobs" },
  // No hardcoded badge here: every real caller of <Sidebar> passes a real
  // `menuItems` prop with a live unread count (see CandidateLayout,
  // RecruiterLayout, AdminLayout), so this array is only ever a fallback
  // default. A hardcoded "3" here would be exactly the kind of fake-success
  // placeholder this codebase has been repeatedly audited to remove --
  // better to show no badge at all than a fabricated one.
  { label: "Notifications", icon: Bell, href: "/notifications" },
  { label: "Messages", icon: MessageSquare, href: "/messages" },
  { label: "Settings", icon: Settings, href: "/settings" },
  { label: "Help", icon: CircleHelp, href: "/help" },
  { label: "Logout", icon: LogOut, href: "/logout" },
]

type SidebarProps = {
  onNavigate?: () => void
  menuItems?: SidebarItem[]
  bannerTitle?: string
  bannerSubtitle?: string
  bannerButtonText?: string
  bannerButtonHref?: string
}

export function Sidebar({
  onNavigate,
  menuItems,
  bannerTitle = "Grow your career",
  bannerSubtitle = "with the right opportunities.",
  bannerButtonText = "Explore Jobs",
  bannerButtonHref = "/jobs",
}: SidebarProps) {
  const items = menuItems ?? sidebarItems

  return (
    <motion.div
      initial={{ x: -12, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex h-full flex-col border-r border-slate-200/80 bg-white px-3 py-5 dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="mb-8 flex items-center xl:pl-1">
        <div className="lg:hidden xl:block">
          <Logo />
        </div>
        <div className="hidden lg:block xl:hidden">
          <Logo compact />
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5" aria-label="Navigation">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.href}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group relative flex h-10 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-slate-600 transition-all hover:bg-violet-50 hover:text-[#6B2C91] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/40 dark:text-slate-300 dark:hover:bg-violet-500/10 dark:hover:text-pink-100 lg:justify-center xl:justify-start",
                isActive &&
                  "bg-violet-100 text-[#6B2C91] shadow-sm dark:bg-violet-500/25 dark:text-white"
              )
            }
          >
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="lg:hidden xl:inline">{item.label}</span>
            {item.badge && (
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white lg:absolute lg:right-1 lg:top-1 xl:static">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {bannerTitle && (
        <div className="mt-6 rounded-2xl bg-gradient-to-br from-violet-50 to-pink-50/50 p-4 ring-1 ring-violet-100 dark:from-slate-900 dark:to-slate-900/60 dark:ring-slate-800 lg:hidden xl:block">
          {bannerTitle === "Empowering Women" ? (
            <div className="space-y-2">
              <p className="text-xs font-black text-[#6B2C91] dark:text-pink-300">
                {bannerTitle}
              </p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-normal">
                {bannerSubtitle}
              </p>
              <svg viewBox="0 0 120 90" className="w-full h-auto mt-2">
                <defs>
                  <linearGradient id="laptopGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6B2C91" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#6B2C91" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <rect x="5" y="80" width="110" height="2" rx="1" className="fill-slate-250 dark:fill-slate-800" />
                <polygon points="50,75 70,75 75,80 45,80" className="fill-slate-350 dark:fill-slate-700" />
                <rect x="53" y="66" width="14" height="9" rx="1" className="fill-slate-650 dark:fill-slate-500" />
                <polygon points="60,66 53,66 42,78 78,78" fill="url(#laptopGlow)" />
                <path d="M28,68 C28,58 38,55 40,65 L38,80 L28,80 Z" fill="#6B2C91" className="dark:fill-pink-600" />
                <circle cx="34" cy="48" r="6" fill="#FCA5A5" />
                <path d="M28,48 C28,40 38,40 38,48 C38,44 32,42 28,44 Z" fill="#1E293B" />
                <path d="M27,48 L27,56 L29,56 L29,48 Z" fill="#1E293B" />
                <circle cx="45" cy="74" r="2" fill="#FCA5A5" />
                <circle cx="85" cy="40" r="1.5" fill="#EC4899" className="animate-pulse" />
                <circle cx="95" cy="55" r="1" fill="#6B2C91" className="animate-pulse" />
                <circle cx="15" cy="60" r="1" fill="#3B82F6" />
              </svg>
              {bannerButtonHref && (
                <NavLink to={bannerButtonHref}>
                  <Button className="mt-3 w-full h-8 text-[11px] font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700 cursor-pointer">
                    {bannerButtonText}
                  </Button>
                </NavLink>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  System Active
                </p>
              </div>
              <p className="text-xs font-black text-[#6B2C91] dark:text-pink-300 mt-2">
                {bannerTitle}
              </p>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                {bannerSubtitle}
              </p>
              <NavLink to={bannerButtonHref}>
                <Button className="mt-3.5 w-full h-8 text-[11px] font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700 cursor-pointer">
                  {bannerButtonText}
                </Button>
              </NavLink>
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}
