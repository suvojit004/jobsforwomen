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
  Users,
  BriefcaseBusiness,
  Building,
  FileText,
  LineChart,
  Activity,
  ShieldAlert,
  Sparkles,
  Settings,
  LogOut,
} from "lucide-react"

const adminMenuItems = [
  { label: "Dashboard", icon: Home, href: "/admin/dashboard" },
  { label: "Manage Users", icon: Users, href: "/admin/users" },
  { label: "Moderate Jobs", icon: BriefcaseBusiness, href: "/admin/jobs" },
  { label: "Verify Companies", icon: Building, href: "/admin/companies" },
  { label: "Audit Logs", icon: FileText, href: "/admin/audit-logs" },
  { label: "Reports", icon: LineChart, href: "/admin/reports" },
  { label: "System Health", icon: Activity, href: "/admin/health" },
  { label: "Permissions Matrix", icon: ShieldAlert, href: "/admin/permissions" },
  { label: "Feature Configs", icon: Sparkles, href: "/admin/features" },
  { label: "Settings", icon: Settings, href: "/admin/settings" },
  { label: "Logout", icon: LogOut, href: "/admin/logout" },
]

const adminMobileItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: Home },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Jobs", href: "/admin/jobs", icon: BriefcaseBusiness },
  { label: "Health", href: "/admin/health", icon: Activity },
  { label: "Settings", href: "/admin/settings", icon: Settings },
]

export function AdminLayout() {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-950 dark:bg-[#0F172A] dark:text-slate-50">
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 xl:w-[264px] lg:block">
          <Sidebar
            menuItems={adminMenuItems}
            bannerTitle="Platform Operations"
            bannerSubtitle="Monitor platform audits, settings, and health metrics."
            bannerButtonText="System Health"
            bannerButtonHref="/admin/health"
          />
        </aside>

        <Sheet open={isNavigationOpen} onOpenChange={setIsNavigationOpen}>
          <SheetContent
            side="left"
            className="w-[264px] max-w-[86vw] p-0"
            showCloseButton={false}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Admin Navigation</SheetTitle>
              <SheetDescription>
                Main navigation for the admin control center.
              </SheetDescription>
            </SheetHeader>
            <Sidebar
              onNavigate={() => setIsNavigationOpen(false)}
              menuItems={adminMenuItems}
              bannerTitle="Platform Operations"
              bannerSubtitle="Monitor platform audits, settings, and health metrics."
              bannerButtonText="System Health"
              bannerButtonHref="/admin/health"
            />
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1 lg:pl-20 xl:pl-[264px]">
          <Navbar
            onMenuClick={() => setIsNavigationOpen(true)}
            userName="SysAdmin Control"
            userRole="Principal Platform Admin"
            accountTypeLabel="Administrator Account"
            switchRoleLabel="Switch to Candidate"
            switchRoleHref="/dashboard"
          />
          <main className="mx-auto w-full max-w-[1540px] px-4 pb-24 pt-5 sm:px-5 lg:px-6 lg:pb-8">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileBottomNav menuItems={adminMobileItems} />
    </div>
  )
}
export default AdminLayout
