import type { ReactNode } from "react"
import { BrowserRouter } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { TooltipProvider } from "@/components/ui/tooltip"

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BrowserRouter>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TooltipProvider delayDuration={120}>{children}</TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
