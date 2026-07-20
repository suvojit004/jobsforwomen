import { useState, useEffect } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { User, Lock, ArrowLeft, ShieldCheck, ShieldAlert, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/shared/Logo"
import apiClient from "@/api/client"
import { isValidPassword, PASSWORD_HELP_TEXT } from "@/utils/validators"

// Fixes the previously-broken "/accept-invitation" link mailed by
// email.listener.ts's EmployeeInvited handler (see email.ts's
// sendEmployeeInvitation) -- that link had nowhere to go at all: no route,
// no page. Modeled on ResetPassword.tsx's status state machine
// (form/success/error) plus CompanyVerification.tsx's pattern of validating
// the token up front on load (via the new GET /auth/invitations/:token
// endpoint) rather than only discovering it's dead after the invited person
// has already filled out the whole form.
export function AcceptInvitation() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get("token")

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [roleName, setRoleName] = useState("")

  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<"form" | "success">("form")

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setLoadError("This invitation link is invalid.")
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const res = await apiClient.get(`/api/v1/auth/invitations/${token}`)
        const data = res?.data
        setEmail(data?.email || "")
        setCompanyName(data?.companyName || null)
        setRoleName(data?.roleName || "team member")
      } catch (err: any) {
        setLoadError(err.message || "This invitation link is invalid, has already been used, or has expired.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast.error("Invitation token is missing.")
      return
    }
    if (!fullName.trim() || fullName.trim().length < 2) {
      toast.error("Please enter your full name (at least 2 characters).")
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
      setSubmitting(true)
      const res = await apiClient.post("/api/v1/auth/invitations/accept", {
        token,
        fullName: fullName.trim(),
        password,
      })
      if (res && res.success) {
        toast.success("Account created successfully!")
        setStatus("success")
      } else {
        toast.error(res?.message || "Failed to accept invitation. The link may have expired.")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to accept invitation.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBFD] dark:bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#6B2C91]" />
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
          {!loadError && status === "form" && (
            <>
              <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#6B2C91] to-pink-600 bg-clip-text text-transparent text-center">
                Join {companyName || "the Team"}
              </h2>
              <p className="text-sm font-medium text-slate-450 dark:text-slate-400 text-center">
                You've been invited to join{companyName ? ` ${companyName}` : ""} as a <strong className="text-slate-700 dark:text-slate-300">{roleName}</strong>
                {email ? <> ({email})</> : null}. Set a password below to activate your account.
              </p>
            </>
          )}
        </div>

        {loadError && (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/35">
              <ShieldAlert className="size-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Invitation Not Available</h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{loadError}</p>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
              Ask whoever invited you to send a new invitation from Team Management.
            </p>
          </div>
        )}

        {!loadError && status === "form" && (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="fullName" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Full Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="pass" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Password <span className="text-red-500">*</span></label>
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
                <label htmlFor="confirm" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Confirm Password <span className="text-red-500">*</span></label>
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
              disabled={submitting}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#6B2C91] to-pink-600 font-bold text-white shadow-md hover:from-[#5A247A] hover:to-pink-700 mt-2"
            >
              {submitting ? "Creating Account..." : "Accept Invitation & Create Account"}
            </Button>
          </form>
        )}

        {status === "success" && (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/35">
              <ShieldCheck className="size-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Welcome Aboard!</h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              Your account has been created{companyName ? <> and linked to <strong>{companyName}</strong></> : null}. You can now sign in with your new password.
            </p>
            <Button className="w-full h-11 rounded-xl bg-gradient-to-r from-[#6B2C91] to-pink-600 font-bold text-white shadow-md" onClick={() => navigate("/auth/login")}>
              Proceed to Login
            </Button>
          </div>
        )}

        {companyName && status === "form" && !loadError && (
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
            <Building2 className="size-3" />
            Invitation from {companyName}
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

export default AcceptInvitation
