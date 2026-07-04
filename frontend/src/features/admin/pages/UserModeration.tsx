import { useState, useEffect } from "react"
import {
  Search,
  UserCheck,
  UserX,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
} from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import type { ColumnDef } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { AdminService } from "@/services/admin.service"
import type {
  CandidateUser,
  RecruiterUser,
  AdminUser,
} from "@/mock/admin/adminMock"

type TabType = "candidates" | "recruiters" | "admins"

export function UserModeration() {
  const [activeTab, setActiveTab] = useState<TabType>("candidates")
  const [candidates, setCandidates] = useState<CandidateUser[]>([])
  const [recruiters, setRecruiters] = useState<RecruiterUser[]>([])
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)

  // Load all user collections
  const loadUsers = async () => {
    try {
      setLoading(true)
      const [cands, recs, adms] = await Promise.all([
        AdminService.getCandidates(),
        AdminService.getRecruiters(),
        AdminService.getAdmins(),
      ])
      setCandidates([...cands])
      setRecruiters([...recs])
      setAdmins([...adms])
    } catch (err) {
      console.error("Failed to load user databases:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // Action handlers
  const handleToggleStatus = async (userId: string, role: "candidate" | "recruiter" | "admin") => {
    const success = await AdminService.toggleUserStatus(userId, role)
    if (success) {
      loadUsers()
    }
  }

  const handleToggleVerification = async (userId: string, role: "candidate" | "recruiter") => {
    const success = await AdminService.toggleUserVerification(userId, role)
    if (success) {
      loadUsers()
    }
  }

  // Filter lists based on search
  const filteredCandidates = candidates.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredRecruiters = recruiters.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.company.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredAdmins = admins.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // DataTable column definitions
  const candidateColumns: ColumnDef<CandidateUser>[] = [
    {
      header: "Candidate Info",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="font-bold text-slate-900 dark:text-white">{row.name}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{row.email}</p>
        </div>
      ),
    },
    {
      header: "Job Role",
      accessorKey: "role",
    },
    {
      header: "Career Break",
      cell: (row) => (
        row.careerBreak ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-purple-700 bg-purple-100/75 dark:bg-purple-950/25 dark:text-purple-300 px-2 py-0.5 rounded-full">
            <GraduationCap className="size-3" />
            Yes
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 dark:text-slate-650 font-bold">None</span>
        )
      ),
    },
    {
      header: "Verification",
      cell: (row) => (
        row.verified ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100/75 dark:bg-emerald-950/25 dark:text-emerald-300 px-2 py-0.5 rounded-full">
            <ShieldCheck className="size-3" />
            Resume Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-100/75 dark:bg-amber-955/25 dark:text-amber-300 px-2 py-0.5 rounded-full">
            <ShieldAlert className="size-3" />
            Pending
          </span>
        )
      ),
    },
    {
      header: "Status",
      cell: (row) => (
        <span
          className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${
            row.status === "Active"
              ? "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-350"
              : "bg-pink-100/60 text-pink-800 dark:bg-pink-950/30 dark:text-pink-350"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-bold border-slate-200 hover:bg-slate-100"
            onClick={() => handleToggleVerification(row.id, "candidate")}
          >
            {row.verified ? "Revoke Verification" : "Verify Resume"}
          </Button>
          <Button
            size="sm"
            variant={row.status === "Active" ? "destructive" : "outline"}
            className="h-7 text-[10px] font-bold flex items-center gap-1"
            onClick={() => handleToggleStatus(row.id, "candidate")}
          >
            {row.status === "Active" ? (
              <>
                <UserX className="size-3" />
                Block
              </>
            ) : (
              <>
                <UserCheck className="size-3" />
                Unblock
              </>
            )}
          </Button>
        </div>
      ),
    },
  ]

  const recruiterColumns: ColumnDef<RecruiterUser>[] = [
    {
      header: "Recruiter Info",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="font-bold text-slate-900 dark:text-white">{row.name}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{row.email}</p>
        </div>
      ),
    },
    {
      header: "Company",
      accessorKey: "company",
    },
    {
      header: "Verification Status",
      cell: (row) => (
        row.verified ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100/75 dark:bg-emerald-950/25 dark:text-emerald-300 px-2 py-0.5 rounded-full">
            <ShieldCheck className="size-3" />
            Partner Approved
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-100/75 dark:bg-amber-955/25 dark:text-amber-300 px-2 py-0.5 rounded-full">
            <ShieldAlert className="size-3" />
            Unverified Partner
          </span>
        )
      ),
    },
    {
      header: "Account Status",
      cell: (row) => (
        <span
          className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${
            row.status === "Active"
              ? "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-350"
              : "bg-pink-100/60 text-pink-800 dark:bg-pink-950/30 dark:text-pink-350"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-bold border-slate-200 hover:bg-slate-100"
            onClick={() => handleToggleVerification(row.id, "recruiter")}
          >
            {row.verified ? "Deauthorize" : "Verify Corporate"}
          </Button>
          <Button
            size="sm"
            variant={row.status === "Active" ? "destructive" : "outline"}
            className="h-7 text-[10px] font-bold flex items-center gap-1"
            onClick={() => handleToggleStatus(row.id, "recruiter")}
          >
            {row.status === "Active" ? (
              <>
                <UserX className="size-3" />
                Block
              </>
            ) : (
              <>
                <UserCheck className="size-3" />
                Unblock
              </>
            )}
          </Button>
        </div>
      ),
    },
  ]

  const adminColumns: ColumnDef<AdminUser>[] = [
    {
      header: "Admin Info",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="font-bold text-slate-900 dark:text-white">{row.name}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{row.email}</p>
        </div>
      ),
    },
    {
      header: "System Role",
      accessorKey: "role",
    },
    {
      header: "Permissions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.permissions.map((p, i) => (
            <span key={i} className="text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-650 dark:text-slate-300">
              {p}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: "Status",
      cell: (row) => (
        <span
          className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${
            row.status === "Active"
              ? "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-350"
              : "bg-pink-100/60 text-pink-800 dark:bg-pink-950/30 dark:text-pink-350"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant={row.status === "Active" ? "destructive" : "outline"}
            className="h-7 text-[10px] font-bold flex items-center gap-1"
            disabled={row.id === "admin-1"} // Avoid locking out principal admin
            onClick={() => handleToggleStatus(row.id, "admin")}
          >
            {row.status === "Active" ? (
              <>
                <UserX className="size-3" />
                Suspend Admin
              </>
            ) : (
              <>
                <UserCheck className="size-3" />
                Activate Admin
              </>
            )}
          </Button>
        </div>
      ),
    },
  ]

  const tabsConfig = [
    { key: "candidates", label: "Candidates", count: candidates.length },
    { key: "recruiters", label: "Recruiters", count: recruiters.length },
    { key: "admins", label: "Administrators", count: admins.length },
  ]

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          User Account Moderation
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Deactivate abusive accounts, manual audits, resume verifications, and corporate privileges control.
        </p>
      </div>

      {/* Tabs navigation + Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          {tabsConfig.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as TabType)
                setSearchQuery("")
              }}
              className={`pb-2.5 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all relative ${
                activeTab === tab.key
                  ? "border-[#6B2C91] text-[#6B2C91] dark:border-pink-500 dark:text-pink-300"
                  : "border-transparent text-slate-400 hover:text-slate-650"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                activeTab === tab.key
                  ? "bg-[#6B2C91]/10 text-[#6B2C91] dark:bg-pink-500/10 dark:text-pink-300"
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-xs shrink-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9 rounded-lg border-slate-200 bg-white focus-visible:ring-[#6B2C91]/25 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
      </div>

      {/* Table view */}
      <DashboardCard className="p-4 overflow-hidden">
        {loading ? (
          <div className="py-12 flex flex-col justify-center items-center gap-2">
            <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Fetching database logs...
            </p>
          </div>
        ) : (
          <div>
            {activeTab === "candidates" && (
              <DataTable
                columns={candidateColumns}
                data={filteredCandidates}
                emptyMessage="No matching candidates found."
              />
            )}
            {activeTab === "recruiters" && (
              <DataTable
                columns={recruiterColumns}
                data={filteredRecruiters}
                emptyMessage="No matching recruiters found."
              />
            )}
            {activeTab === "admins" && (
              <DataTable
                columns={adminColumns}
                data={filteredAdmins}
                emptyMessage="No matching administrators found."
              />
            )}
          </div>
        )}
      </DashboardCard>
    </div>
  )
}
export default UserModeration
