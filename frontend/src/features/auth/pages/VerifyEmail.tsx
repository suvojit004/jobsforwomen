import { useEffect, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { MailCheck, ShieldAlert, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import apiClient from "@/api/client"

export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("Verifying your email address...")

  const token = searchParams.get("token")

  useEffect(() => {
    const performVerification = async () => {
      if (!token) {
        setStatus("error")
        setMessage("Invalid verification request. No verification token was provided.")
        return
      }

      try {
        const res = await apiClient.get(`/api/v1/auth/verify-email?token=${token}`)
        if (res && res.success) {
          setStatus("success")
          setMessage(res.message || "Your email has been verified successfully!")
          toast.success("Email verified successfully!")
        } else {
          setStatus("error")
          setMessage(res?.message || "Verification failed. The token may be invalid or expired.")
        }
      } catch (err: any) {
        setStatus("error")
        setMessage(err.message || "Verification failed. Please request a new verification link.")
      }
    }

    performVerification()
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDFBFD] dark:bg-slate-950 px-4 py-12 font-sans transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-6 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl text-center"
      >
        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="mx-auto size-12 animate-spin text-[#6B2C91] dark:text-pink-400" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Verifying Email</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/35">
              <MailCheck className="size-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Email Verified!</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
            <Button className="w-full h-11 rounded-xl bg-gradient-to-r from-[#6B2C91] to-pink-600 font-bold text-white shadow-md" onClick={() => navigate("/auth/login")}>
              Proceed to Login
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/35">
              <ShieldAlert className="size-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Verification Failed</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
            <Button className="w-full h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-350 shadow-sm" onClick={() => navigate("/auth/login")}>
              Go to Login
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default VerifyEmail
