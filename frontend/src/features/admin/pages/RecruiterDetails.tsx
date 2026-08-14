import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useSearchParams, useNavigate, useLocation } from "react-router-dom"
import {
  Mail,
  Phone,
  MapPin,
  Building2,
  Globe,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  ArrowUpRight,
} from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { AdminApi } from "../services/adminApi"

interface AdminRecruiterCompany {
  id: string
  name: string
  logoUrl: string | null
  website: string
  location: string
  status: string
}

interface AdminRecruiter {
  id: string
  fullName: string
  avatarUrl: string | null
  email: string
  phone: string
  verified: boolean
  status: string
  company: AdminRecruiterCompany | null
}

// Reuses AdminApi.getUsers("recruiter") -- the same call UserModeration.tsx
// already makes -- rather than a new endpoint. admin.service.ts's listUsers
// already includes the full RecruiterProfile row (with company: true), so
// avatarUrl/company.logoUrl flow through with zero backend changes needed
// here. Same deep-link-only pattern as CandidateDetails.tsx/CompanyDetails.tsx:
// registered as a route with no sidebar entry, reached only via
// ?recruiterId=<id> from UserModeration.tsx's Recruiters tab.
export function RecruiterDetails() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [recruiters, setRecruiters] = useState<AdminRecruiter[]>([])
  const [selectedRecruiterId, setSelectedRecruiterId] = useState("")
  const [loading, setLoading] = useState(true)

  // Same fallback logic as CandidateDetails.tsx's handleBack -- a directly
  // bookmarked/typed URL has no in-app history, so navigate(-1) would leave
  // the app entirely; fall back to the one place this page is ever linked from.
  const handleBack = () => {
    if (location.key !== "default") {
      navigate(-1)
    } else {
      navigate("/admin/users")
    }
  }

  useEffect(() => {
    const loadRecruiters = async () => {
      try {
        setLoading(true)
        const data = await AdminApi.getUsers("recruiter")
        const formatted: AdminRecruiter[] = (data || []).map((u: any) => ({
          id: u.id,
          fullName: u.recruiterProfile?.fullName || u.email.split("@")[0],
          avatarUrl: u.recruiterProfile?.avatarUrl || null,
          email: u.email,
          phone: u.recruiterProfile?.phone || "Not specified",
          verified: !!u.recruiterProfile?.verified,
          status: u.status,
          company: u.recruiterProfile?.company
            ? {
                id: u.recruiterProfile.company.id,
                name: u.recruiterProfile.company.name,
                logoUrl: u.recruiterProfile.company.logoUrl || null,
                website: u.recruiterProfile.company.website || "Not specified",
                location: u.recruiterProfile.company.location || "Not specified",
                status: u.recruiterProfile.company.status,
              }
            : null,
        }))
        setRecruiters(formatted)

        const requestedId = searchParams.get("recruiterId")
        const requestedExists = requestedId && formatted.some((r) => r.id === requestedId)
        if (requestedExists) {
          setSelectedRecruiterId(requestedId as string)
        } else if (formatted.length > 0) {
          setSelectedRecruiterId(formatted[0].id)
        }
      } catch (err: any) {
        console.error("Failed to load recruiter details:", err)
        toast.error(err?.message || "Failed to load recruiter details.")
      } finally {
        setLoading(false)
      }
    }
    loadRecruiters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedRecruiter = recruiters.find((r) => r.id === selectedRecruiterId)

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div className="border-b border-slate-100 pb-4 dark:border-slate-850">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#6B2C91] dark:text-slate-400 dark:hover:text-pink-300 mb-2"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Recruiter Profile Directory
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Inspect a recruiter's contact details, verification status, and company affiliation.
        </p>
      </div>

      {loading || !selectedRecruiter ? (
        <div className="py-12 flex flex-col justify-center items-center gap-2">
          <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Loading recruiter record...
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column: Profile overview + contact */}
          <div className="lg:col-span-2 space-y-6">
            <DashboardCard className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {selectedRecruiter.avatarUrl ? (
                    <img
                      src={selectedRecruiter.avatarUrl}
                      alt={selectedRecruiter.fullName}
                      className="size-12 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="size-12 rounded-xl bg-violet-100 text-[#6B2C91] dark:bg-pink-900/20 dark:text-pink-300 flex items-center justify-center font-black text-lg shrink-0">
                      {selectedRecruiter.fullName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">
                      {selectedRecruiter.fullName}
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {selectedRecruiter.company?.name || "No Company Assigned"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 justify-end">
                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wide ${
                      selectedRecruiter.status === "Active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                        : "bg-pink-100 text-pink-700 dark:bg-pink-950/20 dark:text-pink-300"
                    }`}
                  >
                    {selectedRecruiter.status}
                  </span>
                  {selectedRecruiter.verified ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100/75 dark:bg-emerald-950/25 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="size-3" />
                      Partner Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-700 bg-blue-100/75 dark:bg-blue-950/25 dark:text-blue-300 px-2 py-0.5 rounded-full">
                      <ShieldAlert className="size-3" />
                      Unverified Partner
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 text-xs border-t border-slate-100 pt-5 dark:border-slate-800">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Email</p>
                  <a href={`mailto:${selectedRecruiter.email}`} className="font-bold text-[#6B2C91] dark:text-pink-300 hover:underline flex items-center gap-1">
                    <Mail className="size-3.5" />
                    {selectedRecruiter.email}
                  </a>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Phone</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Phone className="size-3.5 text-slate-400" />
                    {selectedRecruiter.phone}
                  </p>
                </div>
              </div>
            </DashboardCard>
          </div>

          {/* Right column: company affiliation */}
          <div className="space-y-6">
            <DashboardCard className="p-5 space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800">
                <Building2 className="size-3.5 text-[#6B2C91] dark:text-pink-300" />
                Company
              </h3>
              {selectedRecruiter.company ? (
                <div className="space-y-3 text-xs font-semibold">
                  <div className="flex items-center gap-2.5">
                    {selectedRecruiter.company.logoUrl ? (
                      <img
                        src={selectedRecruiter.company.logoUrl}
                        alt={selectedRecruiter.company.name}
                        className="size-9 rounded-lg object-cover shrink-0 border border-slate-100 dark:border-slate-800"
                      />
                    ) : (
                      <div className="size-9 rounded-lg bg-violet-100 text-[#6B2C91] dark:bg-pink-900/20 dark:text-pink-300 flex items-center justify-center font-black text-sm shrink-0">
                        {selectedRecruiter.company.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-slate-850 dark:text-white font-black">{selectedRecruiter.company.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold capitalize">{selectedRecruiter.company.status}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Globe className="size-4 text-[#6B2C91] dark:text-pink-300 shrink-0" />
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400">Website</p>
                      <p className="text-slate-850 dark:text-white break-all">{selectedRecruiter.company.website}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <MapPin className="size-4 text-[#6B2C91] dark:text-pink-300 shrink-0" />
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400">Location</p>
                      <p className="text-slate-850 dark:text-white">{selectedRecruiter.company.location}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/company-details?companyId=${selectedRecruiter.company!.id}`)}
                    className="flex items-center gap-1 text-[10px] font-black text-[#6B2C91] dark:text-pink-300 hover:underline pt-1"
                  >
                    View Full Company Profile
                    <ArrowUpRight className="size-3" />
                  </button>
                </div>
              ) : (
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">This recruiter is not yet assigned to a company.</p>
              )}
            </DashboardCard>
          </div>
        </div>
      )}
    </div>
  )
}
export default RecruiterDetails
