import { useNavigate } from "react-router-dom"
import { EyeOff, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "../DashboardCard"

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 select-none">
      <DashboardCard className="p-8 text-center max-w-md w-full space-y-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
        <div className="size-12 rounded-full bg-violet-50 text-[#6B2C91] flex items-center justify-center mx-auto dark:bg-violet-950/20 dark:text-pink-200">
          <EyeOff className="size-6 text-[#6B2C91] dark:text-pink-300" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-black text-slate-950 dark:text-white">404 - Page Not Found</h2>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
            The link you followed may be broken, or the page may have been removed. Check the URL and try again.
          </p>
        </div>
        <div className="pt-2 flex justify-center">
          <Button
            onClick={() => navigate("/dashboard")}
            className="bg-[#6B2C91] hover:bg-[#5a237b] text-white font-extrabold text-xs h-9 px-4 gap-1.5 cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700"
          >
            <Home className="size-3.5" />
            Back to Dashboard
          </Button>
        </div>
      </DashboardCard>
    </div>
  )
}
export default NotFoundPage
