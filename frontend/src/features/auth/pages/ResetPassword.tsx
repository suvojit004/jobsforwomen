import React, { useState } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Lock, ArrowLeft, ShieldCheck, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/shared/Logo"
import apiClient from "@/api/client"
import { isValidPassword, PASSWORD_HELP_TEXT } from "@/utils/validators"

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"form" | "success" | "error">("form")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast.error("Password reset token is missing.")
      setStatus("error")
      return
    }

    if (!password || !confirmPassword) {
      toast.error("Please fill in all fields")
      return
    }

    if (!isValidPassword(password)) {
      toast.error(PASSWORD_HELP_TEXT)
      return
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    try {
      setLoading(true)
      const res = await apiClient.post("/api/v1/auth/reset-password", { token, password })
      if (res && res.success) {
        toast.success("Password reset successfully!")
        setStatus("success")
      } else {
        toast.error(res?.message || "Failed to reset password. The link may have expired.")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDFBFD] dark:bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 font-sans transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl"
      >
        <div className="flex flex-col items-center space-y-4">
          <Logo />
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#6B2C91] to-pink-600 bg-clip-text text-transparent text-center">
            Set New Password
          </h2>
          <p className="text-sm font-medium text-slate-450 dark:text-slate-400 text-center">
            Please enter your new strong password below to complete password recovery.
          </p>
        </div>

        {status === "form" && (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="pass" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="pass"
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
                  />
                </div>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">{PASSWORD_HELP_TEXT}</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirm" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="confirm"
                    name="confirmPassword"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#6B2C91] to-pink-600 font-bold text-white shadow-md hover:from-[#5A247A] hover:to-pink-700 mt-2"
            >
              {loading ? "Resetting Password..." : "Update Password"}
            </Button>
          </form>
        )}

        {status === "success" && (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/35">
              <ShieldCheck className="size-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Password Changed!</h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              Your password has been updated successfully. You can now use your new password to sign in.
            </p>
            <Button className="w-full h-11 rounded-xl bg-gradient-to-r from-[#6B2C91] to-pink-600 font-bold text-white shadow-md" onClick={() => navigate("/auth/login")}>
              Proceed to Login
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/35">
              <ShieldAlert className="size-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Link Expired</h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              The password reset token is invalid, expired, or has already been used.
            </p>
            <Button className="w-full h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-350 shadow-sm" onClick={() => navigate("/auth/forgot-password")}>
              Request New Link
            </Button>
          </div>
        )}

        <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
          <Link to="/auth/login" className="inline-flex items-center gap-2 text-sm font-bold text-[#6B2C91] dark:text-pink-400 hover:underline">
            <ArrowLeft className="size-4" />
            Back to Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

export default ResetPassword
