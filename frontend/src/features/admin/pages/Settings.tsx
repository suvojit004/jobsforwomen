import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Settings as SettingsIcon, ShieldAlert, Save, AlertCircle } from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import { AdminApi } from "../services/adminApi"

const adminSettingsSchema = z
  .object({
    name: z.string().min(3, "Name must be at least 3 characters."),
    email: z.string().email("Please provide a valid administrative email address."),
    currentPassword: z.string().min(1, "Current password is required to verify changes."),
    newPassword: z.string().optional().or(z.literal("")),
    confirmNewPassword: z.string().optional().or(z.literal("")),
    sessionTimeout: z.enum(["15m", "30m", "1h", "4h"]),
    twoFactorEnabled: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.newPassword && data.newPassword.length > 0) {
        return data.newPassword.length >= 6
      }
      return true
    },
    {
      message: "New password must be at least 6 characters.",
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

export function Settings() {
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [submitError, setSubmitError] = useState("")

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
      sessionTimeout: "30m",
      twoFactorEnabled: true,
    },
  })

  useEffect(() => {
    async function loadSettings() {
      try {
        const setts = await AdminApi.getSettings()
        reset({
          name: setts.name || "SysAdmin Control",
          email: setts.email || "admin@jobsforwomen.info",
          currentPassword: "",
          newPassword: "",
          confirmNewPassword: "",
          sessionTimeout: setts.sessionTimeout || "30m",
          twoFactorEnabled: !!setts.twoFactorEnabled,
        })
      } catch (err) {
        console.error("Failed to load settings", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [reset])

  const onSubmit = async (values: AdminSettingsValues) => {
    setSaving(true)
    setSubmitError("")
    try {
      if (values.newPassword && values.newPassword.length > 0) {
        await AdminApi.changePassword(values.currentPassword, values.newPassword)
      }
      await AdminApi.updateSettings({
        name: values.name,
        email: values.email,
        sessionTimeout: values.sessionTimeout,
        twoFactorEnabled: values.twoFactorEnabled,
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
          Configure security protocols, credential authentication, Session timeout limits, and administrator profiles.
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
                    Administrator Name
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

                {/* Admin email */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Administrative Email
                  </label>
                  <input
                    type="email"
                    {...register("email")}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold"
                  />
                  {errors.email && (
                    <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                      <AlertCircle className="size-3 shrink-0" />
                      {errors.email.message}
                    </p>
                  )}
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
                      Current Password *
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
                      placeholder="Min 6 chars"
                      {...register("newPassword")}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    />
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

            {/* Session Timeout */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                Inactivity Session Timeout
              </label>
              <select
                {...register("sessionTimeout")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-bold"
              >
                <option value="15m">15 Minutes</option>
                <option value="30m">30 Minutes</option>
                <option value="1h">1 Hour</option>
                <option value="4h">4 Hours</option>
              </select>
            </div>

            {/* 2FA Toggle */}
            <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-850">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Force Two-Factor (2FA)</p>
                <p className="text-[10px] text-slate-450 dark:text-slate-500 leading-normal max-w-[200px]">
                  Enforces secondary verification checks on admin operations logins.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register("twoFactorEnabled")}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-750 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-[#6B2C91] dark:peer-checked:bg-pink-650"></div>
              </label>
            </div>
          </div>

          <div className="p-3.5 border border-amber-200/40 rounded-xl bg-amber-50/20 dark:border-amber-900/10 dark:bg-amber-955/5 flex gap-2">
            <ShieldAlert className="size-4 text-amber-500 shrink-0 mt-0.5" />
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
