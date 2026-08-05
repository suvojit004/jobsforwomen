import { useState, useEffect, type ChangeEvent } from "react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Settings as SettingsIcon, ShieldAlert, Save, AlertCircle, Lock } from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import { AdminApi } from "../services/adminApi"
import { isValidPassword, PASSWORD_HELP_TEXT } from "@/utils/validators"
import { useAuth } from "@/contexts/AuthContext"

// `twoFactorEnabled` is intentionally not a form field: there's no OTP/MFA
// step anywhere in the login flow, so it's honestly disabled in the UI
// rather than saving a value that has no runtime effect. Inactivity Session
// Timeout, below, USED to be in the same boat -- it's now real, enforced by
// sessionTimeout.middleware.ts on every admin-tier request. See
// TIMEOUT_OPTIONS/handleTimeoutChange further down.
// `email` is read-only display-only: no role on the platform (candidate,
// recruiter, or admin) has any self-service way to change their real login
// User.email, so this field is never submitted and isn't validated as an
// editable value -- see AdminApi.updateSettings / AdminService.updateAdminSettings.
const adminSettingsSchema = z
  .object({
    name: z.string().min(3, "Name must be at least 3 characters."),
    email: z.string().optional(),
    currentPassword: z.string().min(1, "Current password is required to verify changes."),
    newPassword: z.string().optional().or(z.literal("")),
    confirmNewPassword: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      // standardized to the same 8-char + letter/number complexity
      // rule used by every other password field in the app (this was the
      // one outlier at `.min(6)` with no complexity requirement, letting
      // admins set weaker passwords than candidates/recruiters).
      if (data.newPassword && data.newPassword.length > 0) {
        return isValidPassword(data.newPassword)
      }
      return true
    },
    {
      message: PASSWORD_HELP_TEXT,
      path: ["newPassword"],
    }
  )
  .refine(
    (data) => {
      if (data.newPassword && data.newPassword.length > 0) {
        return data.newPassword === data.confirmNewPassword
      }
      return true
    },
    {
      message: "Passwords do not match.",
      path: ["confirmNewPassword"],
    }
  )

type AdminSettingsValues = z.infer<typeof adminSettingsSchema>

// Platform-wide policy (SecurityPolicy singleton row) -- "off" means
// enforcement is disabled (null on the backend). See
// AdminService.getSecuritySettings/updateSecuritySettings and
// sessionTimeout.middleware.ts.
const TIMEOUT_OPTIONS: { value: string; label: string; minutes: number | null }[] = [
  { value: "off", label: "Never (disabled)", minutes: null },
  { value: "15", label: "15 Minutes", minutes: 15 },
  { value: "30", label: "30 Minutes", minutes: 30 },
  { value: "60", label: "1 Hour", minutes: 60 },
  { value: "120", label: "2 Hours", minutes: 120 },
]

