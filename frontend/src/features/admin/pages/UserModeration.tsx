import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import {
  Search,
  UserCheck,
  UserX,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Trash2,
  X,
  Archive,
  ArrowRightLeft,
  Eye,
  Mail,
} from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import type { ColumnDef } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { AdminApi } from "../services/adminApi"
import { useAuth } from "@/hooks/useAuth"

type TabType = "candidates" | "recruiters" | "companies"

interface CandidateUser {
  id: string
  name: string
  email: string
  role: string
  careerBreak: boolean
  // Renamed from `verified` -- candidates aren't manually verified, there's
  // simply a resume on file or there isn't. The old field name (and the
  // "Resume Verified" label it fed) implied a review process that doesn't
  // exist for candidates.
  hasResume: boolean
  status: string
}

interface RecruiterUser {
  id: string
  name: string
  email: string
  company: string
  // Needed to resolve a job-transfer target when deleting a recruiter who
  // still owns jobs -- recruiterProfileId is what Job.recruiterId actually
  // points at (not the User id), and companyId is required so the transfer
  // target is restricted to a recruiter at the same company (backend
  // enforces this too; see AdminService.deleteUser).
  recruiterProfileId: string
  companyId: string | null
  verified: boolean
  status: string
}

// Same shape CompanyApprovals.tsx already builds from AdminApi.getCompanies()
// -- reused here rather than a separate endpoint, since this tab is just a
// read-only directory that deep-links into the existing Company Details page.
interface CompanyRow {
  id: string
  name: string
  website: string
  industry: string
  recruiterName: string
  recruiterEmail: string
  status: string
}

interface ProfileWithCareerBreak {
  candidateProfile?: {
    careerBreak?: {
      hasBreak?: boolean
    } | null
  } | null
}

