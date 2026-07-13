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
        "gap-0 rounded-xl border border-slate-200/70 bg-white p-0 shadow-[0_8px_28px_rgba(15,23,42,0.06)] ring-0 dark:border-slate-800 dark:bg-slate-900/72 dark:shadow-none",
        className
      )}
    >
      {children}
    </motion.div>
  )
}
