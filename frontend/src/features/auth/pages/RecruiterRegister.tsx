import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Lock, Mail, User, Phone, Building, Globe, MapPin, Briefcase, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/shared/Logo"
import { useAuth } from "@/hooks/useAuth"
import { isValidEmail, isValidPhone, isValidPassword, isValidWebsite, normalizeWebsite, PASSWORD_HELP_TEXT } from "@/utils/validators"

export function RecruiterRegister() {
  const navigate = useNavigate()
  const { registerRecruiter } = useAuth()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [website, setWebsite] = useState("")
  const [location, setLocation] = useState("")
  const [industry, setIndustry] = useState("")

  // Part 16: this form previously did length-only checks (password >= 8
  // chars, phone >= 10 chars -- so "aaaaaaaaaa" passed as a "phone number")
  // via toast-only feedback with no per-field indication of what was wrong.
  // Real format validation now runs inline, field-by-field.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)

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
    if (!fullName || !email || !password || !phone || !companyName || !website || !location || !industry) {
      toast.error("Please fill in all fields")
      return
    }

    const errors: Record<string, string> = {}
    if (!isValidEmail(email)) errors.email = "Please enter a valid email address."
    if (!isValidPassword(password)) errors.password = PASSWORD_HELP_TEXT
    if (!isValidPhone(phone)) errors.phone = "Please enter a valid phone number (10-14 digits)."
    if (!isValidWebsite(website)) errors.website = "Please enter a valid website URL (e.g. company.com)."
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      toast.error("Please fix the highlighted fields.")
      return
    }
    setFieldErrors({})

    try {
      setLoading(true)
      await registerRecruiter({
        fullName,
        email,
        password,
        phone,
        companyName,
        website: normalizeWebsite(website),
        location,
        industry,
      })
      toast.success("Recruiter profile registered! Verification link sent to email.")
      setRegistered(true)
    } catch (err: any) {
      toast.error(err.message || "Failed to register recruiter profile.")
    } finally {
      setLoading(false)
    }
  }

  if (registered) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBFD] px-4 py-12 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-6 bg-white p-8 rounded-3xl border border-slate-100 shadow-xl text-center"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600 border border-green-200">
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">Registration Submitted Successfully</h2>
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
            Your company registration has been submitted for verification. Our team will review it within 24-48 hours.
            First, verify your email at <span className="font-bold text-[#6B2C91]">{email}</span> -- you'll receive
            another email once your company verification is complete.
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
        className="w-full max-w-xl space-y-8 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl"
      >
        <div className="flex flex-col items-center space-y-4">
          <Logo />
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#6B2C91] to-pink-600 bg-clip-text text-transparent">
            Register Company
          </h2>
          <p className="text-sm font-medium text-slate-450 dark:text-slate-400 text-center">
            List your brand as an equality-focused partner, post transparent salary jobs, and build diverse teams.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleRegister}>
          <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Recruiter Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Preeti Roy"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    clearFieldError("phone")
                  }}
                  className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
                />
              </div>
              {fieldErrors.phone && <p className="text-[10px] font-bold text-red-500">{fieldErrors.phone}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Business Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="preeti@jfw.info"
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
              <label htmlFor="password" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Account Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
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

          <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 pt-4">Company Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="companyName" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Company Name</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  placeholder="Google India"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="website" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Website URL</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="website"
                  name="website"
                  type="url"
                  required
                  placeholder="https://google.co.in"
                  value={website}
                  onChange={(e) => {
                    setWebsite(e.target.value)
                    clearFieldError("website")
                  }}
                  className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
                />
              </div>
              {fieldErrors.website && <p className="text-[10px] font-bold text-red-500">{fieldErrors.website}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="location" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Location Headquarters</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="location"
                  name="location"
                  type="text"
                  required
                  placeholder="Bengaluru, Karnataka"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="industry" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Industry Verticals</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="industry"
                  name="industry"
                  type="text"
                  required
                  placeholder="Technology / Internet"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus-visible:ring-[#6B2C91]/30 rounded-xl"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-[#6B2C91] to-pink-600 font-bold text-white shadow-md hover:from-[#5A247A] hover:to-pink-700 mt-4"
          >
            {loading ? "Submitting Registration..." : "Register Company Profile"}
          </Button>
        </form>

        <div className="text-center text-sm font-semibold text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-6">
          Already registered?{" "}
          <Link to="/auth/login" className="text-[#6B2C91] dark:text-pink-400 hover:underline font-bold">
            Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

export default RecruiterRegister
