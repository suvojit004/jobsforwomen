import { useNavigate } from "react-router-dom"
import { Lock, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "../DashboardCard"

export function UnauthorizedPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 select-none">
      <DashboardCard className="p-8 text-center max-w-md w-full space-y-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
        <div className="size-12 rounded-full bg-amber-100 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center mx-auto">
          <Lock className="size-5" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-black text-slate-950 dark:text-white">403 - Access Denied</h2>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
            You do not have the required administrative credentials to view this page directory. Please check your role scope settings.
          </p>
        </div>
        <div className="pt-2 flex justify-center">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="font-extrabold text-xs h-9 px-4 gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            Go Back
          </Button>
        </div>
      </DashboardCard>
    </div>
  )
}
export default UnauthorizedPage
