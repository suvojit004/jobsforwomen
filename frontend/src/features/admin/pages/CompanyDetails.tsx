import { useState, useEffect } from "react"
import {
  Mail,
  MapPin,
  Globe,
  Award,
  Users,
  Briefcase,
  CheckCircle,
  HelpCircle,
  FileCheck,
} from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { AdminApi } from "../services/adminApi"
import { cn } from "@/lib/utils"

interface CompanyRecruiterContact {
  name: string
  email: string
  phone: string | null
  verified: boolean
}

interface AdminCompany {
  id: string
  name: string
  website: string
  location: string
  industry: string
  claimedPerks: string[]
  status: string
  recruiters: CompanyRecruiterContact[]
  hiredCount: number
}

interface AdminJob {
  id: string
  title: string
  company: string
  location: string
  salary: string
  applicantsCount: number
  status: string
}

export function CompanyDetails() {
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [allJobs, setAllJobs] = useState<AdminJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true)
        const [comps, jobs] = await Promise.all([
          AdminApi.getCompanies(),
          AdminApi.getJobs(),
        ])
        const formattedComps = (comps || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          website: c.website || "Not specified",
          location: c.location || "Not specified",
          industry: c.industry?.name || "Not specified",
          claimedPerks: (c.benefits || []).map((b: any) => b.benefitName),
          status: c.status,
          recruiters: (c.recruiters || []).map((r: any) => ({
            name: r.fullName || r.user?.email?.split("@")[0] || "Unknown",
            email: r.user?.email || "",
            phone: r.phone || null,
            verified: !!r.verified,
          })),
          hiredCount: c.hiredCount || 0,
        }))
        setCompanies(formattedComps)
        setAllJobs((jobs || []).map((j: any) => ({
          id: j.id,
          title: j.title,
          company: j.company?.name || "Unknown Company",
          location: j.location,
          salary: j.salaryDisplay || "N/A",
          // admin.service.ts's listJobs returns applicant counts under
          // `_count.applications`, not a flat `applicants` field -- this
          // always read undefined and fell back to 0, so every job in this
          // admin view showed "0 Applicants" regardless of its real count.
          applicantsCount: j._count?.applications || 0,
          status: j.status
        })))
        if (formattedComps.length > 0) {
          setSelectedCompanyId(formattedComps[0].id)
        }
      } catch (err) {
        console.error("Failed to load company details database:", err)
      } finally {
        setLoading(false)
      }
    }
    loadDetails()
  }, [])

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId)
  const companyJobs = allJobs.filter(
    (j) => j.company.toLowerCase() === selectedCompany?.name.toLowerCase()
  )

  // Real recruiter contacts for the selected company (RecruiterProfile rows),
  // not a fixed name shown for every company regardless of selection.
  const companyRecruiters = selectedCompany?.recruiters || []

  // The "Menstrual Leave Champion" badge previously just checked
  // status === "approved" -- so *every* approved company was labeled a
  // Champion regardless of whether it ever claimed that specific perk, and
  // a company that claimed it but wasn't approved yet was labeled "Standard
  // Partner". It should reflect the actual claimed benefit.
  const isMenstrualLeaveChampion =
    !!selectedCompany &&
    selectedCompany.status === "approved" &&
    selectedCompany.claimedPerks.includes("Menstrual Leave Support")

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-850">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
            Corporate Partners Directory
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Inspect corporate profiles, check recruiter details, and review workplace equality benefits checklists.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Select Company:</span>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading || !selectedCompany ? (
        <div className="py-12 flex flex-col justify-center items-center gap-2">
          <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Loading directory record...
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Overview Card */}
          <div className="lg:col-span-2 space-y-6">
            <DashboardCard className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-xl bg-violet-100 text-[#6B2C91] dark:bg-pink-900/20 dark:text-pink-300 flex items-center justify-center font-black text-lg shrink-0">
                    {selectedCompany.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">
                      {selectedCompany.name}
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {selectedCompany.industry} • Established Partner
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wide ${
                    isMenstrualLeaveChampion
                      ? "bg-pink-100 text-pink-700 dark:bg-pink-950/20 dark:text-pink-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {isMenstrualLeaveChampion ? "Menstrual Leave Champion" : "Standard Partner"}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 text-xs border-t border-slate-100 pt-5 dark:border-slate-800">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Website</p>
                  <a
                    href={`https://${selectedCompany.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#6B2C91] dark:text-pink-300 hover:underline flex items-center gap-1"
                  >
                    <Globe className="size-3.5" />
                    {selectedCompany.website}
                  </a>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Corporate HQ</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <MapPin className="size-3.5 text-slate-400" />
                    {selectedCompany.location}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Verification Status</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <FileCheck className="size-3.5 text-emerald-500" />
                    {selectedCompany.status.toUpperCase()}
                  </p>
                </div>
              </div>
            </DashboardCard>

            {/* Workplace Equality Benefits Checklist */}
            <DashboardCard className="p-6 space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5">
                <Award className="size-4 text-[#6B2C91]" />
                Workplace Equality Benefits Checklist
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedCompany.claimedPerks.map((perk, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-950/10">
                    <CheckCircle className="size-4.5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{perk}</p>
                      <p className="text-[10px] text-slate-450 dark:text-slate-500 leading-normal mt-0.5">
                        Verified policy credential claim cleared in compliance review.
                      </p>
                    </div>
                  </div>
                ))}
                {selectedCompany.claimedPerks.length === 0 && (
                  <div className="sm:col-span-2 py-4 flex items-center gap-2 text-slate-400">
                    <HelpCircle className="size-4" />
                    <span className="text-xs font-bold">No verified benefits declared yet.</span>
                  </div>
                )}
              </div>
            </DashboardCard>

            {/* Published Opportunities */}
            <DashboardCard className="p-6 space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5">
                <Briefcase className="size-4 text-[#6B2C91]" />
                Published Openings ({companyJobs.length})
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-850">
                {companyJobs.map((job) => (
                  <div key={job.id} className="py-3.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">{job.title}</h4>
                      <p className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold mt-0.5">
                        {job.location} • {job.salary}
                      </p>
                    </div>
                    <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-450 px-2 py-0.5 rounded">
                      {job.applicantsCount} Applicants
                    </span>
                  </div>
                ))}
                {companyJobs.length === 0 && (
                  <div className="py-6 text-center text-xs font-bold text-slate-400">
                    No active job listings found for this company.
                  </div>
                )}
              </div>
            </DashboardCard>
          </div>

          {/* Right Column: Statistics & Contacts */}
          <div className="space-y-6">
            {/* Recruiter Details Card */}
            <DashboardCard className="p-5 space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800">
                <Users className="size-4 text-[#6B2C91]" />
                Talent Representatives ({companyRecruiters.length})
              </h3>
              {companyRecruiters.length === 0 ? (
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 py-2">
                  No recruiters have registered under this company yet.
                </p>
              ) : (
                <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {companyRecruiters.map((r, i) => (
                    <div key={i} className={cn("space-y-3 text-xs font-semibold", i > 0 && "pt-4")}>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-slate-400">Full Name</p>
                        <p className="text-slate-905 dark:text-white font-bold">
                          {r.name}
                          {r.verified && (
                            <span className="ml-1.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase align-middle">Verified</span>
                          )}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-slate-400">Email Address</p>
                        <a href={`mailto:${r.email}`} className="text-[#6B2C91] dark:text-pink-300 hover:underline flex items-center gap-1 mt-0.5">
                          <Mail className="size-3.5" />
                          {r.email}
                        </a>
                      </div>
                      {r.phone && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-black uppercase text-slate-400">Phone</p>
                          <p className="text-slate-505 dark:text-slate-400">{r.phone}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </DashboardCard>

            {/* Statistics telemetry card */}
            <DashboardCard className="p-5 space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800">
                Performance Telemetry
              </h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-slate-50 rounded-xl dark:bg-slate-950/20">
                  <p className="text-xl font-black text-slate-900 dark:text-white">{companyJobs.length}</p>
                  <p className="text-[9px] font-black uppercase text-slate-400 mt-1">Open Positions</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl dark:bg-slate-950/20">
                  <p className="text-xl font-black text-[#6B2C91] dark:text-pink-300">{selectedCompany?.hiredCount ?? 0}</p>
                  <p className="text-[9px] font-black uppercase text-slate-400 mt-1">Total Hires</p>
                </div>
              </div>
            </DashboardCard>
          </div>
        </div>
      )}
    </div>
  )
}
export default CompanyDetails
