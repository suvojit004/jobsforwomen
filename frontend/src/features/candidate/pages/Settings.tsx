import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  User,
  Paintbrush,
  ShieldCheck,
  Bell,
  EyeOff,
  Sun,
  Moon,
  Upload,
  Check,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { QrCode } from "@/components/shared/QrCode"
import { candidateApi } from "../services/candidateApi"
import { cn } from "@/lib/utils"
import { isValidPhone, isValidPassword, PASSWORD_HELP_TEXT } from "@/utils/validators"
import { useAuth } from "@/contexts/AuthContext"

type TabType = "account" | "appearance" | "security" | "notifications" | "privacy"

export function Settings() {
  const { theme, setTheme } = useTheme()
  const { user, refreshSession } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>("account")

  const [isLoading, setIsLoading] = useState(true)

  // Account states
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [bio, setBio] = useState("")
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Security states
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState("")

  // Two-Factor Authentication -- real now (TOTP, RFC 6238), optional and
  // self-service like the password fields above. Was previously a checkbox
  // that only wrote an unused key into the settings preferences blob; see
  // candidateApi.start2FAEnrollment/confirm2FAEnrollment/disable2FA.
  const [enrolling, setEnrolling] = useState(false)
  const [enrollSecret, setEnrollSecret] = useState("")
  const [enrollOtpauthUri, setEnrollOtpauthUri] = useState("")
  const [enrollCode, setEnrollCode] = useState("")
  const [enrollSubmitting, setEnrollSubmitting] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [disablePassword, setDisablePassword] = useState("")
  const [disableSubmitting, setDisableSubmitting] = useState(false)

  // Notification states
  const [emailNewJobs, setEmailNewJobs] = useState(true)
  const [emailStatusUpdate, setEmailStatusUpdate] = useState(true)
  const [emailInterviews, setEmailInterviews] = useState(true)
  const [emailPlatformNews, setEmailPlatformNews] = useState(false)
  const [dailyDigest, setDailyDigest] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [notifSuccess, setNotifSuccess] = useState(false)

  // Privacy states
  const [profileVisibility, setProfileVisibility] = useState("Public")
  const [indexSearch, setIndexSearch] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deletePassword, setDeletePassword] = useState("")
  const [deleteError, setDeleteError] = useState("")
  const [privacySuccess, setPrivacySuccess] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [prof, setts] = await Promise.all([
          candidateApi.getProfile(),
          candidateApi.getSettings()
        ])
        if (prof) {
          setFullName(prof.fullName || "")
          setEmail(prof.user?.email || "")
          setPhone(prof.phone || "")
          setBio(prof.bio || "")
        }
        if (setts) {
          setEmailNewJobs(!!setts.emailNewJobs)
          setEmailStatusUpdate(!!setts.emailStatusUpdate)
          setEmailInterviews(!!setts.emailInterviews)
          setEmailPlatformNews(!!setts.emailPlatformNews)
          // Both default true server-side (getSettings' defaultPrefs) --
          // `?? true` so an existing candidate whose stored preferences
          // predate these two keys doesn't see them flip to "off" on load.
          setDailyDigest(setts.dailyDigestEnabled ?? true)
          setWeeklyDigest(setts.weeklyDigestEnabled ?? true)
          setProfileVisibility(setts.profileVisibility || "Public")
        }
      } catch (err: any) {
        console.error("Failed to load settings data", err)
        toast.error(err?.message || "Failed to load settings.")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // phone previously had no format validation at all.
    if (phone && !isValidPhone(phone)) {
      toast.error("Please enter a valid phone number (10-14 digits).")
      return
    }
    try {
      await candidateApi.updateProfile({
        fullName,
        phone,
        bio,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      // Previously only logged to the console -- a failed save (e.g. the
      // backend's own phone-format rejection) looked identical to a
      // successful one, since no error ever reached the user.
      console.error("Failed to update profile", err)
      toast.error(err?.message || "Couldn't save your changes. Please try again.")
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError("")
    if (!currentPassword || !newPassword) return
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.")
      return
    }
    // previously no complexity/length check at all client-side --
    // a one-character new password would pass this gate entirely.
    if (!isValidPassword(newPassword)) {
      setPasswordError(PASSWORD_HELP_TEXT)
      return
    }
    try {
      await candidateApi.changePassword(currentPassword, newPassword)
      setPasswordSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to change password. Please check your current password.")
    }
  }

  const handleStartEnrollment = async () => {
    setEnrollSubmitting(true)
    try {
      const result = await candidateApi.start2FAEnrollment()
      setEnrollSecret(result.secret || "")
      setEnrollOtpauthUri(result.otpauthUri || "")
      setEnrolling(true)
    } catch (err: any) {
      console.error("Failed to start 2FA enrollment", err)
      toast.error(err?.message || "Failed to start two-factor enrollment.")
    } finally {
      setEnrollSubmitting(false)
    }
  }

  const handleConfirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(enrollCode.trim())) {
      toast.error("Enter the 6-digit code from your authenticator app.")
      return
    }
    setEnrollSubmitting(true)
    try {
      await candidateApi.confirm2FAEnrollment(enrollCode.trim())
      toast.success("Two-factor authentication enabled.")
      setEnrolling(false)
      setEnrollSecret("")
      setEnrollOtpauthUri("")
      setEnrollCode("")
      await refreshSession()
    } catch (err: any) {
      console.error("Failed to confirm 2FA enrollment", err)
      toast.error(err?.message || "Invalid code. Please try again.")
    } finally {
      setEnrollSubmitting(false)
    }
  }

  const handleCancelEnrollment = () => {
    setEnrolling(false)
    setEnrollSecret("")
    setEnrollOtpauthUri("")
    setEnrollCode("")
  }

  const handleConfirmDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!disablePassword) {
      toast.error("Enter your current password.")
      return
    }
    setDisableSubmitting(true)
    try {
      await candidateApi.disable2FA(disablePassword)
      toast.success("Two-factor authentication disabled.")
      setDisabling(false)
      setDisablePassword("")
      await refreshSession()
    } catch (err: any) {
      console.error("Failed to disable 2FA", err)
      toast.error(err?.message || "Failed to disable two-factor authentication.")
    } finally {
      setDisableSubmitting(false)
    }
  }

  const handlePrivacySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await candidateApi.updateSettings({ profileVisibility })
      setPrivacySuccess(true)
      setTimeout(() => setPrivacySuccess(false), 3000)
    } catch (err: any) {
      console.error("Failed to update privacy settings", err)
      toast.error(err?.message || "Failed to update privacy settings.")
    }
  }

  const handleNotificationsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await candidateApi.updateSettings({
        emailNewJobs,
        emailStatusUpdate,
        emailInterviews,
        emailPlatformNews,
        dailyDigestEnabled: dailyDigest,
        weeklyDigestEnabled: weeklyDigest,
      })
      setNotifSuccess(true)
      setTimeout(() => setNotifSuccess(false), 3000)
    } catch (err: any) {
      console.error("Failed to update settings", err)
      toast.error(err?.message || "Failed to update settings.")
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== "delete" || !deletePassword) return
    setDeleteError("")
    try {
      await candidateApi.deleteAccount(deletePassword)
      localStorage.removeItem("jwt_token")
      localStorage.removeItem("userRole")
      window.location.href = "/auth/login"
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete account. Please check your password.")
    }
  }

  const tabs = [
    { id: "account", label: "Account", icon: User },
    { id: "appearance", label: "Appearance", icon: Paintbrush },
    { id: "security", label: "Security", icon: ShieldCheck },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy", icon: EyeOff },
  ] as const

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading settings...</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Manage your account preferences, themes, security levels, and privacy visibility.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Left Side Navigation (Tabs) */}
        <div className="md:col-span-3 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible bg-slate-50 p-1 md:p-1.5 rounded-xl gap-1 shrink-0 dark:bg-slate-950/40 select-none scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap md:w-full",
                  isActive
                    ? "bg-[#6B2C91] text-white shadow-sm dark:bg-pink-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/60 dark:hover:text-white"
                )}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Right Side Content Panel */}
        <div className="md:col-span-9">
          {/* Account Settings */}
          {activeTab === "account" && (
            <DashboardCard className="p-5">
              <h2 className="text-sm font-extrabold text-slate-950 dark:text-white mb-4">
                Personal Information
              </h2>
              <form onSubmit={handleAccountSubmit} className="space-y-4">
                {/* Photo trigger */}
                <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="size-16 rounded-full bg-gradient-to-br from-pink-100 to-violet-200 text-[#6B2C91] dark:from-pink-500/20 dark:to-violet-500/25 dark:text-pink-100 flex items-center justify-center font-black text-xl select-none">
                    {fullName
                      ? fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                      : "JW"}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Profile picture</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-bold gap-1.5"
                      disabled
                      title="Profile photo upload isn't available yet"
                    >
                      <Upload className="size-3.5" />
                      Upload Photo (Coming Soon)
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Full Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      title="Contact support to change your account email"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                    />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Contact support to change your account email.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                    {phone && !isValidPhone(phone) && (
                      <p className="text-[10px] font-bold text-red-500">Please enter a valid phone number (10-14 digits).</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Profile Bio</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    className="bg-[#6B2C91] text-white hover:bg-[#5a237b] h-9 px-6 font-extrabold text-xs dark:bg-pink-600 dark:hover:bg-pink-700"
                  >
                    Save Changes
                  </Button>
                  {saveSuccess && (
                    <span className="text-xs text-emerald-600 font-extrabold flex items-center gap-1">
                      <Check className="size-4 stroke-[3]" />
                      Changes saved!
                    </span>
                  )}
                </div>
              </form>
            </DashboardCard>
          )}

          {/* Appearance Settings */}
          {activeTab === "appearance" && (
            <DashboardCard className="p-5 space-y-4">
              <div>
                <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
                  Visual Theme
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select your interface theme for reading job posts and charts.
                </p>
              </div>

              {/* Large Theme Switching Cards */}
              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                {/* Light mode select */}
                <div
                  onClick={() => setTheme("light")}
                  className={cn(
                    "cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-3 select-none transition-all hover:shadow-md",
                    theme === "light"
                      ? "border-[#6B2C91] bg-violet-50/10 text-[#6B2C91]"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-850 dark:bg-slate-900"
                  )}
                >
                  <Sun className="size-8" />
                  <div className="text-center">
                    <p className="text-xs font-black">Light Theme</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Classic bright mode</p>
                  </div>
                </div>

                {/* Dark mode select */}
                <div
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-3 select-none transition-all hover:shadow-md",
                    theme === "dark"
                      ? "border-pink-500 bg-pink-500/5 text-pink-300"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-850 dark:bg-slate-900"
                  )}
                >
                  <Moon className="size-8" />
                  <div className="text-center">
                    <p className="text-xs font-black">Dark Theme</p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Sleek midnight look</p>
                  </div>
                </div>
              </div>
            </DashboardCard>
          )}

          {/* Security Settings */}
          {activeTab === "security" && (
            <div className="space-y-5">
              <DashboardCard className="p-5">
                <h2 className="text-sm font-extrabold text-slate-950 dark:text-white mb-4">
                  Password
                </h2>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Current Password <span className="text-red-500">*</span></label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">New Password <span className="text-red-500">*</span></label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                      />
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{PASSWORD_HELP_TEXT}</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Confirm Password <span className="text-red-500">*</span></label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      type="submit"
                      className="bg-[#6B2C91] text-white hover:bg-[#5a237b] h-9 px-6 font-extrabold text-xs dark:bg-pink-600 dark:hover:bg-pink-700"
                    >
                      Update Password
                    </Button>
                    {passwordSuccess && (
                      <span className="text-xs text-emerald-600 font-extrabold flex items-center gap-1">
                        <Check className="size-4 stroke-[3]" />
                        Password updated!
                      </span>
                    )}
                    {passwordError && (
                      <span className="text-xs text-red-600 font-extrabold">
                        {passwordError}
                      </span>
                    )}
                  </div>
                </form>
              </DashboardCard>

              {/* Two-Factor Authentication -- real (TOTP, RFC 6238), optional
                  and self-service. See candidateApi.start2FAEnrollment/
                  confirm2FAEnrollment/disable2FA. */}
              <DashboardCard className="p-5 space-y-4">
                <div className="border-b border-slate-100 pb-3 dark:border-slate-800 flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
                    Two-Factor Authentication
                  </h2>
                  {user?.twoFactorEnabled && !disabling && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="size-3.5" />
                      Enabled
                    </span>
                  )}
                </div>

                {user?.twoFactorEnabled ? (
                  disabling ? (
                    <form onSubmit={handleConfirmDisable} className="space-y-3">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Enter your current password to disable two-factor authentication.
                      </p>
                      <input
                        type="password"
                        placeholder="Current password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          disabled={disableSubmitting}
                          className="h-8 text-xs font-black bg-red-600 hover:bg-red-700 text-white"
                        >
                          {disableSubmitting ? "Disabling..." : "Confirm Disable"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setDisabling(false)
                            setDisablePassword("")
                          }}
                          className="h-8 text-xs font-bold"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 max-w-[70%]">
                        Your account is protected by an authenticator app code at every login.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDisabling(true)}
                        className="h-8 text-xs font-bold border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400"
                      >
                        Disable
                      </Button>
                    </div>
                  )
                ) : enrolling ? (
                  <form onSubmit={handleConfirmEnrollment} className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Scan this with your authenticator app (Google Authenticator, Authy, 1Password, etc.), or enter
                      the secret manually, then confirm with the 6-digit code it shows.
                    </p>
                    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                      <QrCode value={enrollOtpauthUri} size={160} />
                      <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900 space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Manual entry secret</p>
                        <p className="text-xs font-mono font-bold text-slate-900 dark:text-white break-all">{enrollSecret}</p>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase pt-1">otpauth URI</p>
                        <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 break-all">{enrollOtpauthUri}</p>
                      </div>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={enrollCode}
                      onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold tracking-[0.4em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={enrollSubmitting}
                        className="h-8 text-xs font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white"
                      >
                        {enrollSubmitting ? "Confirming..." : "Confirm & Enable"}
                      </Button>
                      <Button type="button" variant="outline" onClick={handleCancelEnrollment} className="h-8 text-xs font-bold">
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 max-w-[70%]">
                      Add an authenticator app code as an optional second step at login, for extra safety on your
                      account.
                    </p>
                    <Button
                      type="button"
                      onClick={handleStartEnrollment}
                      disabled={enrollSubmitting}
                      className="h-8 text-xs font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white"
                    >
                      {enrollSubmitting ? "Starting..." : "Enable 2FA"}
                    </Button>
                  </div>
                )}
              </DashboardCard>
            </div>
          )}

          {/* Notifications Settings */}
          {activeTab === "notifications" && (
            <DashboardCard className="p-5">
              <h2 className="text-sm font-extrabold text-slate-950 dark:text-white mb-4">
                Email Notification Preferences
              </h2>
              <form onSubmit={handleNotificationsSubmit} className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">New Job Opportunities</p>
                      <p className="text-[11px] text-slate-500">Get alerts when positions matching your skills are uploaded.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailNewJobs}
                      onChange={(e) => setEmailNewJobs(e.target.checked)}
                      className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Application Updates</p>
                      <p className="text-[11px] text-slate-500">Receive alerts when recruiters review your applications or change status.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailStatusUpdate}
                      onChange={(e) => setEmailStatusUpdate(e.target.checked)}
                      className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Interview Schedules</p>
                      <p className="text-[11px] text-slate-500">Receive interview invites and reminders for incoming calls.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailInterviews}
                      onChange={(e) => setEmailInterviews(e.target.checked)}
                      className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Platform Updates & News</p>
                      <p className="text-[11px] text-slate-500">Keep updated with platform releases and resume tips.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailPlatformNews}
                      onChange={(e) => setEmailPlatformNews(e.target.checked)}
                      className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Daily Job Digest</p>
                      <p className="text-[11px] text-slate-500">A daily email summarizing jobs posted in the last 24 hours.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={dailyDigest}
                      onChange={(e) => setDailyDigest(e.target.checked)}
                      className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Weekly Job Digest</p>
                      <p className="text-[11px] text-slate-500">A weekly roundup email every Friday of jobs posted that week.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={weeklyDigest}
                      onChange={(e) => setWeeklyDigest(e.target.checked)}
                      className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="submit"
                    className="bg-[#6B2C91] text-white hover:bg-[#5a237b] h-9 px-6 font-extrabold text-xs dark:bg-pink-600 dark:hover:bg-pink-700"
                  >
                    Save Preferences
                  </Button>
                  {notifSuccess && (
                    <span className="text-xs text-emerald-600 font-extrabold flex items-center gap-1">
                      <Check className="size-4 stroke-[3]" />
                      Preferences saved!
                    </span>
                  )}
                </div>
              </form>
            </DashboardCard>
          )}

          {/* Privacy Settings */}
          {activeTab === "privacy" && (
            <div className="space-y-5">
              <DashboardCard className="p-5 space-y-4">
                <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
                  Privacy Settings
                </h2>

                <form onSubmit={handlePrivacySubmit} className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Profile Visibility</p>
                      <p className="text-[11px] text-slate-500">Control who can discover and view your experience credentials.</p>
                    </div>
                    <select
                      value={profileVisibility}
                      onChange={(e) => setProfileVisibility(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white font-bold"
                    >
                      <option value="Public">Visible to All Employers</option>
                      <option value="RecruitersOnly">Only Recruiters I've Applied To</option>
                      <option value="Private">Hidden (Private)</option>
                    </select>
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800" />

                  <div className="flex items-center justify-between opacity-60">
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        Search Engine Indexing <span className="font-semibold text-slate-400">(Coming Soon)</span>
                      </p>
                      <p className="text-[11px] text-slate-500">Allow search engine crawlers (Google, Bing) to index your profile.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={indexSearch}
                      disabled
                      title="Not available yet"
                      onChange={(e) => setIndexSearch(e.target.checked)}
                      className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950 cursor-not-allowed"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      type="submit"
                      className="bg-[#6B2C91] text-white hover:bg-[#5a237b] h-9 px-6 font-extrabold text-xs dark:bg-pink-600 dark:hover:bg-pink-700"
                    >
                      Save Privacy Settings
                    </Button>
                    {privacySuccess && (
                      <span className="text-xs text-emerald-600 font-extrabold flex items-center gap-1">
                        <Check className="size-4 stroke-[3]" />
                        Preferences saved!
                      </span>
                    )}
                  </div>
                </form>
              </DashboardCard>

              {/* Danger Zone: Delete Account */}
              <DashboardCard className="p-5 border-red-200 bg-red-50/10 dark:border-red-900/35 dark:bg-red-950/5">
                <h2 className="text-sm font-extrabold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="size-4.5" />
                  Danger Zone
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  Deleting your candidate account will purge all applied history, saved bookmark listings, and resume file attachments permanently.
                </p>

                {showDeleteConfirm ? (
                  <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 space-y-3 dark:bg-red-950/20 dark:border-red-900/30">
                    <p className="text-xs font-bold text-red-700 dark:text-red-300">
                      Type <span className="underline select-all">delete</span> below to confirm permanent purging:
                    </p>
                    <input
                      type="text"
                      placeholder="Type delete"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full max-w-xs rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 dark:border-red-900/40 dark:bg-slate-950 dark:text-white font-extrabold"
                    />
                    <input
                      type="password"
                      placeholder="Enter your current password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="w-full max-w-xs rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 dark:border-red-900/40 dark:bg-slate-950 dark:text-white font-extrabold"
                    />
                    {deleteError && (
                      <p className="text-xs font-bold text-red-700 dark:text-red-300">{deleteError}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deleteConfirmText.toLowerCase() !== "delete" || !deletePassword}
                        onClick={handleDeleteAccount}
                        className="h-8 text-xs font-extrabold px-4"
                      >
                        Yes, Delete Permanently
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowDeleteConfirm(false)
                          setDeleteConfirmText("")
                          setDeletePassword("")
                          setDeleteError("")
                        }}
                        className="h-8 text-xs font-bold border-slate-350"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="h-9 font-extrabold text-xs px-5"
                    >
                      Delete Account
                    </Button>
                  </div>
                )}
              </DashboardCard>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
