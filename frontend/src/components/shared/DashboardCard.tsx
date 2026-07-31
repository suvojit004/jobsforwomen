import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type DashboardCardProps = {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function DashboardCard({ children, className, onClick }: DashboardCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={onClick}
      className={cn(
        // min-w-0 overrides the browser default of min-width:auto on grid/flex
        // items. Without it, a card that wraps a wide <table> (even one
        // that's itself in an overflow-x-auto div) reports its intrinsic
        // content width -- the table's full min-content width, columns and
        // all -- as its own minimum size. The parent grid/flex track then
        // grows to fit that minimum, which on a phone-width screen is wider
        // than the viewport, and since nothing resets overflow-x on
        // html/body, the ENTIRE page becomes horizontally scrollable, not
        // just this card. That's what made the whole dashboard (navbar
        // included) appear shifted/cut off on mobile -- the page really was
        // wider than the screen, dragging everything above and below this
        // card along with it. min-w-0 lets this card shrink to its grid
        // track's actual width, so the inner overflow-x-auto div is the one
        // that scrolls, not the page.
        "min-w-0 gap-0 rounded-xl border border-slate-200/70 bg-white p-0 shadow-[0_8px_28px_rgba(15,23,42,0.06)] ring-0 dark:border-slate-800 dark:bg-slate-900/72 dark:shadow-none",
        className
      )}
    >
      {children}
    </motion.div>
  )
}
