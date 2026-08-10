import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft,
  Calendar,
  FileText,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  UserCheck,
  XCircle,
  X,
  Gift,
  Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { DocumentPreviewModal } from "@/components/shared/DocumentPreviewModal"
import type { PreviewableDocument } from "@/utils/fileHelpers"
import { cn } from "@/lib/utils"
import { RecruiterApi, type ApplicantRow } from "../services/recruiterApi"
import { ScheduleInterviewModal, type ScheduleInterviewSubject } from "../components/ScheduleInterviewModal"

// This page used to be built entirely on hardcoded fake candidates
// ("Priya Sharma" etc.) with status changes persisted only to localStorage --
// completely disconnected from the real database, even though the real
// Applicants list links every real applicant row here. It's rebuilt below to
// load the real application/candidate data and reuse the same real
// status/interview/offer actions that Applicants.tsx already wires to the
// backend.
export function CandidatePreview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ApplicantRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Interview scheduling modal state -- Issue 1: delegated to the shared
  // ScheduleInterviewModal (see Applicants.tsx for the same change).
  const [schedulingSubject, setSchedulingSubject] = useState<ScheduleInterviewSubject | null>(null)

  // Offer release modal state (mirrors Applicants.tsx)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [offerDetailsText, setOfferDetailsText] = useState("")
  const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null)
  const [offerSubmitting, setOfferSubmitting] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<(PreviewableDocument & { title?: string }) | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const rows = await RecruiterApi.getApplicants()
      const match = rows.find((r) => r.id === id) || null
      setProfile(match)
    } catch (err) {
      console.error("Failed to load applicant detail", err)
      toast.error("Couldn't load applicant details.")
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleUpdateStatus = async (newStatus: string) => {
    if (!profile) return
    const previous = profile
    setProfile({ ...profile, status: newStatus })
    try {
      await RecruiterApi.updateApplicantStatus(profile.id, newStatus)
      toast.success(`Status updated to "${newStatus}".`)
    } catch (err: any) {
      setProfile(previous)
      toast.error(err?.message || "Couldn't update applicant status.")
    }
  }

  const openScheduler = () => {
    if (!profile) return
    setSchedulingSubject({ applicationId: profile.id, name: profile.name, jobTitle: profile.job })
  }

  const handleConfirmOffer = async () => {
    if (!profile || !offerDetailsText.trim()) {
      toast.error("Offer details are required.")
      return
    }
    try {
      setOfferSubmitting(true)
      await RecruiterApi.releaseOffer(profile.id, offerDetailsText.trim(), offerLetterFile || undefined)
      toast.success("Offer released and candidate notified.")
      setShowOfferModal(false)
      setOfferLetterFile(null)
      load()
    } catch (err: any) {
      toast.error(err?.message || "Couldn't release the offer.")
    } finally {
      setOfferSubmitting(false)
    }
  }

  const handleDownloadResume = () => {
    if (!profile?.resumeUrl) {
      toast.error("This candidate has not uploaded a resume yet.")
      return
    }
    // Opens in-app instead of window.open() -- sidesteps the popup-blocker
    // silent-failure case entirely (see Applicants.tsx for the same change).
    setPreviewDoc({ url: profile.resumeUrl, originalFilename: `${profile.name} - Resume` })
  }

  const handleViewOfferLetter = () => {
    if (!profile?.offerLetterUrl) return
    setPreviewDoc({ url: profile.offerLetterUrl, originalFilename: `${profile.name} - Offer Letter` })
  }

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading candidate details...</div>
  }

  if (!profile) {
    return (
      <div className="py-12 max-w-md mx-auto text-center space-y-4">
        <AlertCircle className="size-12 text-slate-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Application Not Found</h2>
        <p className="text-sm text-slate-500">We couldn't locate this candidate's application. It may have been withdrawn or removed.</p>
        <Button onClick={() => navigate("/recruiter/applicants")}>Back to Applicants</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Navigation */}
      <div>
        <Link
          to="/recruiter/applicants"
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
        >
          <ArrowLeft className="size-3.5" />
          Back to Applicants List
        </Link>
      </div>

      {/* Main Header summary */}
      <DashboardCard className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="size-14 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-black text-xl shrink-0 dark:bg-pink-900/20 dark:text-pink-200">
              {profile.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-950 truncate dark:text-white">
                  {profile.name}
                </h1>
                <StatusBadge status={profile.status as any} />
              </div>
              <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                Applying for <span className="text-[#6B2C91] dark:text-pink-300 uppercase">{profile.job}</span>
                {profile.title && <span className="text-slate-400 dark:text-slate-500 normal-case"> &middot; {profile.title}</span>}
              </p>
            </div>
          </div>

          {/* no flex-wrap meant these two buttons (with fairly
              long labels like "No Resume Uploaded") could force this row,
              and the page, wider than a narrow mobile viewport. */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={handleDownloadResume}
              disabled={!profile.resumeUrl}
              className="h-9 font-bold text-xs gap-1.5 cursor-pointer"
            >
              <Download className="size-4" />
              {profile.resumeUrl ? "View Resume" : "No Resume Uploaded"}
            </Button>
          </div>
        </div>
      </DashboardCard>

      {/* Main Details Workspace */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left main: profile components */}
        <div className="md:col-span-2 space-y-6">
          {/* Bio */}
          {profile.bio && (
            <DashboardCard className="p-5 space-y-2">
              <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
                About
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-350">
                {profile.bio}
              </p>
            </DashboardCard>
          )}

          {/* Experience */}
          <DashboardCard className="p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              Work Experience
            </h3>
            {(!profile.experience || profile.experience.length === 0) ? (
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">No work experience listed.</p>
            ) : (
              <div className="space-y-4">
                {profile.experience.map((exp) => (
                  <div key={exp.id} className="relative pl-5 border-l border-slate-150 dark:border-slate-800 space-y-1">
                    <div className="absolute -left-1.5 top-1.5 size-3 rounded-full bg-[#6B2C91] dark:bg-pink-400" />
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">{exp.jobTitle}</h4>
                    <p className="text-[11px] font-bold text-slate-400">{exp.company} &middot; {exp.duration}</p>
                    {exp.description && (
                      <p className="text-xs text-slate-600 leading-relaxed dark:text-slate-350 pt-1">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>

          {/* Education */}
          <DashboardCard className="p-5 space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              Education
            </h3>
            {(!profile.education || profile.education.length === 0) ? (
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">No education listed.</p>
            ) : (
              <div className="space-y-3">
                {profile.education.map((edu) => (
                  <div key={edu.id} className="space-y-0.5">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">{edu.degree}</h4>
                    <p className="text-[11px] font-bold text-slate-400">{edu.institution} &middot; {edu.duration}</p>
                    {edu.grade && <p className="text-[11px] text-slate-500">Result: {edu.grade}</p>}
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>

          {/* Skills */}
          <DashboardCard className="p-5 space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              Skills
            </h3>
            {(!profile.skills || profile.skills.length === 0) ? (
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">No skills listed.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill, i) => (
                  <span key={i} className="text-[10px] font-bold bg-violet-50 text-[#6B2C91] dark:bg-pink-950/20 dark:text-pink-300 px-2 py-0.5 rounded-full">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </DashboardCard>

          {/* Resume Attachment */}
          <DashboardCard className="p-5 space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              Resume Attachment
            </h3>
            {profile.resumeUrl ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-pink-50 dark:bg-pink-950/20 text-[#6B2C91] dark:text-pink-300 flex items-center justify-center">
                    <FileText className="size-5 text-pink-500" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white">Candidate Resume</p>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      {profile.resumeMetadata?.mimetype || "Document"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadResume}
                  className="h-8 gap-1 text-[11px] font-bold text-[#6B2C91] dark:text-pink-200"
                >
                  <Download className="size-3.5" />
                  View
                </Button>
              </div>
            ) : (
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">No resume uploaded by this candidate yet.</p>
            )}
          </DashboardCard>
        </div>

        {/* Right side: Application Action Control Card */}
        <div className="space-y-6">
          <DashboardCard className="p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              Application Actions
            </h3>

            {/* Pipeline Stage Switches -- same real transitions as Applicants.tsx */}
            <div className="space-y-2">
              <Button
                onClick={() => handleUpdateStatus("Under Review")}
                variant="outline"
                className={cn(
                  "w-full h-9 font-bold text-xs justify-start gap-2 cursor-pointer",
                  profile.status === "Under Review" && "bg-violet-50 text-[#6B2C91] border-violet-200 dark:bg-violet-950/20 dark:text-pink-100"
                )}
              >
                <Clock className="size-4 text-violet-500" />
                Move to Under Review
              </Button>

              <Button
                onClick={() => handleUpdateStatus("Shortlisted")}
                variant="outline"
                className={cn(
                  "w-full h-9 font-bold text-xs justify-start gap-2 cursor-pointer",
                  profile.status === "Shortlisted" && "bg-violet-50 text-[#6B2C91] border-violet-200 dark:bg-violet-950/20 dark:text-pink-100"
                )}
              >
                <Star className="size-4 text-violet-500" />
                Shortlist Candidate
              </Button>

              <Button
                onClick={openScheduler}
                variant="outline"
                className={cn(
                  "w-full h-9 font-bold text-xs justify-start gap-2 cursor-pointer",
                  profile.status === "Interview Scheduled" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300"
                )}
              >
                <Calendar className="size-4 text-emerald-500" />
                {profile.nextInterview ? "Reschedule Interview" : "Schedule Interview"}
              </Button>

              <Button
                onClick={() => { setOfferDetailsText(""); setOfferLetterFile(null); setShowOfferModal(true) }}
                variant="outline"
                className={cn(
                  "w-full h-9 font-bold text-xs justify-start gap-2 cursor-pointer",
                  profile.status === "Offer Released" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300"
                )}
              >
                <Gift className="size-4 text-emerald-500" />
                Release Offer
              </Button>

              <Button
                onClick={() => handleUpdateStatus("Selected")}
                variant="outline"
                className={cn(
                  "w-full h-9 font-bold text-xs justify-start gap-2 cursor-pointer",
                  profile.status === "Selected" && "bg-emerald-500 text-white hover:bg-emerald-600 border-transparent dark:bg-emerald-600 dark:hover:bg-emerald-700"
                )}
              >
                <UserCheck className="size-4 text-emerald-500 dark:text-white" />
                Mark as Hired
              </Button>

              <Button
                onClick={() => handleUpdateStatus("Rejected")}
                variant="outline"
                className={cn(
                  "w-full h-9 font-bold text-xs justify-start gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/10 cursor-pointer",
                  profile.status === "Rejected" && "bg-red-50 dark:bg-red-950/20 border-red-200"
                )}
              >
                <XCircle className="size-4 text-red-500" />
                Reject Application
              </Button>
            </div>

            {profile.nextInterview && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg text-xs font-bold space-y-1 select-none border border-emerald-100 dark:border-emerald-950/50">
                <p className="flex items-center gap-1">
                  <CheckCircle className="size-4 stroke-[3]" />
                  {profile.nextInterview.title}
                </p>
                <p className="text-[10px] text-slate-500">
                  {new Date(profile.nextInterview.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {profile.nextInterview.location && (
                  <p className="text-[10px] text-slate-500">{profile.nextInterview.location}</p>
                )}
              </div>
            )}

            {profile.offerDetails && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg text-xs font-bold space-y-1 select-none border border-emerald-100 dark:border-emerald-950/50">
                <p className="flex items-center gap-1">
                  <Gift className="size-4" />
                  Offer Released
                </p>
                <p className="text-[10px] text-slate-500">{profile.offerDetails}</p>
                {profile.offerLetterUrl && (
                  <button
                    type="button"
                    onClick={handleViewOfferLetter}
                    className="inline-flex items-center gap-1 text-[10px] font-black text-[#6B2C91] dark:text-pink-300 hover:underline"
                  >
                    <FileText className="size-3" />
                    View Offer Letter
                  </button>
                )}
              </div>
            )}
          </DashboardCard>

          {/* Quick Specifications -- only real fields, no fabricated CTC/phone/location */}
          <DashboardCard className="p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              Candidate Details
            </h3>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Email</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 break-all">{profile.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Applied On</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{profile.appliedDate}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Expected Salary</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{profile.expectedSalary || "Not specified"}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Notice Period</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{profile.noticePeriod || "Not specified"}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Languages</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {profile.languages && profile.languages.length > 0 ? profile.languages.join(", ") : "Not specified"}
                </p>
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>

      {/* Schedule Interview modal */}
      <ScheduleInterviewModal
        subject={schedulingSubject}
        onClose={() => setSchedulingSubject(null)}
        onScheduled={load}
      />

      {/* Release Offer modal */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Gift className="size-4 text-emerald-600" />
                Release Offer — {profile.name}
              </h3>
              <button onClick={() => setShowOfferModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Offer Details <span className="text-red-500">*</span></label>
                <textarea
                  value={offerDetailsText}
                  onChange={(e) => setOfferDetailsText(e.target.value)}
                  rows={4}
                  placeholder="e.g. ₹12 LPA, joining date 1st Aug, remote-first role"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Offer Letter (Optional)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setOfferLetterFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full text-[11px] font-semibold text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-[#6B2C91]/10 file:px-2.5 file:py-1.5 file:text-[10px] file:font-black file:text-[#6B2C91] hover:file:bg-[#6B2C91]/20 dark:text-slate-400 dark:file:bg-pink-950/30 dark:file:text-pink-200"
                />
                {offerLetterFile && (
                  <p className="mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{offerLetterFile.name}</p>
                )}
                <p className="mt-1 text-[10px] text-slate-400">PDF, DOC, or DOCX, up to 10MB. Attached automatically to the candidate's notification.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setShowOfferModal(false)} className="text-xs font-bold">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmOffer}
                disabled={offerSubmitting}
                className="text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {offerSubmitting ? "Releasing..." : "Release Offer & Notify"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  )
}
export default CandidatePreview
