import { useTheme } from "next-themes"
import { useNavigate } from "react-router-dom"
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
} from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/shared/Logo"
import { useAuth } from "@/hooks/useAuth"
import { useNotificationContext } from "@/contexts/NotificationContext"

export function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isDark = theme === "dark"

  let unreadCount = 0
  try {
    const context = useNotificationContext()
    unreadCount = context.unreadCount
  } catch (err) {
    // Ignore context issues outside providers
  }

  const handleLogout = async () => {
    await logout()
    navigate("/", { replace: true })
  }

  // Single source of truth for "which portal is this user in" -- used by
  // both the bell and the Settings menu item below. Previously each one
  // reimplemented this check separately and neither one included Moderator/
  // Support Executive, so clicking Settings (which was additionally
  // hardcoded to "/candidate/profile" regardless of portal) sent every
  // non-Candidate role into ProtectedRoute's role check for /candidate/*,
  // which redirects to /unauthorized -- the "403 Access Denied" the recruiter/
  // admin/moderator/support-executive portals were all seeing.
  const getPortalBase = () => {
    if (!user) return "/candidate"
    const roles = user.roles || []
    if (roles.some((r) => ["Super Admin", "Admin", "Moderator", "Support Executive"].includes(r))) {
      return "/admin"
    }
    if (roles.includes("Recruiter")) {
      return "/recruiter"
    }
    return "/candidate"
  }

  const handleBellClick = () => {
    if (!user) return
    navigate(`${getPortalBase()}/notifications`)
  }

  const handleSettingsClick = () => {
    navigate(`${getPortalBase()}/settings`)
  }

  // Get initials for profile fallback
  const getInitials = () => {
    if (!user) return "U"
    const name = user.fullName || user.email
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const nameLabel = user ? (user.fullName || user.email) : "User"
  const roleLabel = user ? user.roles.join(", ") : "Guest"

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#F8FAFC]/90 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-[#0F172A]/90 sm:px-5 lg:px-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>

        <div className="mr-auto flex items-center gap-2 lg:hidden">
          <Logo compact />
          <span className="hidden text-sm font-extrabold text-slate-950 dark:text-white min-[420px]:inline">
            JobsForWomen.info
          </span>
        </div>

        <div className="relative hidden w-full max-w-xl lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search jobs, companies, resources..."
            className="h-10 rounded-xl border-slate-200 bg-white pl-10 pr-16 text-sm shadow-sm focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
            aria-label="Search platform"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 select-none rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-450 dark:border-slate-700 dark:bg-slate-800">
            Ctrl + K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative shrink-0"
            onClick={handleBellClick}
            aria-label="View notifications"
          >
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
                {unreadCount}
              </span>
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 gap-2 rounded-xl px-1.5 sm:px-2"
                aria-label="Open profile menu"
              >
                <Avatar size="lg">
                  {/* Previously only ever rendered the initials fallback --
                      no AvatarImage existed here at all, so even a user with
                      a fully uploaded profile photo never saw it in the
                      top-right corner. */}
                  {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={nameLabel} />}
                  <AvatarFallback className="bg-gradient-to-br from-pink-100 to-violet-200 text-sm font-bold text-[#6B2C91] dark:from-pink-500/20 dark:to-violet-500/25 dark:text-pink-100">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden min-w-0 text-left lg:block">
                  <span className="block truncate text-sm font-bold">
                    {nameLabel}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {roleLabel}
                  </span>
                </span>
                <ChevronDown className="hidden size-4 text-slate-500 lg:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSettingsClick}>
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
