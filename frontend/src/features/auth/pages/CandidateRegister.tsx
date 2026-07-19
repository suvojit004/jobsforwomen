import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Lock, Mail, User, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/shared/Logo"
import { useAuth } from "@/hooks/useAuth"
import { isValidEmail, isValidPassword, PASSWORD_HELP_TEXT } from "@/utils/validators"

export function CandidateRegister() {
  const navigate = useNavigate()
  const { registerCandidate } = useAuth()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName || !email || !password) {
      toast.error("Please fill in all fields")
      return
    }

    const errors: Record<string, string> = {}
    if (!isValidEmail(email)) errors.email = "Please enter a valid email address."
    if (!isValidPassword(password)) errors.password = PASSWORD_HELP_TEXT
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      toast.error("Please fix the highlighted fields.")
      return
    }
    setFieldErrors({})

    try {
      setLoading(true)
      await registerCandidate({ fullName, email, password })
      toast.success("Registration successful! Check your inbox for a verification link.")
      setRegistered(true)
    } catch (err: any) {
      toast.error(err.message || "Failed to register candidate profile.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleRegister = () => {
    // initiateGoogleOAuth reads req.query.role (not "roleType") -- this
    // previously sent the wrong param name, so it silently always fell back
    // to the "Candidate" default. Harmless on this specific page (which is
    // for candidates anyway), but fixed for correctness since a Recruiter
    // equivalent of this button would have silently registered recruiters as
    // candidates.
    toast.info("Connecting to Google OAuth account...")
    const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:5000"
    window.location.href = `${backendUrl}/api/v1/auth/google?role=Candidate`
  }

  if (registered) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBFD] dark:bg-slate-950 px-4 py-12 font-sans transition-colors duration-300">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-6 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl text-center"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/35">
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Check your email</h2>
          <p className="text-sm font-medium text-slate-550 dark:text-slate-400 leading-relaxed">
            We have sent a verification link to <span className="font-bold text-[#6B2C91] dark:text-pink-400">{email}</span>. 
            Please check your inbox (and spam folder) and verify your account to get started.
          </p>
          <Button className="w-full h-11 rounded-xl bg-gradient-to-r from-[#6B2C91] to-pink-600 font-bold text-white shadow-md" onClick={() => navigate("/auth/login")}>
            Go to Login
          </Button>
        </motion.div>
      </div>
    )
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
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#6B2C91] to-pink-600 bg-clip-text text-transparent">
            Join as Candidate
          </h2>
          <p className="text-sm font-medium text-slate-450 dark:text-slate-400 text-center">
            Create a candidate profile to explore wage-transparent jobs, mentorship pathways, and returnships.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleRegister}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Sarah Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="sarah@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    clearFieldError("email")
                  }}
                  className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
                />
              </div>
              {fieldErrors.email && <p className="text-[10px] font-bold text-red-500">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="•••••••• (Min 8 chars)"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    clearFieldError("password")
                  }}
                  className="pl-10 pr-10 h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">{PASSWORD_HELP_TEXT}</p>
              {fieldErrors.password && <p className="text-[10px] font-bold text-red-500">{fieldErrors.password}</p>}
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-[#6B2C91] to-pink-600 font-bold text-white shadow-md hover:from-[#5A247A] hover:to-pink-700"
          >
            {loading ? "Registering..." : "Create Account"}
          </Button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
          <span className="flex-shrink mx-4 text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest">Or</span>
          <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleRegister}
          className="w-full h-11 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center gap-2.5 font-bold text-slate-700 dark:text-slate-300"
        >
          <svg className="size-5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.65 1.42 7.5l3.87 3C6.24 7.69 8.89 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.57l3.77 2.92c2.2-2.03 3.68-5.02 3.68-8.64z"
            />
            <path
              fill="#FBBC05"
              d="M5.29 14.76c-.26-.79-.41-1.63-.41-2.51s.15-1.72.41-2.51L1.42 6.74c-.9 1.8-1.42 3.82-1.42 5.97s.52 4.17 1.42 5.97l3.87-2.92z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.77-2.92c-1.1.74-2.52 1.18-4.19 1.18-3.11 0-5.76-2.65-6.71-5.46l-3.87 3C3.37 20.35 7.35 23 12 23z"
            />
          </svg>
          Register with Google
        </Button>

        <div className="text-center text-sm font-semibold text-slate-550 dark:text-slate-400">
          Already have an account?{" "}
          <Link to="/auth/login" className="text-[#6B2C91] dark:text-pink-400 hover:underline font-bold">
            Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

export default CandidateRegister
