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
  ShieldAlert,
  Settings,
  LogOut,
  UserCheck,
  Bell,
  CircleHelp,
  Sparkles,
  Shield,
  Activity,
  Award,
  ShieldCheck,
} from "lucide-react"

const adminMenuItems = [
  { label: "Dashboard", icon: Home, href: "/admin/dashboard" },
  { label: "Company Registration Requests", icon: Building, href: "/admin/company-approvals" },
  { label: "Company Perk Requests", icon: Award, href: "/admin/company-perk-requests" },
  { label: "Candidate Management", icon: UserCheck, href: "/admin/candidate-management" },
  { label: "Company Details", icon: BriefcaseBusiness, href: "/admin/company-details" },
  { label: "Job Moderation", icon: ShieldAlert, href: "/admin/job-moderation" },
  { label: "Users", icon: Users, href: "/admin/users" },
  { label: "Reports & Analytics", icon: LineChart, href: "/admin/reports-analytics" },
  { label: "Notifications", icon: Bell, href: "/admin/notifications" },
  { label: "Settings", icon: Settings, href: "/admin/settings" },
  { label: "Activity Logs", icon: FileText, href: "/admin/activity-logs" },
  { label: "Feature Configs", icon: Sparkles, href: "/admin/feature-configs" },
  { label: "Roles & Permissions", icon: Shield, href: "/admin/roles-permissions" },
  { label: "Admin Management", icon: ShieldCheck, href: "/admin/admin-management", superAdminOnly: true },
  { label: "System Health", icon: Activity, href: "/admin/system-health" },
  { label: "Help & Support", icon: CircleHelp, href: "/admin/help-support" },
  { label: "Logout", icon: LogOut, href: "/admin/logout" },
]

const adminMobileItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: Home },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Jobs", href: "/admin/job-moderation", icon: ShieldAlert },
  { label: "Notifications", href: "/admin/notifications", icon: Bell },
  { label: "Settings", href: "/admin/settings", icon: Settings },
]

import { NotificationProvider, useNotificationContext } from "@/contexts/NotificationContext"
import { useAuth } from "@/hooks/useAuth"

function AdminLayoutInner() {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false)
  const { unreadCount } = useNotificationContext()
  const { user } = useAuth()
  const isSuperAdmin = (user?.roles || []).includes("Super Admin")

  const menuItems = adminMenuItems
    .filter((item) => !item.superAdminOnly || isSuperAdmin)
    .map((item) =>
      item.label === "Notifications"
        ? { ...item, badge: unreadCount > 0 ? String(unreadCount) : undefined }
        : item
    )

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-950 dark:bg-[#0F172A] dark:text-slate-50">
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 xl:w-[264px] lg:block">
          <Sidebar
            menuItems={menuItems}
            bannerTitle="Empowering Women"
            bannerSubtitle="Building a better future program."
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
              menuItems={menuItems}
              bannerTitle="Empowering Women"
              bannerSubtitle="Building a better future program."
              bannerButtonText="System Health"
              bannerButtonHref="/admin/health"
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
      <MobileBottomNav menuItems={adminMobileItems} />
    </div>
  )
}

export function AdminLayout() {
  return (
    <NotificationProvider>
      <AdminLayoutInner />
    </NotificationProvider>
  )
}
export default AdminLayout
