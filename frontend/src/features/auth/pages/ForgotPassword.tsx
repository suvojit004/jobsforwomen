import { useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Mail, ArrowLeft, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/shared/Logo"
import apiClient from "@/api/client"
import { isValidEmail } from "@/utils/validators"

export function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error("Please enter your email address")
      return
    }
    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address.")
      return
    }
    setEmailError(null)

    try {
      setLoading(true)
      const res = await apiClient.post("/api/v1/auth/forgot-password", { email })
      if (res && res.success) {
        toast.success(res.message || "Password reset link sent to your email.")
        setSubmitted(true)
      } else {
        toast.error(res?.message || "Failed to submit request.")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit password reset request.")
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
            Recover Password
          </h2>
          <p className="text-sm font-medium text-slate-450 dark:text-slate-450 text-center">
            Enter your registered email and we'll send you instructions to reset your password.
          </p>
        </div>

        {!submitted ? (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Email Address <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError(null)
                  }}
                  className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
                />
              </div>
              {emailError && <p className="text-[10px] font-bold text-red-500">{emailError}</p>}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#6B2C91] to-pink-600 font-bold text-white shadow-md hover:from-[#5A247A] hover:to-pink-700"
            >
              {loading ? "Submitting..." : "Send Reset Link"}
            </Button>
          </form>
        ) : (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-900/20 text-[#6B2C91] dark:text-pink-400 border border-pink-100 dark:border-pink-900/35">
              <KeyRound className="size-6" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              If an account exists for <span className="font-bold text-[#6B2C91] dark:text-pink-400">{email}</span>, 
              you will receive a password reset link shortly.
            </p>
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

export default ForgotPassword
