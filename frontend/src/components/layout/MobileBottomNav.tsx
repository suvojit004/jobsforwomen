import { BriefcaseBusiness, Home, Send, UserRound } from "lucide-react"
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"

const mobileItems = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Jobs", href: "/jobs", icon: BriefcaseBusiness },
  { label: "Applications", href: "/applications", icon: Send },
  { label: "Profile", href: "/profile", icon: UserRound },
]

export type MobileNavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

type MobileBottomNavProps = {
  menuItems?: MobileNavItem[]
}

export function MobileBottomNav({ menuItems }: MobileBottomNavProps) {
  const items = menuItems ?? mobileItems

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-2 pt-1 shadow-[0_-12px_28px_rgba(15,23,42,0.08)] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/95">
      {/* Column count tracks the actual item count (was a hardcoded
          grid-cols-5) -- removing the Messages entry from any caller's
          menuItems dropped it to 4 items, which left a dead empty column
          under the fixed 5-column grid. Tailwind can't resolve a
          dynamically-built "grid-cols-${n}" class name (JIT needs a
          static string), so this uses an inline style instead. */}
      <div
        className="mx-auto grid max-w-md"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-semibold text-slate-500 transition-colors dark:text-slate-400",
                isActive && "text-[#6B2C91] dark:text-pink-200"
              )
            }
          >
            <item.icon className="size-4" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
