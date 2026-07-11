import { useState, useEffect } from "react"
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
  Save,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { RecruiterApi } from "../services/recruiterApi"

const settingsSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  role: z.string().min(2, "Job title/role must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  phone: z.string().min(8, "Phone number must be at least 8 digits."),
  notifyNewApp: z.boolean(),
  notifyInterview: z.boolean(),
  notifyWeeklyDigest: z.boolean(),
})

type SettingsFormValues = z.infer<typeof settingsSchema>

export function Settings() {
  const [successMsg, setSuccessMsg] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

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

        reset({
          name: profile.fullName || "Recruiter",
          role: "Recruiter Manager",
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
      await RecruiterApi.updateSettings({
        realTimeNotifications: data.notifyNewApp,
        emailDigestInterval: data.notifyWeeklyDigest ? "Weekly" : "Daily"
      })
      setSuccessMsg(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
      setTimeout(() => {
        setSuccessMsg(false)
      }, 1500)
    } catch (err) {
      console.error("Failed to update settings", err)
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

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Recruiter Name</label>
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
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Job Title / Role</label>
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

            {/* Email Address */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Corporate Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  {...register("email")}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
                />
              </div>
              {errors.email && <p className="text-[10px] font-bold text-red-500">{errors.email.message}</p>}
            </div>

            {/* Phone Number */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Phone Number</label>
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

        {/* Security / Admin settings Mock */}
        <DashboardCard className="p-6 space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800 flex items-center gap-1.5">
            <Shield className="size-4 text-emerald-500" />
            Security & Authentication
          </h3>

          <div className="flex items-center justify-between py-1.5 border border-slate-100 dark:border-slate-850 p-3.5 rounded-xl">
            <div className="space-y-0.5">
              <p className="text-xs font-black text-slate-900 dark:text-white">Change Credentials Password</p>
              <p className="text-[10px] text-slate-450 font-semibold leading-normal">
                Update account passwords. Last modified: 3 weeks ago.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled
              className="h-8 text-[10px] font-bold gap-1 pointer-events-none"
            >
              <Lock className="size-3" />
              Configure
            </Button>
          </div>
        </DashboardCard>

        {/* Action Panel */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#6B2C91] hover:bg-[#5a237b] text-white font-extrabold text-xs h-10 px-5 gap-1.5 cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700"
          >
            <Save className="size-4" />
            {isSubmitting ? "Saving preferences..." : "Save Account Settings"}
          </Button>
        </div>
      </form>
    </div>
  )
}
export default Settings
