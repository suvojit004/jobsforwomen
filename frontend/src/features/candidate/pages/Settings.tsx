import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"
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
import { candidateApi } from "../services/candidateApi"
import { cn } from "@/lib/utils"

type TabType = "account" | "appearance" | "security" | "notifications" | "privacy"

export function Settings() {
  const { theme, setTheme } = useTheme()
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
  const [twoFactor, setTwoFactor] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Notification states
  const [emailNewJobs, setEmailNewJobs] = useState(true)
  const [emailStatusUpdate, setEmailStatusUpdate] = useState(true)
  const [emailInterviews, setEmailInterviews] = useState(true)
  const [emailPlatformNews, setEmailPlatformNews] = useState(false)
  const [notifSuccess, setNotifSuccess] = useState(false)

  // Privacy states
  const [profileVisibility, setProfileVisibility] = useState("public")
  const [indexSearch, setIndexSearch] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

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
          setTwoFactor(!!setts.twoFactorEnabled)
        }
      } catch (err) {
        console.error("Failed to load settings data", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await candidateApi.updateProfile({
        fullName,
        phone,
        bio,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error("Failed to update profile", err)
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) return
    setPasswordSuccess(true)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setTimeout(() => setPasswordSuccess(false), 3000)
  }

  const handleNotificationsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await candidateApi.updateSettings({
        emailNewJobs,
        emailStatusUpdate,
        emailInterviews,
        emailPlatformNews,
        twoFactorEnabled: twoFactor,
      })
      setNotifSuccess(true)
      setTimeout(() => setNotifSuccess(false), 3000)
    } catch (err) {
      console.error("Failed to update settings", err)
    }
  }

  const handleDeleteAccount = () => {
    if (deleteConfirmText.toLowerCase() === "delete") {
      alert("Account deletion simulated successfully.")
      setShowDeleteConfirm(false)
      setDeleteConfirmText("")
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
                    PS
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Profile picture</p>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs font-bold gap-1.5">
                      <Upload className="size-3.5" />
                      Upload Photo
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Full Name</label>
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
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
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
            <DashboardCard className="p-5">
              <h2 className="text-sm font-extrabold text-slate-950 dark:text-white mb-4">
                Security & Authentication
              </h2>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-y border-slate-100 dark:border-slate-800">
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold text-slate-855 dark:text-slate-200">Two-Factor Authentication (2FA)</p>
                    <p className="text-[11px] text-slate-500">Provide an SMS or app verification token when logging in.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={twoFactor}
                    onChange={(e) => setTwoFactor(e.target.checked)}
                    className="rounded border-slate-350 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950 shrink-0 cursor-pointer"
                  />
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
                </div>
              </form>
            </DashboardCard>
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

                <div className="space-y-4">
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
                      <option value="public">Visible to All Employers</option>
                      <option value="applied-only">Only Applied Companies</option>
                      <option value="private">Hidden (Private)</option>
                    </select>
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800" />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Search Engine Indexing</p>
                      <p className="text-[11px] text-slate-500">Allow search engine crawlers (Google, Bing) to index your profile.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={indexSearch}
                      onChange={(e) => setIndexSearch(e.target.checked)}
                      className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950 cursor-pointer"
                    />
                  </div>
                </div>
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
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deleteConfirmText.toLowerCase() !== "delete"}
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