export function UserModeration() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  // Only Admin/Super Admin can delete users (the backend enforces this too,
  // via requireRole(USER_MGMT_ROLES) on DELETE /admins/users/:id -- this is
  // just so a Moderator/Support Executive viewing this same page, who could
  // previously see it, doesn't see a Delete button that would just 403).
  const canDeleteUsers = !!currentUser?.roles?.some((r) => r === "Admin" || r === "Super Admin")
  const [activeTab, setActiveTab] = useState<TabType>("candidates")
  const [candidates, setCandidates] = useState<CandidateUser[]>([])
  const [recruiters, setRecruiters] = useState<RecruiterUser[]>([])
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  // Candidates-tab-only filter row (All Candidates / With Resume / No
  // Resume / Blocked), same filterMode pattern CandidateManagement.tsx
  // already uses -- "Blocked" here means the collapsed two-state status
  // this table uses (see loadUsers below: anything non-Active reads as
  // "Inactive"), not the richer PendingVerification/Suspended/Blocked enum
  // CandidateManagement.tsx's own status column shows.
  const [filterMode, setFilterMode] = useState<"all" | "hasResume" | "noResume" | "blocked">("all")
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Job-ownership conflict modal -- shown when a recruiter delete is
  // rejected (409) because they still own job postings. See
  // AdminService.deleteUser: the delete must be retried with an explicit
  // resolution (archive the jobs, or transfer them to another recruiter).
  const [jobConflict, setJobConflict] = useState<{
    id: string
    name: string
    email: string
    message: string
  } | null>(null)
  const [resolution, setResolution] = useState<"archive" | "transfer">("archive")
  const [transferTargetId, setTransferTargetId] = useState("")
  const [resolving, setResolving] = useState(false)

  // Load all user collections
  const loadUsers = async () => {
    try {
      setLoading(true)
      const [candidatesList, recruitersList, companiesList] = await Promise.all([
        AdminApi.getUsers("candidate"),
        AdminApi.getUsers("recruiter"),
        AdminApi.getCompanies(),
      ])

      setCandidates((candidatesList || []).map((u: any) => ({
        id: u.id,
        name: u.fullName || u.email.split("@")[0],
        email: u.email,
        role: u.candidateProfile?.title || "Professional",
        careerBreak: !!(u as ProfileWithCareerBreak).candidateProfile?.careerBreak?.hasBreak,
        hasResume: !!u.candidateProfile?.resumeUrl,
        status: u.status === "Active" ? "Active" : "Inactive"
      })))

      setRecruiters((recruitersList || []).map((u: any) => ({
        id: u.id,
        name: u.fullName || u.email.split("@")[0],
        email: u.email,
        company: u.recruiterProfile?.company?.name || "No Company Assigned",
        recruiterProfileId: u.recruiterProfile?.id || "",
        companyId: u.recruiterProfile?.companyId || null,
        verified: !!u.recruiterProfile?.verified,
        status: u.status === "Active" ? "Active" : "Inactive"
      })))

      setCompanies((companiesList || []).map((c: any) => {
        const recruiter = (c.recruiters || [])[0]
        return {
          id: c.id,
          name: c.name,
          website: c.website || "Not specified",
          industry: c.industry?.name || "Not specified",
          recruiterName: recruiter?.fullName || recruiter?.user?.email?.split("@")[0] || "Not specified",
          recruiterEmail: recruiter?.user?.email || "Not specified",
          status: c.status,
        }
      }))
    } catch (err: any) {
      console.error("Failed to load user databases:", err)
      toast.error(err?.message || "Failed to load users.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // Action handlers
  const handleToggleStatus = async (userId: string, role: "candidate" | "recruiter") => {
    try {
      const list = role === "candidate" ? candidates : recruiters
      const userObj = list.find((u) => u.id === userId)
      const nextStatus = userObj?.status === "Active" ? "Suspended" : "Active"
      await AdminApi.updateUserStatus(userId, nextStatus)
      loadUsers()
    } catch (err: any) {
      console.error("Failed to toggle status", err)
      toast.error(err?.message || "Failed to update user status.")
    }
  }

  // Recruiter verification is real (backed by RecruiterProfile.verified).
  // Candidates have no separate "verification" concept in the data model --
  // only resume presence, which is shown read-only in the Verification
  // column below -- so there is no toggle action for candidates here.
  const handleToggleVerification = async (userId: string) => {
    try {
      const recObj = recruiters.find((r) => r.id === userId)
      // The backend's verify-recruiter endpoint looks up a RecruiterProfile
      // by id, not a User -- sending userId here always misses (RecruiterProfile.id
      // and RecruiterProfile.userId are independently-generated UUIDs) and
      // surfaces as a false "account no longer exists" 404 on every recruiter.
      if (!recObj?.recruiterProfileId) {
        toast.error("This recruiter has no profile to verify.")
        return
      }
      const nextVerify = !recObj?.verified
      await AdminApi.verifyRecruiter(recObj.recruiterProfileId, nextVerify)
      loadUsers()
    } catch (err: any) {
      console.error("Failed to toggle verification", err)
      toast.error(err?.message || "Failed to update verification status.")
    }
  }

  // Permanent delete -- distinct from Block/Unblock above, which only flips
  // status and keeps every relation intact. This genuinely removes the
  // account and (via the backend's cascade delete) everything it owns:
  // profile, resume, applications, notifications, saved jobs.
  const handleDeleteUser = async (userId: string, name: string, email: string) => {
    const confirmed = window.confirm(
      `Permanently delete ${name} (${email})?\n\nThis will remove their account, profile, resume, applications, notifications, and saved jobs. This cannot be undone.`
    )
    if (!confirmed) return

    setDeletingId(userId)
    try {
      await AdminApi.deleteUser(userId)
      toast.success(`${name}'s account has been permanently deleted.`)
      loadUsers()
    } catch (err: any) {
      // The backend rejects a recruiter delete with 409 when they still own
      // jobs, instead of ever attempting a delete that would hit a foreign
      // key constraint -- give the admin a way to resolve that here rather
      // than just showing the error and dead-ending.
      if (err?.status === 409) {
        setJobConflict({ id: userId, name, email, message: err.message || "This recruiter still owns job postings." })
        setResolution("archive")
        setTransferTargetId("")
      } else {
        toast.error(err?.message || "Failed to delete user account.")
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleResolveJobConflict = async () => {
    if (!jobConflict) return
    if (resolution === "transfer" && !transferTargetId) {
      toast.error("Choose a recruiter to transfer the jobs to.")
      return
    }
    setResolving(true)
    try {
      await AdminApi.deleteUser(
        jobConflict.id,
        resolution === "archive" ? { archiveJobs: true } : { transferToRecruiterId: transferTargetId }
      )
      toast.success(`${jobConflict.name}'s account has been permanently deleted.`)
      setJobConflict(null)
      loadUsers()
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete user account.")
    } finally {
      setResolving(false)
    }
  }

  // Filter lists based on search
  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false

    if (filterMode === "hasResume") return c.hasResume
    if (filterMode === "noResume") return !c.hasResume
    if (filterMode === "blocked") return c.status !== "Active"
    return true
  })

  const filteredRecruiters = recruiters.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.company.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredCompanies = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.recruiterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.recruiterEmail.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const goToCandidateDetails = (candidateId: string) => navigate(`/admin/candidate-details?candidateId=${candidateId}`)
  const goToCompanyDetails = (companyId: string) => navigate(`/admin/company-details?companyId=${companyId}`)

  // DataTable column definitions
  const candidateColumns: ColumnDef<CandidateUser>[] = [
    {
      header: "Candidate Info",
      cell: (row) => (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => goToCandidateDetails(row.id)}
            className="font-bold text-slate-900 dark:text-white hover:text-[#6B2C91] dark:hover:text-pink-300 hover:underline text-left"
          >
            {row.name}
          </button>
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
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-700 bg-indigo-100/75 dark:bg-indigo-950/25 dark:text-indigo-300 px-2 py-0.5 rounded-full">
            <GraduationCap className="size-3" />
            Yes
          </span>
        ) : (
          <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">None</span>
        )
      ),
    },
    {
      // Was "Verification" / "Resume Verified" -- resumes aren't reviewed or
      // verified by anyone, a candidate either has one on file or doesn't.
      // The old wording implied a manual verification step that doesn't
      // exist and could mislead admins into thinking a resume had been
      // vetted for authenticity.
      header: "Resume Status",
      cell: (row) => (
        row.hasResume ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100/75 dark:bg-emerald-950/25 dark:text-emerald-300 px-2 py-0.5 rounded-full">
            <ShieldCheck className="size-3" />
            Resume Uploaded
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-700 bg-blue-100/75 dark:bg-blue-950/25 dark:text-blue-300 px-2 py-0.5 rounded-full">
            <ShieldAlert className="size-3" />
            Resume Not Uploaded
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
        <div className="flex flex-wrap justify-end gap-1.5">
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
          {canDeleteUsers && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] font-bold flex items-center gap-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-950/50 dark:text-red-400 dark:hover:bg-red-950/20"
              disabled={deletingId === row.id}
              onClick={() => handleDeleteUser(row.id, row.name, row.email)}
            >
              <Trash2 className="size-3" />
              {deletingId === row.id ? "Deleting..." : "Delete"}
            </Button>
          )}
        </div>
      ),
    },
  ]

  const recruiterColumns: ColumnDef<RecruiterUser>[] = [
    {
      header: "Recruiter Info",
      cell: (row) => (
        <div className="space-y-0.5">
          {row.companyId ? (
            <button
              type="button"
              onClick={() => goToCompanyDetails(row.companyId as string)}
              className="font-bold text-slate-900 dark:text-white hover:text-[#6B2C91] dark:hover:text-pink-300 hover:underline text-left"
            >
              {row.name}
            </button>
          ) : (
            <p className="font-bold text-slate-900 dark:text-white">{row.name}</p>
          )}
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
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-700 bg-blue-100/75 dark:bg-blue-950/25 dark:text-blue-300 px-2 py-0.5 rounded-full">
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
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-bold border-slate-200 hover:bg-slate-100"
            onClick={() => handleToggleVerification(row.id)}
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
          {canDeleteUsers && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] font-bold flex items-center gap-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-950/50 dark:text-red-400 dark:hover:bg-red-950/20"
              disabled={deletingId === row.id}
              onClick={() => handleDeleteUser(row.id, row.name, row.email)}
            >
              <Trash2 className="size-3" />
              {deletingId === row.id ? "Deleting..." : "Delete"}
            </Button>
          )}
        </div>
      ),
    },
  ]

  // Company status badge colors -- same mapping CompanyApprovals.tsx uses,
  // kept local here since this tab is a lightweight read-only directory, not
  // a moderation queue (no action buttons beyond "View Details").
  const COMPANY_STATUS_STYLES: Record<string, { style: string; label: string }> = {
    approved: { style: "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-350", label: "Approved" },
    pending: { style: "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350", label: "Pending Verification" },
    submitted: { style: "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350", label: "Submitted for Review" },
    pending_verification: { style: "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350", label: "Pending Verification" },
    under_review: { style: "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-350", label: "Under Review" },
    draft: { style: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", label: "Draft (Not Submitted)" },
    info_requested: { style: "bg-indigo-100/60 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300", label: "More Info Requested" },
    rejected: { style: "bg-pink-100/60 text-pink-850 dark:bg-pink-955/35 dark:text-pink-300", label: "Rejected" },
  }

  const companyColumns: ColumnDef<CompanyRow>[] = [
    {
      header: "Company Info",
      cell: (row) => (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => goToCompanyDetails(row.id)}
            className="font-bold text-slate-900 dark:text-white hover:text-[#6B2C91] dark:hover:text-pink-300 hover:underline text-left"
          >
            {row.name}
          </button>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{row.website}</p>
        </div>
      ),
    },
    {
      header: "Recruiter Contact",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-slate-900 dark:text-white">{row.recruiterName}</p>
          <a
            href={`mailto:${row.recruiterEmail}`}
            className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 hover:underline flex items-center gap-0.5"
          >
            <Mail className="size-2.5" />
            {row.recruiterEmail}
          </a>
        </div>
      ),
    },
    {
      header: "Industry",
      accessorKey: "industry",
    },
    {
      header: "Status",
      cell: (row) => {
        const meta = COMPANY_STATUS_STYLES[row.status] || {
          style: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
          label: row.status,
        }
        return (
          <span className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${meta.style}`}>
            {meta.label}
          </span>
        )
      },
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-bold border-slate-200 dark:border-slate-800"
            onClick={() => goToCompanyDetails(row.id)}
          >
            <Eye className="size-3 mr-0.5" />
            View Details
          </Button>
        </div>
      ),
    },
  ]

  const tabsConfig = [
    { key: "candidates", label: "Candidates", count: candidates.length },
    { key: "recruiters", label: "Recruiters", count: recruiters.length },
    { key: "companies", label: "Companies", count: companies.length },
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
        <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800">
          {tabsConfig.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as TabType)
                setSearchQuery("")
              }}
              className={`shrink-0 pb-2.5 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all relative ${
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

      {/* Resume/status filter pills -- Candidates tab only, same filterMode
          pattern CandidateManagement.tsx uses. */}
      {activeTab === "candidates" && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterMode === "all" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("all")}
          >
            All Candidates
          </Button>
          <Button
            variant={filterMode === "hasResume" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("hasResume")}
          >
            With Resume
          </Button>
          <Button
            variant={filterMode === "noResume" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("noResume")}
          >
            No Resume
          </Button>
          <Button
            variant={filterMode === "blocked" ? "default" : "outline"}
            className="h-8 text-[11px] font-bold"
            onClick={() => setFilterMode("blocked")}
          >
            Blocked
          </Button>
        </div>
      )}

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
            {activeTab === "companies" && (
              <DataTable
                columns={companyColumns}
                data={filteredCompanies}
                onRowClick={(row) => goToCompanyDetails(row.id)}
                emptyMessage="No matching companies found."
              />
            )}
          </div>
        )}
      </DashboardCard>

      {/* Job-ownership conflict modal -- see handleDeleteUser/handleResolveJobConflict */}
      {jobConflict && (() => {
        const targetRecruiter = recruiters.find((r) => r.id === jobConflict.id)
        const transferCandidates = recruiters.filter(
          (r) => r.id !== jobConflict.id && r.companyId && r.companyId === targetRecruiter?.companyId
        )
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldAlert className="size-4 text-teal-500" />
                  Can't Delete {jobConflict.name} Yet
                </h3>
                <button onClick={() => setJobConflict(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                  <X className="size-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{jobConflict.message}</p>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setResolution("archive")}
                    className={`w-full flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                      resolution === "archive"
                        ? "border-[#6B2C91] bg-[#6B2C91]/5 dark:border-pink-300"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <Archive className="size-4 mt-0.5 text-[#6B2C91] dark:text-pink-200 shrink-0" />
                    <span>
                      <span className="block text-xs font-black text-slate-900 dark:text-white">Archive their jobs</span>
                      <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        Job postings are marked archived and stop accepting applicants.
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResolution("transfer")}
                    disabled={transferCandidates.length === 0}
                    className={`w-full flex items-start gap-2 rounded-lg border p-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      resolution === "transfer"
                        ? "border-[#6B2C91] bg-[#6B2C91]/5 dark:border-pink-300"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <ArrowRightLeft className="size-4 mt-0.5 text-[#6B2C91] dark:text-pink-200 shrink-0" />
                    <span>
                      <span className="block text-xs font-black text-slate-900 dark:text-white">Transfer to another recruiter</span>
                      <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        {transferCandidates.length === 0
                          ? "No other recruiter at the same company is available."
                          : "Job postings move to a recruiter at the same company."}
                      </span>
                    </span>
                  </button>

                  {resolution === "transfer" && transferCandidates.length > 0 && (
                    <select
                      value={transferTargetId}
                      onChange={(e) => setTransferTargetId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="">Select a recruiter...</option>
                      {transferCandidates.map((r) => (
                        <option key={r.recruiterProfileId} value={r.recruiterProfileId}>
                          {r.name} ({r.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" size="sm" onClick={() => setJobConflict(null)} className="text-xs font-bold">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleResolveJobConflict}
                  disabled={resolving || (resolution === "transfer" && !transferTargetId)}
                  className="text-xs font-black bg-red-600 hover:bg-red-700 text-white"
                >
                  {resolving ? "Deleting..." : "Confirm & Delete"}
                </Button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
export default UserModeration
