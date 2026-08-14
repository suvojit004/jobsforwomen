import { useRef, useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Bell,
  CheckCircle,
  Shield,
  ShieldCheck,
  Save,
  Lock,
  Check,
  Camera,
  Loader2,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { RecruiterApi } from "../services/recruiterApi"
import { useAuth } from "@/contexts/AuthContext"
import { isValidPassword, PASSWORD_HELP_TEXT } from "@/utils/validators"

const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2MB, matches backend uploadAvatarMiddleware limit

const settingsSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  role: z.string().min(2, "Job title/role must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  // was length-only (`.min(8)`), so "aaaaaaaa" passed.
  phone: z.string().regex(/^\+?[0-9]{10,14}$/, "Please enter a valid phone number (10-14 digits)."),
  notifyNewApp: z.boolean(),
  notifyInterview: z.boolean(),
  notifyWeeklyDigest: z.boolean(),
})

type SettingsFormValues = z.infer<typeof settingsSchema>

export function Settings() {
  const { user, refreshSession } = useAuth()
  const [successMsg, setSuccessMsg] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Profile photo -- mirrors ProfileHeader.tsx's candidate avatar pattern.
  // Recruiters previously had no way to set one at all (no schema column, no
  // endpoint, no UI); see RecruiterApi.uploadAvatar/deleteAvatar.
  const [avatarUrl, setAvatarUrl] = useState("")
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarDeleting, setAvatarDeleting] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Two-Factor Authentication -- real (TOTP, RFC 6238), optional and
  // self-service. The "Security & Authentication" card previously had
  // nothing here at all besides a disabled "Change Credentials Password"
  // button. See RecruiterApi.start2FAEnrollment/confirm2FAEnrollment/disable2FA.
  const [enrolling, setEnrolling] = useState(false)
  const [enrollSecret, setEnrollSecret] = useState("")
  const [enrollOtpauthUri, setEnrollOtpauthUri] = useState("")
  const [enrollCode, setEnrollCode] = useState("")
  const [enrollSubmitting, setEnrollSubmitting] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [disablePassword, setDisablePassword] = useState("")
  const [disableSubmitting, setDisableSubmitting] = useState(false)

  // Change Credentials Password -- real now. Was a disabled, non-functional
  // "Configure" button with no backend wiring at all (the shared
  // /auth/change-password endpoint already accepts any authenticated user,
  // so nothing needed to change server-side).
  const [changingPassword, setChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      role: "",
      email: "",
      phone: "",
      notifyNewApp: true,
      notifyInterview: true,
      notifyWeeklyDigest: false,
    },
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [dash, setts] = await Promise.all([
          RecruiterApi.getDashboard(),
          RecruiterApi.getSettings(),
        ])

        const profile = dash?.recruiterProfile || {}
        const user = profile?.user || {}

        setAvatarUrl(profile.avatarUrl || "")

        reset({
          name: profile.fullName || "Recruiter",
          role: setts.jobTitle || "Recruiter Manager",
          email: user.email || "",
          phone: profile.phone || "",
          notifyNewApp: !!setts.realTimeNotifications,
          notifyInterview: !!setts.realTimeNotifications,
          notifyWeeklyDigest: setts.emailDigestInterval === "Weekly",
        })
      } catch (err) {
        console.error("Failed to load settings", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [reset])

  const onSubmit = async (data: SettingsFormValues) => {
    try {
      // Previously only the two notification-preference fields were sent
      // here -- name/role/phone were validated and "saved" with a success
      // banner but silently discarded, since the backend endpoint had no
      // fields (or storage) for them at all. Now sent for real; see
      // recruiter.service.ts's updateSettings.
      await RecruiterApi.updateSettings({
        fullName: data.name,
        jobTitle: data.role,
        phone: data.phone,
        realTimeNotifications: data.notifyNewApp,
        emailDigestInterval: data.notifyWeeklyDigest ? "Weekly" : "Daily"
      })
      setSuccessMsg(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
      setTimeout(() => {
        setSuccessMsg(false)
      }, 1500)
    } catch (err: any) {
      console.error("Failed to update settings", err)
      toast.error(err?.message || "Couldn't save account settings. Please try again.")
    }
  }

  const handlePickAvatar = () => {
    if (avatarUploading || avatarDeleting) return
    avatarInputRef.current?.click()
  }

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset the input immediately so selecting the same file again still fires onChange
    e.target.value = ""
    if (!file) return

    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Unsupported file type. Please upload a JPEG, PNG, GIF, or WEBP image.")
      return
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      toast.error("File is too large. Maximum photo size is 2MB.")
      return
    }

    setAvatarUploading(true)
    try {
      const updated = await RecruiterApi.uploadAvatar(file)
      setAvatarUrl(updated?.avatarUrl || "")
      await refreshSession()
      toast.success("Profile photo updated successfully.")
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload profile photo. Please try again.")
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleDeleteAvatar = async () => {
    if (avatarUploading || avatarDeleting) return
    if (!window.confirm("Remove your profile photo?")) return
    setAvatarDeleting(true)
    try {
      await RecruiterApi.deleteAvatar()
      setAvatarUrl("")
      await refreshSession()
      toast.success("Profile photo removed successfully.")
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove profile photo. Please try again.")
    } finally {
      setAvatarDeleting(false)
    }
  }

  const handleStartEnrollment = async () => {
    setEnrollSubmitting(true)
    try {
      const result = await RecruiterApi.start2FAEnrollment()
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
      await RecruiterApi.confirm2FAEnrollment(enrollCode.trim())
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
      await RecruiterApi.disable2FA(disablePassword)
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError("")
    if (!currentPassword || !newPassword) return
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New password and confirmation do not match.")
      return
    }
    if (!isValidPassword(newPassword)) {
      setPasswordError(PASSWORD_HELP_TEXT)
      return
    }
    setPasswordSubmitting(true)
    try {
      await RecruiterApi.changePassword(currentPassword, newPassword)
      setPasswordSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
      setChangingPassword(false)
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to change password. Please check your current password.")
    } finally {
      setPasswordSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading settings...</div>
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Account Settings
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Edit recruiter credentials, notifications logs, and account configurations.
        </p>
      </div>

      {/* Success alert */}
      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl text-xs font-black flex items-center gap-2.5 border border-emerald-100 dark:border-emerald-950/50 select-none animate-fadeIn">
          <CheckCircle className="size-4 shrink-0 stroke-[3]" />
          <span>Account changes saved. Updating workspace elements...</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Recruiter profile settings */}
        <DashboardCard className="p-6 space-y-5">
          <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
            Recruiter Details
          </h3>

          {/* Profile photo -- recruiters previously had no way to set one at
              all. Same hover-to-upload pattern as the candidate profile. */}
          <div className="flex items-center gap-4">
            <div className="group/avatar-upload relative shrink-0">
              <Avatar className="size-16 border-2 border-violet-100 dark:border-slate-800">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={user?.fullName || "Recruiter"} />}
                <AvatarFallback className="bg-gradient-to-br from-pink-100 via-white to-violet-200 text-lg font-bold text-[#6B2C91] dark:from-pink-500/20 dark:via-slate-900 dark:to-violet-500/25 dark:text-pink-100">
                  {(user?.fullName || user?.email || "R").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarSelected}
              />
              <button
                type="button"
                onClick={handlePickAvatar}
                disabled={avatarUploading || avatarDeleting}
                title={avatarUrl ? "Replace photo" : "Upload photo"}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/0 text-white opacity-0 transition-opacity duration-150 hover:bg-slate-950/45 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none disabled:cursor-not-allowed"
              >
                {avatarUploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleDeleteAvatar}
                  disabled={avatarUploading || avatarDeleting}
                  title="Remove photo"
                  className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border-2 border-white bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed dark:border-slate-900"
                >
                  {avatarDeleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                </button>
              )}
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white">Profile Photo</p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">JPEG, PNG, GIF, or WEBP. Max 2MB.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Recruiter Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  {...register("name")}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
                />
              </div>
              {errors.name && <p className="text-[10px] font-bold text-red-500">{errors.name.message}</p>}
            </div>

            {/* Job Title / Role */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Job Title / Role <span className="text-red-500">*</span></label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  {...register("role")}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
                />
              </div>
              {errors.role && <p className="text-[10px] font-bold text-red-500">{errors.role.message}</p>}
            </div>

            {/* Email Address -- read-only: changing a login email requires a
                re-verification flow the backend doesn't implement, so this
                is intentionally disabled rather than silently accepted and
                discarded like the other fields used to be. */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Corporate Email <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  {...register("email")}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-500 cursor-not-allowed focus-visible:outline-none dark:border-slate-850 dark:bg-slate-950 dark:text-slate-400"
                />
              </div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Contact support to change your login email.</p>
            </div>

            {/* Phone Number */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Phone Number <span className="text-red-500">*</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  {...register("phone")}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
                />
              </div>
              {errors.phone && <p className="text-[10px] font-bold text-red-500">{errors.phone.message}</p>}
            </div>
          </div>
        </DashboardCard>

        {/* Notifications Preferences */}
        <DashboardCard className="p-6 space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800 flex items-center gap-1.5">
            <Bell className="size-4 text-[#6B2C91] dark:text-pink-300" />
            Email Notification Preferences
          </h3>

          <div className="space-y-3.5 pt-1">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("notifyNewApp")}
                className="mt-0.5 size-4 accent-[#6B2C91] dark:accent-pink-500"
              />
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">New Candidate Applications</p>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  Receive instant email alerts whenever a woman candidate submits an application to your jobs.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("notifyInterview")}
                className="mt-0.5 size-4 accent-[#6B2C91] dark:accent-pink-500"
              />
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">Interview Confirmations</p>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  Receive alerts when a candidate accepts or requests to reschedule interview slots.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("notifyWeeklyDigest")}
                className="mt-0.5 size-4 accent-[#6B2C91] dark:accent-pink-500"
              />
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">Weekly Diversity Resume Digests</p>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  Receive a consolidated report on candidate break profiles, DEI sourcing progress, and job views.
                </p>
              </div>
            </label>
          </div>
        </DashboardCard>

      </form>

      {/* Security & Authentication -- kept outside the form above since it
          has its own independent submit flows (2FA enroll/disable), and a
          <form> can't be nested inside another <form>. */}
      <DashboardCard className="p-6 space-y-4">
        <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800 flex items-center gap-1.5">
          <Shield className="size-4 text-emerald-500" />
          Security & Authentication
        </h3>

        {/* Change Credentials Password -- real now. See
            RecruiterApi.changePassword / handleChangePassword above. */}
        <div className="border border-slate-100 dark:border-slate-850 rounded-xl p-3.5 space-y-3.5">
          {changingPassword ? (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{PASSWORD_HELP_TEXT}</p>
              {passwordError && <p className="text-[10px] font-bold text-red-500">{passwordError}</p>}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="h-8 text-xs font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white"
                >
                  {passwordSubmitting ? "Updating..." : "Update Password"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setChangingPassword(false)
                    setCurrentPassword("")
                    setNewPassword("")
                    setConfirmNewPassword("")
                    setPasswordError("")
                  }}
                  className="h-8 text-xs font-bold"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-black text-slate-900 dark:text-white">Change Credentials Password</p>
                <p className="text-[10px] text-slate-450 font-semibold leading-normal">
                  Update your account password.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {passwordSuccess && (
                  <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                    <Check className="size-3.5 stroke-[3]" />
                    Updated!
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setChangingPassword(true)}
                  className="h-8 text-[10px] font-bold gap-1"
                >
                  <Lock className="size-3" />
                  Configure
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Two-Factor Authentication -- real (TOTP, RFC 6238), optional and
            self-service. See RecruiterApi.start2FAEnrollment/
            confirm2FAEnrollment/disable2FA. */}
        <div className="border border-slate-100 dark:border-slate-850 rounded-xl p-3.5 space-y-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-slate-900 dark:text-white">Two-Factor Authentication</p>
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
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
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
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 max-w-[70%]">
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
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Scan this with your authenticator app (Google Authenticator, Authy, 1Password, etc.), or enter the
                secret manually, then confirm with the 6-digit code it shows.
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900 space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Manual entry secret</p>
                <p className="text-xs font-mono font-bold text-slate-900 dark:text-white break-all">{enrollSecret}</p>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase pt-1">otpauth URI</p>
                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 break-all">{enrollOtpauthUri}</p>
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
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 max-w-[70%]">
                Add an authenticator app code as an optional second step at login, for extra safety on your account.
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
        </div>
      </DashboardCard>

      {/* Action Panel -- outside the form (moved alongside Security &
          Authentication above), so this button triggers the form's submit
          handler directly instead of relying on being a form-nested
          type="submit". */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className="bg-[#6B2C91] hover:bg-[#5a237b] text-white font-extrabold text-xs h-10 px-5 gap-1.5 cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700"
        >
          <Save className="size-4" />
          {isSubmitting ? "Saving preferences..." : "Save Account Settings"}
        </Button>
      </div>
    </div>
  )
}
export default Settings
