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
  FilePlus,
  BriefcaseBusiness,
  Users,
  MessageSquare,
  Building,
  LineChart,
  Settings,
  CircleHelp,
  LogOut,
} from "lucide-react"

const recruiterMenuItems = [
  { label: "Dashboard", icon: Home, href: "/recruiter/dashboard" },
  { label: "Post a Job", icon: FilePlus, href: "/recruiter/post-job" },
  { label: "My Jobs", icon: BriefcaseBusiness, href: "/recruiter/manage-jobs" },
  { label: "Applicants", icon: Users, href: "/recruiter/applicants" },
  { label: "Messages", icon: MessageSquare, href: "/recruiter/messages", badge: "2" },
  { label: "Company Profile", icon: Building, href: "/recruiter/company" },
  { label: "Analytics", icon: LineChart, href: "/recruiter/analytics" },
  { label: "Settings", icon: Settings, href: "/recruiter/settings" },
  { label: "Help & Support", icon: CircleHelp, href: "/recruiter/help" },
  { label: "Logout", icon: LogOut, href: "/recruiter/logout" },
]

const recruiterMobileItems = [
  { label: "Dashboard", href: "/recruiter/dashboard", icon: Home },
  { label: "Jobs", href: "/recruiter/manage-jobs", icon: BriefcaseBusiness },
  { label: "Applicants", href: "/recruiter/applicants", icon: Users },
  { label: "Messages", href: "/recruiter/messages", icon: MessageSquare },
  { label: "Menu", href: "/recruiter/settings", icon: Settings },
]

export function RecruiterLayout() {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-950 dark:bg-[#0F172A] dark:text-slate-50">
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 xl:w-[264px] lg:block">
          <Sidebar
            menuItems={recruiterMenuItems}
            bannerTitle="Hire amazing women talent"
            bannerSubtitle="Build a diverse and inclusive team."
            bannerButtonText="Post a Job"
            bannerButtonHref="/recruiter/post-job"
          />
        </aside>

        <Sheet open={isNavigationOpen} onOpenChange={setIsNavigationOpen}>
          <SheetContent
            side="left"
            className="w-[264px] max-w-[86vw] p-0"
            showCloseButton={false}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Recruiter navigation</SheetTitle>
              <SheetDescription>
                Main navigation for the recruiter dashboard.
              </SheetDescription>
            </SheetHeader>
            <Sidebar
              onNavigate={() => setIsNavigationOpen(false)}
              menuItems={recruiterMenuItems}
              bannerTitle="Hire amazing women talent"
              bannerSubtitle="Build a diverse and inclusive team."
              bannerButtonText="Post a Job"
              bannerButtonHref="/recruiter/post-job"
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
      <MobileBottomNav menuItems={recruiterMobileItems} />
    </div>
  )
}