export function Settings() {
  const { user } = useAuth()
  const isSuperAdmin = !!user?.roles?.includes("Super Admin")

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [submitError, setSubmitError] = useState("")

  const [timeoutValue, setTimeoutValue] = useState("off")
  const [timeoutLoading, setTimeoutLoading] = useState(true)
  const [timeoutSaving, setTimeoutSaving] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AdminSettingsValues>({
    resolver: zodResolver(adminSettingsSchema),
    defaultValues: {
      name: "",
      email: "",
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  })

  useEffect(() => {
    async function loadSettings() {
      try {
        const setts = await AdminApi.getSettings()
        reset({
          name: setts.name || "",
          email: setts.email || "",
          currentPassword: "",
          newPassword: "",
          confirmNewPassword: "",
        })
      } catch (err: any) {
        console.error("Failed to load settings", err)
        toast.error(err?.message || "Failed to load settings.")
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [reset])

  useEffect(() => {
    async function loadSecuritySettings() {
      try {
        const sec = await AdminApi.getSecuritySettings()
        const minutes = sec.adminSessionTimeoutMinutes ?? null
        const match = TIMEOUT_OPTIONS.find((o) => o.minutes === minutes)
        setTimeoutValue(match ? match.value : "off")
      } catch (err: any) {
        console.error("Failed to load security settings", err)
      } finally {
        setTimeoutLoading(false)
      }
    }
    loadSecuritySettings()
  }, [])

  const handleTimeoutChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = e.target.value
    const previousValue = timeoutValue
    setTimeoutValue(nextValue)
    setTimeoutSaving(true)
    try {
      const opt = TIMEOUT_OPTIONS.find((o) => o.value === nextValue)
      await AdminApi.updateSecuritySettings(opt ? opt.minutes : null)
      toast.success("Inactivity session timeout updated.")
    } catch (err: any) {
      console.error("Failed to update security settings", err)
      toast.error(err?.message || "Failed to update session timeout.")
      setTimeoutValue(previousValue)
    } finally {
      setTimeoutSaving(false)
    }
  }

  const onSubmit = async (values: AdminSettingsValues) => {
    setSaving(true)
    setSubmitError("")
    try {
      if (values.newPassword && values.newPassword.length > 0) {
        await AdminApi.changePassword(values.currentPassword, values.newPassword)
      }
      await AdminApi.updateSettings({
        name: values.name,
      })
      setSuccess(true)
      reset({
        ...values,
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      })
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error("Failed to update settings:", err)
      setSubmitError(err?.message || "Failed to save changes. Please check your current password and try again.")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading settings...</div>
  }

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
          <SettingsIcon className="size-6 text-[#6B2C91] dark:text-pink-300" />
          Administrative Settings
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Update your administrator name and password. Administrative email is read-only. Inactivity Session Timeout
          is enforced platform-wide. 2FA below is shown for visibility but is not yet backed by real enforcement --
          see the control for details.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Core Settings Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)}>
            <DashboardCard className="p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white">
                  Administrator Profile Details
                </h3>
              </div>

              {success && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1.5 dark:bg-emerald-950/35 dark:text-emerald-300">
                  <CheckIcon className="size-4 shrink-0" />
                  Profile and security preferences successfully updated!
                </div>
              )}

              {submitError && (
                <div className="p-3 bg-red-50 text-red-800 rounded-lg text-xs font-bold flex items-center gap-1.5 dark:bg-red-950/35 dark:text-red-300">
                  <AlertCircle className="size-4 shrink-0" />
                  {submitError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Admin name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Administrator Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register("name")}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold"
                  />
                  {errors.name && (
                    <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                      <AlertCircle className="size-3 shrink-0" />
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Admin email -- read-only. No role on the platform
                    (candidate, recruiter, or admin) has any self-service way
                    to change their real login email, so this isn't an
                    editable field here either; it's shown for reference only. */}
                <div className="space-y-1.5 opacity-70">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Lock className="size-3" />
                    Administrative Email
                  </label>
                  <input
                    type="email"
                    disabled
                    {...register("email")}
                    title="Not editable -- there is no self-service email change anywhere on the platform. Contact a Super Admin to change this."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs cursor-not-allowed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500 font-bold"
                  />
                  <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                    Not editable -- login email can't be self-service changed by any role on the platform.
                  </p>
                </div>
              </div>

              {/* Password update segment */}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-850 space-y-4">
                <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Update System Access Password
                </h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Current Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      {...register("currentPassword")}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    />
                    {errors.currentPassword && (
                      <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                        <AlertCircle className="size-3 shrink-0" />
                        {errors.currentPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      New Password
                    </label>
                    <input
                      type="password"
                      placeholder="Min 8 chars"
                      {...register("newPassword")}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{PASSWORD_HELP_TEXT}</p>
                    {errors.newPassword && (
                      <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                        <AlertCircle className="size-3 shrink-0" />
                        {errors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      placeholder="Re-type password"
                      {...register("confirmNewPassword")}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    />
                    {errors.confirmNewPassword && (
                      <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                        <AlertCircle className="size-3 shrink-0" />
                        {errors.confirmNewPassword.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Form trigger buttons */}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-850 flex justify-end gap-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-9 text-xs font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700 flex items-center gap-1"
                >
                  <Save className="size-3.5" />
                  {saving ? "Saving Changes..." : "Save Admin Profile"}
                </Button>
              </div>
            </DashboardCard>
          </form>
        </div>

        {/* Security Preferences Card */}
        <DashboardCard className="p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white">
                Platform Security Policies
              </h3>
            </div>

            {/* Inactivity Session Timeout -- really enforced now (see
                sessionTimeout.middleware.ts, applied to every admin-tier
                request). This is a platform-wide policy (SecurityPolicy
                singleton row), not a per-admin preference, so only a Super
                Admin can change it -- same gating as Feature Flags. */}
            <div className={"space-y-1.5" + (isSuperAdmin ? "" : " opacity-70")}>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Lock className="size-3" />
                Inactivity Session Timeout
              </label>
              <select
                value={timeoutValue}
                disabled={!isSuperAdmin || timeoutLoading || timeoutSaving}
                onChange={handleTimeoutChange}
                title={
                  isSuperAdmin
                    ? "Force-expires admin-tier sessions after this much inactivity, platform-wide."
                    : "Platform-wide policy -- only a Super Admin can change this."
                }
                className={
                  "w-full rounded-lg border px-3 py-2 text-xs font-bold dark:text-white " +
                  (isSuperAdmin
                    ? "border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950"
                    : "border-slate-200 bg-slate-50 cursor-not-allowed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500")
                }
              >
                {TIMEOUT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                {isSuperAdmin
                  ? "Applies platform-wide to Admin/Super Admin/Moderator/Support Executive sessions."
                  : "Platform-wide policy -- only a Super Admin can change this."}
              </p>
            </div>

            {/* 2FA Toggle -- honestly disabled. No OTP/MFA challenge exists
                anywhere in the login flow (same reality as the mfa_enforced
                feature flag). */}
            <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-850 opacity-70">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Lock className="size-3" />
                  Force Two-Factor (2FA)
                </p>
                <p className="text-[10px] text-slate-450 dark:text-slate-500 leading-normal max-w-[200px]">
                  Not implemented -- there is no MFA challenge step in the login flow yet. This control has no runtime effect.
                </p>
              </div>
              <div
                className="relative inline-flex items-center cursor-not-allowed"
                title="Not implemented -- no MFA challenge exists in the login flow"
              >
                <div className="w-9 h-5 bg-slate-150 rounded-full dark:bg-slate-800 border border-slate-200 dark:border-slate-700 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-350 dark:after:bg-slate-600 after:rounded-full after:h-4 after:w-4" />
              </div>
            </div>
          </div>

          <div className="p-3.5 border border-teal-200/40 rounded-xl bg-teal-50/20 dark:border-teal-900/10 dark:bg-teal-950/5 flex gap-2">
            <ShieldAlert className="size-4 text-teal-500 shrink-0 mt-0.5" />
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">
              Admin sessions are tracked by IP audit registries. Suspicious access patterns trigger instant lockouts.
            </p>
          </div>
        </DashboardCard>
      </div>
    </div>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

export default Settings
