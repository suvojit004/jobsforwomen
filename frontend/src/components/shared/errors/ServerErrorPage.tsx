import { ShieldAlert, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "../DashboardCard"

export function ServerErrorPage() {
  const handleReload = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 select-none">
      <DashboardCard className="p-8 text-center max-w-md w-full space-y-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
        <div className="size-12 rounded-full bg-red-100 dark:bg-red-950/20 text-red-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="size-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-black text-slate-950 dark:text-white">500 - Server Error</h2>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
            Our servers are currently experiencing temporary connectivity issues. Please reload the browser tab or contact tech support.
          </p>
        </div>
        <div className="pt-2 flex justify-center">
          <Button
            onClick={handleReload}
            className="bg-[#6B2C91] hover:bg-[#5a237b] text-white font-extrabold text-xs h-9 px-4 gap-1.5 cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700"
          >
            <RefreshCw className="size-3.5" />
            Retry Connection
          </Button>
        </div>
      </DashboardCard>
    </div>
  )
}
export default ServerErrorPage
