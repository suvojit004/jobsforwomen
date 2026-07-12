import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { LogOut, Loader2 } from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { useAuth } from "@/hooks/useAuth"

export function Logout() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  useEffect(() => {
    // Real logout: revokes the refresh token server-side (POST
    // /api/v1/auth/logout) and clears the JWT access token from
    // localStorage. Previously this page had no logout call at all -- it
    // just waited 2 seconds and redirected to /dashboard while the access
    // token stayed valid, so DashboardRedirect bounced the recruiter right
    // back into /recruiter/dashboard. Clicking "Logout" did nothing at all.
    let cancelled = false
    async function performLogout() {
      await logout()
      if (!cancelled) {
        navigate("/auth/login", { replace: true })
      }
    }
    const timer = setTimeout(performLogout, 1200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [navigate, logout])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 select-none">
      <DashboardCard className="p-8 text-center max-w-md w-full space-y-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
        <div className="size-12 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center mx-auto dark:bg-pink-900/20 dark:text-pink-200">
          <LogOut className="size-6 animate-pulse" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Logging Out...</h2>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
            Thank you for hiring talent on JobsForWomen.info. You will be redirected to the login page shortly.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2 text-[11px] font-black uppercase text-slate-400">
          <Loader2 className="size-4 animate-spin text-[#6B2C91] dark:text-pink-400" />
          <span>Securing session files</span>
        </div>
      </DashboardCard>
    </div>
  )
}
export default Logout
