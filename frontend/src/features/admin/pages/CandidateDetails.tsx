import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useSearchParams, useNavigate, useLocation } from "react-router-dom"
import {
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Link2,
  FileText,
  Download,
  Languages,
  Wallet,
  CalendarClock,
  ArrowLeft,
} from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { AdminApi } from "../services/adminApi"
import { DocumentPreviewModal } from "@/components/shared/DocumentPreviewModal"
import type { PreviewableDocument } from "@/utils/fileHelpers"

interface AdminWorkExperience {
  jobTitle: string
  company: string
  duration: string
  description: string
}

interface AdminEducation {
  degree: string
  institution: string
  duration: string
  grade?: string
  specialization?: string
}

interface AdminSocialLink {
  platform: string
  url: string
}

interface AdminCandidate {
  id: string
  fullName: string
  email: string
  title: string
  phone: string
  location: string
  totalExperience: string
  noticePeriod: string
  expectedSalary: string
  availability: string
  preferredLocations: string[]
  languages: string[]
  resumeUrl: string | null
  resumeMetadata: { mimetype?: string } | null
  careerBreak: { hasBreak?: boolean; reason?: string; duration?: string; summary?: string } | null
  experience: AdminWorkExperience[]
  education: AdminEducation[]
  socialLinks: AdminSocialLink[]
  status: string
}

