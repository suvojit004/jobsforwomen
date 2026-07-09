import { useState } from "react"
import { Outlet } from "react-router-dom"
import { MobileBottomNav } from "@/components/layout/MobileBottomNav"
import { Navbar } from "@/components/layout/Navbar"
import { Sidebar } from "@/components/layout/Sidebar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Home,
  UserRound,
  BriefcaseBusiness,
  Bookmark,
  Bell,
  MessageSquare,
  Settings,
  CircleHelp,
} from "lucide-react"

const candidateMenuItems = [
  { label: "Dashboard", icon: Home, href: "/candidate/dashboard" },
  { label: "Profile", icon: UserRound, href: "/candidate/profile" },
  { label: "Browse Jobs", icon: BriefcaseBusiness, href: "/candidate/jobs" },
  { label: "My Applications", icon: Bookmark, href: "/candidate/applications" },
  { label: "Saved Jobs", icon: Bookmark, href: "/candidate/saved-jobs" },
  { label: "Notifications", icon: Bell, href: "/candidate/notifications" },
  { label: "Messages", icon: MessageSquare, href: "/candidate/messages" },
  { label: "Settings", icon: Settings, href: "/candidate/settings" },
  { label: "Help", icon: CircleHelp, href: "/candidate/help" },
]

const candidateMobileItems = [
  { label: "Home", href: "/candidate/dashboard", icon: Home },
  { label: "Jobs", href: "/candidate/jobs", icon: BriefcaseBusiness },
  { label: "Applications", href: "/candidate/applications", icon: Bookmark },
  { label: "Messages", href: "/candidate/messages", icon: MessageSquare },
  { label: "Profile", href: "/candidate/profile", icon: UserRound },
]

export function CandidateLayout() {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-950 dark:bg-[#0F172A] dark:text-slate-50">
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 xl:w-[264px] lg:block">
          <Sidebar 
            menuItems={candidateMenuItems}
            bannerTitle="Empowering Women"
            bannerSubtitle="Explore diverse returnships and flexible roles."
            bannerButtonText="Browse Jobs"
            bannerButtonHref="/candidate/jobs"
          />
        </aside>

        <Sheet open={isNavigationOpen} onOpenChange={setIsNavigationOpen}>
          <SheetContent
            side="left"
            className="w-[264px] max-w-[86vw] p-0"
            showCloseButton={false}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Candidate navigation</SheetTitle>
              <SheetDescription>
                Main navigation for the candidate dashboard.
              </SheetDescription>
            </SheetHeader>
            <Sidebar 
              onNavigate={() => setIsNavigationOpen(false)} 
              menuItems={candidateMenuItems}
              bannerTitle="Empowering Women"
              bannerSubtitle="Explore diverse returnships and flexible roles."
              bannerButtonText="Browse Jobs"
              bannerButtonHref="/candidate/jobs"
            />
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1 lg:pl-20 xl:pl-[264px]">
          <Navbar onMenuClick={() => setIsNavigationOpen(true)} />
          <main className="mx-auto w-full max-w-[1540px] px-4 pb-24 pt-5 sm:px-5 lg:px-6 lg:pb-8">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileBottomNav menuItems={candidateMobileItems} />
    </div>
  )
}
export default CandidateLayout
