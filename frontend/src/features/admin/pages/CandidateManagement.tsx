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
import { AdminApi } from "../services/adminApi"

interface CandidateUser {
  id: string
  name: string
  email: string
  role: string
  careerBreak: boolean
  verified: boolean
  status: string
}

export function CandidateManagement() {
  const [candidates, setCandidates] = useState<CandidateUser[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMode, setFilterMode] = useState<"all" | "verified" | "pending" | "blocked">("all")
  const [loading, setLoading] = useState(true)

  const loadCandidates = async () => {
    try {
      setLoading(true)
      const data = await AdminApi.getUsers("candidate")
      setCandidates((data || []).map((u: any) => ({
        id: u.id,
        name: u.fullName || u.email.split("@")[0],
        email: u.email,
        role: u.candidateProfile?.title || "Professional",
        careerBreak: !!u.candidateProfile?.bio,
        verified: !!u.candidateProfile?.resumeUrl,
        status: u.status === "Active" ? "Active" : "Blocked"
      })))
    } catch (err) {
      console.error("Failed to load candidates database:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCandidates()
  }, [])

  const handleToggleStatus = async (userId: string) => {
    try {
      const candObj = candidates.find((c) => c.id === userId)
      const nextStatus = candObj?.status === "Active" ? "Suspended" : "Active"
      await AdminApi.updateUserStatus(userId, nextStatus)
      loadCandidates()
    } catch (err) {
      console.error("Failed to toggle status", err)
    }
  }

  const handleToggleVerification = async (_userId: string) => {
    alert("Candidate resume verification is not implemented dynamically on database model level.")
  }

  // Filter logic
  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (!matchesSearch) return false

    if (filterMode === "verified") return c.verified
    if (filterMode === "pending") return !c.verified
    if (filterMode === "blocked") return c.status === "Blocked"
    return true
  })

  const columns: ColumnDef<CandidateUser>[] = [
    {
      header: "Candidate Info",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="font-bold text-slate-900 dark:text-white text-xs">{row.name}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{row.email}</p>
        </div>
      ),
    },
    {
      header: "Target Job Role",
      accessorKey: "role",
    },
    {
      header: "Career Returner",
      cell: (row) => (
        row.careerBreak ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-purple-700 bg-purple-100/75 dark:bg-purple-950/25 dark:text-purple-300 px-2.5 py-0.5 rounded-full">
            <GraduationCap className="size-3" />
            Yes
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 dark:text-slate-650 font-bold ml-2">No</span>
        )
      ),
    },
    {
      header: "Verification",
      cell: (row) => (
        row.verified ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100/75 dark:bg-emerald-950/25 dark:text-emerald-355 px-2 py-0.5 rounded-full">
            <ShieldCheck className="size-3" />
            Credentials Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-100/75 dark:bg-amber-955/25 dark:text-amber-300 px-2 py-0.5 rounded-full">
            <ShieldAlert className="size-3" />
            Pending Review
          </span>
        )
      ),
    },
    {
      header: "Status",
      cell: (row) => (
        <span
          className={`inline-flex items-center text-[10px] font-black px-2.5 py-0.5 rounded-full ${
            row.status === "Active"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
              : "bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400"
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
            onClick={() => handleToggleVerification(row.id)}
          >
            <UserCheck className="size-3 mr-0.5" />
            {row.verified ? "Revoke Verification" : "Verify Resume"}
          </Button>

          <Button
            size="sm"
            variant={row.status === "Active" ? "destructive" : "default"}
            className={`h-7 text-[10px] font-bold ${
              row.status === "Active"
                ? ""
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
            onClick={() => handleToggleStatus(row.id)}
          >
            <UserX className="size-3 mr-0.5" />
            {row.status === "Active" ? "Block Candidate" : "Unblock Candidate"}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Candidate Credentials Management
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Audit profile metrics, check resume credentials, verify career returner paths, and manage block lists.
        </p>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterMode === "all" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("all")}
          >
            All Candidates
          </Button>
          <Button
            variant={filterMode === "verified" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("verified")}
          >
            Verified Only
          </Button>
          <Button
            variant={filterMode === "pending" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("pending")}
          >
            Pending Check
          </Button>
          <Button
            variant={filterMode === "blocked" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("blocked")}
          >
            Blocked
          </Button>
        </div>

        <div className="relative w-full max-w-xs shrink-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search by name, email or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9 rounded-lg border-slate-200 bg-white focus-visible:ring-[#6B2C91]/25 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
      </div>

      {/* Candidates database layout */}
      <DashboardCard className="p-4 overflow-hidden">
        {loading ? (
          <div className="py-12 flex flex-col justify-center items-center gap-2">
            <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Syncing candidates...
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredCandidates}
            emptyMessage="No candidates matched your filter parameters."
          />
        )}
      </DashboardCard>
    </div>
  )
}
export default CandidateManagement