// Reuses AdminApi.getUsers("candidate") -- the same call UserModeration.tsx
// and CandidateManagement.tsx already make -- rather than a new endpoint.
// admin.service.ts's listUsers includes the full CandidateProfile row, and
// every private-document URL (resumeUrl here) is already deep-signed by
// sendSuccess() before it reaches the frontend, so it's directly viewable/
// downloadable with no extra signing step needed on this page.
export function CandidateDetails() {
  // Deep-linked only -- reached via ?candidateId=<id> from the Candidates
  // tab on User Account Moderation (UserModeration.tsx), same pattern as
  // CompanyDetails.tsx's ?companyId=. There's no standalone nav entry or
  // candidate picker on this page anymore; it always needs an id.
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [candidates, setCandidates] = useState<AdminCandidate[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState("")
  const [loading, setLoading] = useState(true)
  const [previewDoc, setPreviewDoc] = useState<PreviewableDocument | null>(null)

  // Always deep-linked, always reached from UserModeration.tsx's Candidates
  // tab (goToCandidateDetails) -- navigate(-1) returns there directly.
  // location.key === "default" means this tab has no in-app history (a
  // bookmarked/directly-typed URL, or a fresh page load) -- navigate(-1)
  // would then leave the app entirely, so fall back to the one place this
  // page is ever linked from instead.
  const handleBack = () => {
    if (location.key !== "default") {
      navigate(-1)
    } else {
      navigate("/admin/users")
    }
  }

  useEffect(() => {
    const loadCandidates = async () => {
      try {
        setLoading(true)
        const data = await AdminApi.getUsers("candidate")
        const formatted: AdminCandidate[] = (data || []).map((u: any) => ({
          id: u.id,
          fullName: u.candidateProfile?.fullName || u.email.split("@")[0],
          email: u.email,
          title: u.candidateProfile?.title || "Working Professional",
          phone: u.candidateProfile?.phone || "Not specified",
          location: u.candidateProfile?.location || "Not specified",
          totalExperience: u.candidateProfile?.totalExperience || "Not specified",
          noticePeriod: u.candidateProfile?.noticePeriod || "Not specified",
          expectedSalary: u.candidateProfile?.expectedSalary || "Not specified",
          availability: u.candidateProfile?.availability || "Not specified",
          preferredLocations: u.candidateProfile?.preferredLocations || [],
          languages: u.candidateProfile?.languages?.length ? u.candidateProfile.languages : ["Not specified"],
          resumeUrl: u.candidateProfile?.resumeUrl || null,
          resumeMetadata: u.candidateProfile?.resumeMetadata || null,
          careerBreak: u.candidateProfile?.careerBreak || null,
          experience: u.candidateProfile?.experience || [],
          education: u.candidateProfile?.education || [],
          socialLinks: u.candidateProfile?.socialLinks || [],
          status: u.status,
        }))
        setCandidates(formatted)

        const requestedId = searchParams.get("candidateId")
        const requestedExists = requestedId && formatted.some((c) => c.id === requestedId)
        if (requestedExists) {
          setSelectedCandidateId(requestedId as string)
        } else if (formatted.length > 0) {
          setSelectedCandidateId(formatted[0].id)
        }
      } catch (err: any) {
        console.error("Failed to load candidate details database:", err)
        toast.error(err?.message || "Failed to load candidate details.")
      } finally {
        setLoading(false)
      }
    }
    loadCandidates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId)

  const handleViewResume = () => {
    if (!selectedCandidate?.resumeUrl) return
    setPreviewDoc({ url: selectedCandidate.resumeUrl, originalFilename: `${selectedCandidate.fullName} - Resume` })
  }

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
          Candidate Profile Directory
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Inspect a candidate's full profile, career history, and uploaded resume.
        </p>
      </div>

      {loading || !selectedCandidate ? (
        <div className="py-12 flex flex-col justify-center items-center gap-2">
          <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Loading candidate record...
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column: Profile overview + history */}
          <div className="lg:col-span-2 space-y-6">
            <DashboardCard className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-xl bg-violet-100 text-[#6B2C91] dark:bg-pink-900/20 dark:text-pink-300 flex items-center justify-center font-black text-lg shrink-0">
                    {selectedCandidate.fullName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">
                      {selectedCandidate.fullName}
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {selectedCandidate.title}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wide ${
                    selectedCandidate.status === "Active"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                      : "bg-pink-100 text-pink-700 dark:bg-pink-950/20 dark:text-pink-300"
                  }`}
                >
                  {selectedCandidate.status}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 text-xs border-t border-slate-100 pt-5 dark:border-slate-800">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Email</p>
                  <a href={`mailto:${selectedCandidate.email}`} className="font-bold text-[#6B2C91] dark:text-pink-300 hover:underline flex items-center gap-1">
                    <Mail className="size-3.5" />
                    {selectedCandidate.email}
                  </a>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Phone</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Phone className="size-3.5 text-slate-400" />
                    {selectedCandidate.phone}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Location</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <MapPin className="size-3.5 text-slate-400" />
                    {selectedCandidate.location}
                  </p>
                </div>
              </div>
            </DashboardCard>

            {/* Resume */}
            <DashboardCard className="p-6 space-y-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5">
                <FileText className="size-4 text-[#6B2C91]" />
                Resume
              </h3>
              {selectedCandidate.resumeUrl ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-pink-50 dark:bg-pink-950/20 text-[#6B2C91] dark:text-pink-300 flex items-center justify-center">
                      <FileText className="size-5 text-pink-500" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white">Candidate Resume</p>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        {selectedCandidate.resumeMetadata?.mimetype || "Document"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleViewResume}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#6B2C91] dark:text-pink-300 hover:underline"
                  >
                    <Download className="size-3.5" />
                    View
                  </button>
                </div>
              ) : (
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">No resume uploaded by this candidate yet.</p>
              )}
            </DashboardCard>

            {/* Career break */}
            {selectedCandidate.careerBreak?.hasBreak && (
              <DashboardCard className="p-6 space-y-2">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5">
                  <GraduationCap className="size-4 text-[#6B2C91]" />
                  Career Break
                </h3>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 space-y-1">
                  {selectedCandidate.careerBreak.reason && <p><span className="font-black text-slate-400 uppercase text-[10px] mr-1">Reason:</span>{selectedCandidate.careerBreak.reason}</p>}
                  {selectedCandidate.careerBreak.duration && <p><span className="font-black text-slate-400 uppercase text-[10px] mr-1">Duration:</span>{selectedCandidate.careerBreak.duration}</p>}
                  {selectedCandidate.careerBreak.summary && <p className="italic text-slate-500 dark:text-slate-400">"{selectedCandidate.careerBreak.summary}"</p>}
                </div>
              </DashboardCard>
            )}

            {/* Work experience */}
            <DashboardCard className="p-6 space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5">
                <Briefcase className="size-4 text-[#6B2C91]" />
                Work Experience
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-850">
                {selectedCandidate.experience.map((exp, i) => (
                  <div key={i} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">{exp.jobTitle}</h4>
                      <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 shrink-0">{exp.duration}</span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{exp.company}</p>
                    {exp.description && (
                      <p className="text-[11px] text-slate-450 dark:text-slate-500 mt-1 leading-relaxed break-words">{exp.description}</p>
                    )}
                  </div>
                ))}
                {selectedCandidate.experience.length === 0 && (
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 py-2">No work experience on file.</p>
                )}
              </div>
            </DashboardCard>

            {/* Education */}
            <DashboardCard className="p-6 space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5">
                <GraduationCap className="size-4 text-[#6B2C91]" />
                Education
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-850">
                {selectedCandidate.education.map((edu, i) => (
                  <div key={i} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {edu.degree}
                        {edu.specialization && <span className="font-bold text-slate-450 dark:text-slate-500">, {edu.specialization}</span>}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 shrink-0">{edu.duration}</span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {edu.institution}{edu.grade ? ` · ${edu.grade}` : ""}
                    </p>
                  </div>
                ))}
                {selectedCandidate.education.length === 0 && (
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 py-2">No education history on file.</p>
                )}
              </div>
            </DashboardCard>
          </div>

          {/* Right column: quick facts */}
          <div className="space-y-6">
            <DashboardCard className="p-5 space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800">
                Career Details
              </h3>
              <div className="space-y-3 text-xs font-semibold">
                <div className="flex items-center gap-2.5">
                  <Briefcase className="size-4 text-[#6B2C91] dark:text-pink-300 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Total Experience</p>
                    <p className="text-slate-850 dark:text-white">{selectedCandidate.totalExperience}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Wallet className="size-4 text-[#6B2C91] dark:text-pink-300 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Expected Salary</p>
                    <p className="text-slate-850 dark:text-white">{selectedCandidate.expectedSalary}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <CalendarClock className="size-4 text-[#6B2C91] dark:text-pink-300 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Notice Period</p>
                    <p className="text-slate-850 dark:text-white">{selectedCandidate.noticePeriod}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Languages className="size-4 text-[#6B2C91] dark:text-pink-300 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Languages</p>
                    <p className="text-slate-850 dark:text-white">{selectedCandidate.languages.join(", ")}</p>
                  </div>
                </div>
              </div>
            </DashboardCard>

            {selectedCandidate.preferredLocations.length > 0 && (
              <DashboardCard className="p-5 space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <MapPin className="size-3.5 text-[#6B2C91] dark:text-pink-300" />
                  Preferred Locations
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCandidate.preferredLocations.map((loc, i) => (
                    <span key={i} className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-650 dark:text-slate-300">
                      {loc}
                    </span>
                  ))}
                </div>
              </DashboardCard>
            )}

            {selectedCandidate.socialLinks.length > 0 && (
              <DashboardCard className="p-5 space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest dark:text-white flex items-center gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <Link2 className="size-3.5 text-[#6B2C91] dark:text-pink-300" />
                  Social Links
                </h3>
                <div className="space-y-2">
                  {selectedCandidate.socialLinks.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between text-xs font-bold text-[#6B2C91] dark:text-pink-300 hover:underline"
                    >
                      <span>{link.platform}</span>
                      <Link2 className="size-3" />
                    </a>
                  ))}
                </div>
              </DashboardCard>
            )}
          </div>
        </div>
      )}

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  )
}
export default CandidateDetails
