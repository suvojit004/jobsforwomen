import { useState } from "react"
import { Shield, ShieldCheck, Save, RefreshCw } from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"

interface PermissionRow {
  key: string
  name: string
  desc: string
  candidate: boolean
  recruiter: boolean
  admin: boolean
}

export function RolesPermissions() {
  const [saving, setSaving] = useState(false)
  const [matrix, setMatrix] = useState<PermissionRow[]>([
    {
      key: "edit_profile",
      name: "Edit Own Profile",
      desc: "Allows updating bio details, resume files, profile settings and credentials.",
      candidate: true,
      recruiter: true,
      admin: true,
    },
    {
      key: "apply_jobs",
      name: "Apply to Jobs",
      desc: "Allows viewing job listings and submitting applications.",
      candidate: true,
      recruiter: false,
      admin: false,
    },
    {
      key: "post_jobs",
      name: "Post Opportunities",
      desc: "Allows recruiting officers to publish new job listings and manage applicants.",
      candidate: false,
      recruiter: true,
      admin: true,
    },
    {
      key: "moderate_posts",
      name: "Moderate Flagged Listings",
      desc: "Allows editing, hiding, or deleting job listings flagged as non-compliant.",
      candidate: false,
      recruiter: false,
      admin: true,
    },
    {
      key: "verify_companies",
      name: "Verify Partner Badges",
      desc: "Allows approving claims for Menstrual Leave Champion and Returnship Partner status.",
      candidate: false,
      recruiter: false,
      admin: true,
    },
    {
      key: "edit_features",
      name: "Configure Feature Flags",
      desc: "Allows enabling/disabling app features globally (e.g. Chat, WebSockets).",
      candidate: false,
      recruiter: false,
      admin: true,
    },
    {
      key: "suspend_users",
      name: "Suspend User Accounts",
      desc: "Allows blocking candidates or recruiters violating platform policies.",
      candidate: false,
      recruiter: false,
      admin: true,
    },
  ])

  const handleToggle = (key: string, role: "candidate" | "recruiter" | "admin") => {
    // Prevent locking admin out of suspend/feature privileges
    if (role === "admin" && (key === "suspend_users" || key === "edit_features")) {
      alert("Security Constraint: Admin role must retain critical policy permissions.")
      return
    }

    setMatrix((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, [role]: !row[role] } : row
      )
    )
  }

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      alert("RBAC Policies matrix saved successfully and propagated to gateway nodes!")
    }, 1200)
  }

  const handleReset = () => {
    if (confirm("Reset matrix permissions to standard default configuration?")) {
      setMatrix([
        {
          key: "edit_profile",
          name: "Edit Own Profile",
          desc: "Allows updating bio details, resume files, profile settings and credentials.",
          candidate: true,
          recruiter: true,
          admin: true,
        },
        {
          key: "apply_jobs",
          name: "Apply to Jobs",
          desc: "Allows viewing job listings and submitting applications.",
          candidate: true,
          recruiter: false,
          admin: false,
        },
        {
          key: "post_jobs",
          name: "Post Opportunities",
          desc: "Allows recruiting officers to publish new job listings and manage applicants.",
          candidate: false,
          recruiter: true,
          admin: true,
        },
        {
          key: "moderate_posts",
          name: "Moderate Flagged Listings",
          desc: "Allows editing, hiding, or deleting job listings flagged as non-compliant.",
          candidate: false,
          recruiter: false,
          admin: true,
        },
        {
          key: "verify_companies",
          name: "Verify Partner Badges",
          desc: "Allows approving claims for Menstrual Leave Champion and Returnship Partner status.",
          candidate: false,
          recruiter: false,
          admin: true,
        },
        {
          key: "edit_features",
          name: "Configure Feature Flags",
          desc: "Allows enabling/disabling app features globally (e.g. Chat, WebSockets).",
          candidate: false,
          recruiter: false,
          admin: true,
        },
        {
          key: "suspend_users",
          name: "Suspend User Accounts",
          desc: "Allows blocking candidates or recruiters violating platform policies.",
          candidate: false,
          recruiter: false,
          admin: true,
        },
      ])
    }
  }

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
            <Shield className="size-6 text-[#6B2C91] dark:text-pink-300" />
            Roles & Permissions Matrix
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Define system-wide Role-Based Access Control (RBAC) policies and feature entitlement allocations.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            className="h-8 text-xs font-bold border-slate-200 hover:bg-slate-100"
          >
            <RefreshCw className="size-3 mr-1" />
            Reset Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 text-xs font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700 flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <span className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Propagating...
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save Policies Matrix
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Grid Matrix Table */}
      <DashboardCard className="overflow-hidden p-4">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">
                  Permission Node Description
                </th>
                <th className="p-3 text-xs font-black text-slate-550 uppercase tracking-widest text-center dark:text-slate-400 w-24">
                  Candidate
                </th>
                <th className="p-3 text-xs font-black text-slate-550 uppercase tracking-widest text-center dark:text-slate-400 w-24">
                  Recruiter
                </th>
                <th className="p-3 text-xs font-black text-slate-550 uppercase tracking-widest text-center dark:text-slate-400 w-24">
                  Administrator
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {matrix.map((row) => (
                <tr key={row.key} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10">
                  <td className="p-3.5 space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-[#6B2C91] dark:text-pink-300" />
                      {row.name}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 leading-normal max-w-xl">
                      {row.desc}
                    </p>
                  </td>
                  <td className="p-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.candidate}
                      onChange={() => handleToggle(row.key, "candidate")}
                      className="size-4 rounded accent-[#6B2C91] dark:accent-pink-500 cursor-pointer"
                      aria-label={`Candidate permission for ${row.name}`}
                    />
                  </td>
                  <td className="p-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.recruiter}
                      onChange={() => handleToggle(row.key, "recruiter")}
                      className="size-4 rounded accent-[#6B2C91] dark:accent-pink-500 cursor-pointer"
                      aria-label={`Recruiter permission for ${row.name}`}
                    />
                  </td>
                  <td className="p-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.admin}
                      onChange={() => handleToggle(row.key, "admin")}
                      className="size-4 rounded accent-[#6B2C91] dark:accent-pink-500 cursor-pointer"
                      aria-label={`Admin permission for ${row.name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>
    </div>
  )
}
export default RolesPermissions
