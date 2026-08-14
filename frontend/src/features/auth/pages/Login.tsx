import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/shared/Logo"
import { BackToHomeLink } from "@/components/shared/BackToHomeLink"
import { useAuth } from "@/hooks/useAuth"
import { isValidEmail } from "@/utils/validators"
import type { User, TwoFactorChallenge } from "@/contexts/AuthContext"

// Explicit type predicate rather than relying on `"requiresTwoFactor" in
// result` inline narrowing -- more reliable across TS versions than
// re-deriving the same check ad hoc at each call site.
function isTwoFactorChallenge(result: User | TwoFactorChallenge): result is TwoFactorChallenge {
  return (result as TwoFactorChallenge).requiresTwoFactor === true
}

export function Login() {
  const navigate = useNavigate()
  const { login, verifyTwoFactor } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Set once login() returns a two-factor challenge instead of a session --
  // presence of a pendingToken switches the form to the code-entry step.
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState("")

  const redirectForRole = (user: User) => {
    toast.success(`Welcome back, ${user.fullName || user.email}!`)
    const userRole = user.roles[0]?.toLowerCase()
    if (userRole === "admin" || userRole === "super admin") {
      navigate("/admin/dashboard", { replace: true })
    } else if (userRole === "recruiter") {
      navigate("/recruiter/dashboard", { replace: true })
    } else {
      navigate("/dashboard", { replace: true })
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error("Please fill in all fields")
      return
    }

    // catch an obvious typo (e.g. missing "@") before round-tripping
    // to the server -- doesn't change what the backend enforces, just gives
    // faster feedback for the most common mistake.
    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address.")
      return
    }
    setEmailError(null)

    try {
      setLoading(true)
      const result = await login(email, password)
      if (isTwoFactorChallenge(result)) {
        setPendingToken(result.pendingToken)
        return
      }
      redirectForRole(result)
    } catch (err: any) {
      toast.error(err.message || "Failed to log in. Please check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingToken) return
    if (!/^\d{6}$/.test(twoFactorCode.trim())) {
      toast.error("Enter the 6-digit code from your authenticator app.")
      return
    }

    try {
      setLoading(true)
      const user = await verifyTwoFactor(pendingToken, twoFactorCode.trim())
      redirectForRole(user)
    } catch (err: any) {
      toast.error(err.message || "Invalid code. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleOAuth = () => {
    toast.info("Connecting to Google OAuth account...")
    // Redirect to backend Google OAuth initiation route
    const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:5000"
    window.location.href = `${backendUrl}/api/v1/auth/google`
  }

  // Password check passed, but the account has 2FA enrolled -- swap to the
  // code-entry step instead of the password form. pendingToken is only
  // valid for 5 minutes (see AuthService.generateTwoFactorPendingToken),
  // so "Back" re-runs the password step to get a fresh one.
  if (pendingToken) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#FDFBFD] dark:bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 font-sans transition-colors duration-300">
        <BackToHomeLink />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl"
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-r from-[#6B2C91] to-pink-600">
              <ShieldCheck className="size-7 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Two-factor authentication
            </h2>
            <p className="text-sm font-medium text-slate-450 dark:text-slate-400 text-center">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleVerifyTwoFactor}>
            <div className="space-y-1.5">
              <label htmlFor="twoFactorCode" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Authentication Code
              </label>
              <Input
                id="twoFactorCode"
                name="twoFactorCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                placeholder="123456"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-11 text-center text-lg tracking-[0.5em] border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#6B2C91] to-pink-600 font-bold text-white shadow-md hover:from-[#5A247A] hover:to-pink-700"
            >
              {loading ? "Verifying..." : "Verify & Sign In"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setPendingToken(null)
                setTwoFactorCode("")
              }}
              className="w-full text-center text-xs font-bold text-[#6B2C91] dark:text-pink-400 hover:underline"
            >
              Back to sign in
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#FDFBFD] dark:bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 font-sans transition-colors duration-300">
      <BackToHomeLink />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl"
      >
        <div className="flex flex-col items-center space-y-4">
          <Logo />
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#6B2C91] to-pink-600 bg-clip-text text-transparent">
            Welcome back
          </h2>
          <p className="text-sm font-medium text-slate-450 dark:text-slate-400 text-center">
            Sign in to access your jobs, company dashboard, or administration tasks.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Email Address <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@company.com"
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Password <span className="text-red-500">*</span></label>
                <Link to="/auth/forgot-password" className="text-xs font-bold text-[#6B2C91] dark:text-pink-400 hover:underline">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-[#6B2C91] to-pink-600 font-bold text-white shadow-md hover:from-[#5A247A] hover:to-pink-700"
          >
            {loading ? "Signing in..." : "Sign In"}
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
          onClick={handleGoogleOAuth}
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
          Continue with Google
        </Button>

        <div className="text-center text-sm font-semibold text-slate-550 dark:text-slate-400">
          New to JobsForWomen?{" "}
          <div className="mt-2 flex items-center justify-center gap-4">
            <Link to="/auth/register/candidate" className="text-[#6B2C91] dark:text-pink-400 hover:underline font-bold">
              Join as Candidate
            </Link>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <Link to="/auth/register/recruiter" className="text-pink-600 dark:text-pink-400 hover:underline font-bold">
              Register Company
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Login
