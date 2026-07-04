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

const sidebarItems = [
  { label: "Dashboard", icon: Home, href: "/dashboard" },
  { label: "Profile", icon: UserRound, href: "/profile" },
  { label: "Browse Jobs", icon: BriefcaseBusiness, href: "/jobs" },
  { label: "My Applications", icon: Bookmark, href: "/applications" },
  { label: "Saved Jobs", icon: Bookmark, href: "/saved-jobs" },
  { label: "Notifications", icon: Bell, href: "/notifications", badge: "3" },
  { label: "Messages", icon: MessageSquare, href: "/messages" },
  { label: "Settings", icon: Settings, href: "/settings" },
  { label: "Help", icon: CircleHelp, href: "/help" },
  { label: "Logout", icon: LogOut, href: "/logout" },
]

export type SidebarItem = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  badge?: string
}

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

      <nav className="flex flex-1 flex-col gap-1" aria-label="Navigation">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.href}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-600 transition-all hover:bg-violet-50 hover:text-[#6B2C91] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/40 dark:text-slate-300 dark:hover:bg-violet-500/10 dark:hover:text-pink-100 lg:justify-center xl:justify-start",
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
        <div className="mt-6 rounded-xl bg-gradient-to-br from-violet-50 to-pink-50 p-4 ring-1 ring-violet-100 dark:from-violet-500/15 dark:to-pink-500/10 dark:ring-violet-400/20 lg:hidden xl:block">
          <p className="text-sm font-bold text-[#6B2C91] dark:text-pink-100">
            {bannerTitle}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {bannerSubtitle}
          </p>
          <NavLink to={bannerButtonHref}>
            <Button className="mt-4 w-full bg-[#6B2C91] hover:bg-[#5a237b] cursor-pointer">
              {bannerButtonText}
            </Button>
          </NavLink>
        </div>
      )}
    </motion.div>
  )
}
