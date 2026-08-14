import { useState } from "react"
import { toast } from "sonner"
import { Check, Clock, User, Calendar, FileText, X, Gift, Undo2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { CompanyLogo } from "@/components/shared/CompanyLogo"
import type { Application } from "@/types/dashboard"
import { cn } from "@/lib/utils"
import { CandidateJobsApi } from "../../services/jobsApi"
import { DocumentPreviewModal } from "@/components/shared/DocumentPreviewModal"

type ApplicationTimelineProps = {
  application: Application
  onClose?: () => void
  // Called after a successful withdrawal so the parent list/selection can be
  // updated in place without a full refetch.
  onWithdrawn?: (applicationId: string) => void
  // Called after a successful reapply -- unlike withdrawal this resets real
  // server-side state (interview/offer data is cleared), so the parent
  // should refetch rather than patch locally.
  onReapplied?: () => void
}

// Once an application reaches one of these stages, withdrawing no longer
// makes sense (offer already extended/accepted, already closed out, or
// already withdrawn) -- mirrors candidate.service.ts's withdrawApplication()
// guard on the backend, which is the actual source of truth/enforcement.
const NON_WITHDRAWABLE_STATUSES = ["Offer Released", "Selected", "Rejected", "Withdrawn"]

export function ApplicationTimeline({ application, onClose, onWithdrawn, onReapplied }: ApplicationTimelineProps) {
  // Stepper state computation based on status
  const status = application.status
  const [previewingOffer, setPreviewingOffer] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [reapplying, setReapplying] = useState(false)
  const canWithdraw = !NON_WITHDRAWABLE_STATUSES.includes(status)

  const handleWithdraw = async () => {
    if (
      !window.confirm(
        "Withdraw this application? This is permanent and the recruiter will be notified."
      )
    ) {
      return
    }
    try {
      setWithdrawing(true)
      await CandidateJobsApi.withdrawApplication(application.id)
      toast.success("Application withdrawn.")
      onWithdrawn?.(application.id)
    } catch (err: any) {
      toast.error(err?.message || "Couldn't withdraw the application.")
    } finally {
      setWithdrawing(false)
    }
  }

  const handleReapply = async () => {
    try {
      setReapplying(true)
      await CandidateJobsApi.applyToJob(application.jobId)
      toast.success("Application resubmitted successfully.")
      onReapplied?.()
    } catch (err: any) {
      toast.error(err?.message || "Couldn't reapply to this job.")
    } finally {
      setReapplying(false)
    }
  }

  const steps = [
    {
      label: "Applied",
      description: `Application submitted on ${application.appliedDate}`,
      completed: true,
      active: status === "Applied",
    },
    {
      label: "Under Review",
      description: status === "Applied" 
        ? "Recruiter is reviewing your profile" 
        : "Your profile is under active review",
      completed: status !== "Applied",
      active: status === "Under Review",
    },
    {
      label: "Interview Scheduled",
      description: application.interviewDate
        ? `Scheduled for ${application.interviewDate}`
        : "Pending schedule invitation",
      // "Offer Released" and "Selected" both imply an interview already
      // happened -- without including them here, the stepper stayed stuck
      // on "Under Review" for every application that progressed past this
      // point, even once an offer had actually been sent. "Withdrawn" is
      // included the same way "Rejected" is: it's a terminal outcome that
      // may have happened before or after an interview, and there's no
      // stored record of which stage it was withdrawn from.
      completed: ["Interview Scheduled", "Offer Released", "Selected", "Rejected", "Withdrawn"].includes(status),
      active: status === "Interview Scheduled",
    },
    {
      label:
        status === "Withdrawn" ? "Withdrawn" :
        status === "Rejected" ? "Rejected" :
        status === "Selected" ? "Selected" :
        status === "Offer Released" ? "Offer Released" : "Final Decision",
      description: status === "Selected"
        ? "Congratulations! You received an offer."
        : status === "Offer Released"
          ? "An offer has been extended -- check the details below."
          : status === "Rejected"
            ? "Role closed. Thank you for applying."
            : status === "Withdrawn"
              ? "You withdrew this application."
              : "Awaiting final feedback",
      completed: ["Offer Released", "Selected", "Rejected", "Withdrawn"].includes(status),
      active: ["Offer Released", "Selected", "Rejected", "Withdrawn"].includes(status),
    },
  ]

  return (
    <DashboardCard className="p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5 dark:border-slate-800">
        <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
          Application Details
        </h3>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-white lg:hidden"
            aria-label="Close details"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        {/* Company Header */}
        <div className="flex items-center gap-3.5 bg-slate-50 p-3 rounded-xl dark:bg-slate-950/40">
          <CompanyLogo
            code={application.companyCode}
            tone={
              application.companyCode === "CM"
                ? "green"
                : application.companyCode === "WA"
                  ? "blue"
                  : application.companyCode === "BC"
                    ? "pink"
                    : "purple"
            }
            className="size-11"
            logoUrl={application.companyLogoUrl}
            alt={application.company}
          />
          <div className="min-w-0">
            <h4 className="text-sm font-extrabold text-slate-950 dark:text-white truncate">
              {application.job}
            </h4>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
              {application.company}
            </p>
          </div>
        </div>

        {/* Stepper Timeline */}
        <div className="space-y-6 pl-2">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1
            return (
              <div key={index} className="flex gap-4 relative">
                {/* Visual Line */}
                {!isLast && (
                  <span
                    className={cn(
                      "absolute left-[11px] top-6 bottom-[-24px] w-0.5",
                      step.completed && !steps[index + 1].active
                        ? "bg-emerald-500"
                        : "bg-slate-200 dark:bg-slate-800"
                    )}
                  />
                )}

                {/* Step Circle */}
                <div
                  className={cn(
                    "size-6 rounded-full flex items-center justify-center shrink-0 border-2 z-10",
                    step.completed
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : step.active
                        ? "bg-white border-[#6B2C91] text-[#6B2C91] dark:bg-slate-950 dark:border-pink-400 dark:text-pink-300"
                        : "bg-white border-slate-200 text-slate-400 dark:bg-slate-950 dark:border-slate-800"
                  )}
                >
                  {step.completed ? (
                    <Check className="size-3.5 stroke-[3]" />
                  ) : step.active ? (
                    <Clock className="size-3.5 stroke-[3]" />
                  ) : (
                    <span className="text-[10px] font-bold">{index + 1}</span>
                  )}
                </div>

                {/* Step Info */}
                <div className="space-y-0.5 pt-0.5">
                  <p
                    className={cn(
                      "text-xs font-extrabold",
                      step.active
                        ? "text-[#6B2C91] dark:text-pink-200"
                        : "text-slate-800 dark:text-slate-200"
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <hr className="border-slate-100 dark:border-slate-800" />

        {/* Metadata Details */}
        <div className="space-y-3.5">
          <h4 className="text-xs font-extrabold text-slate-950 dark:text-white">
            Application Context
          </h4>

          {/* Recruiter -- application.recruiter
              was never populated by the backend at all (candidate.service.ts's
              getApplications() didn't query job.recruiter), so this always
              rendered "Not Assigned" regardless of whether the job actually
              had one. No dedicated recruiter photo column exists in the
              schema, so the avatar is initials-based rather than a stored
              image. */}
          <div className="flex items-center gap-3 text-xs">
            {application.recruiter ? (
              <div className="size-9 rounded-full bg-gradient-to-br from-[#6B2C91] to-pink-600 text-white flex items-center justify-center shrink-0 font-black text-xs">
                {application.recruiter.name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("") || "R"}
              </div>
            ) : (
              <div className="size-9 rounded-lg bg-violet-50 text-[#6B2C91] dark:bg-violet-500/20 dark:text-pink-100 flex items-center justify-center shrink-0">
                <User className="size-4" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-slate-500 dark:text-slate-400">Assigned Recruiter</p>
              {application.recruiter ? (
                <>
                  <p className="font-extrabold text-slate-900 dark:text-white truncate">
                    {application.recruiter.name}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 truncate">
                    {application.recruiter.jobTitle}
                    {application.recruiter.email ? ` · ${application.recruiter.email}` : ""}
                  </p>
                </>
              ) : (
                <p className="font-extrabold text-slate-900 dark:text-white">Not Assigned</p>
              )}
            </div>
          </div>

          {/* Interview -- Issue 1: show the full structured detail the
              recruiter set (Timezone, Mode, Meeting Link/Venue, Notes)
              instead of just a flattened date string. */}
          {application.status === "Interview Scheduled" && application.interviewDate && (
            <div className="flex items-start gap-3 text-xs">
              <div className="size-8 rounded-lg bg-violet-50 text-[#6B2C91] dark:bg-violet-500/20 dark:text-pink-100 flex items-center justify-center shrink-0">
                <Calendar className="size-4" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-500 dark:text-slate-400">Interview Date & Time</p>
                <p className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  {application.interviewDate}
                  {application.interview?.timezone ? ` (${application.interview.timezone})` : ""}
                </p>
                {application.interview && (
                  <p className="font-bold text-slate-500 dark:text-slate-400">
                    {application.interview.mode === "Offline" ? "In-person" : "Online"}
                    {application.interview.mode === "Offline" && application.interview.venue
                      ? ` — ${application.interview.venue}`
                      : ""}
                    {application.interview.mode !== "Offline" && application.interview.meetingLink ? (
                      <>
                        {" — "}
                        <a
                          href={application.interview.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#6B2C91] dark:text-pink-200 hover:underline"
                        >
                          Join link
                        </a>
                      </>
                    ) : null}
                  </p>
                )}
                {application.interview?.notes && (
                  <p className="text-slate-500 dark:text-slate-400 font-semibold">{application.interview.notes}</p>
                )}
              </div>
            </div>
          )}

          {/* Offer Letter -- surfaces the recruiter-uploaded offer letter
              (and free-text offer summary) once one exists, regardless of
              whether the application has since moved past "Offer Released"
              (e.g. to Selected), so a candidate can still reopen a past
              offer. No mimetype is stored for offer letters, so the
              extension is sniffed from the URL to decide inline PDF
              viewing vs. a named download. */}
          {application.offerLetterUrl && (
            <div className="flex items-start gap-3 text-xs">
              <div className="size-8 rounded-lg bg-violet-50 text-[#6B2C91] dark:bg-violet-500/20 dark:text-pink-100 flex items-center justify-center shrink-0">
                <Gift className="size-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="font-bold text-slate-500 dark:text-slate-400">Offer Letter</p>
                {application.offerDetails && (
                  <p className="text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                    {application.offerDetails}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewingOffer(true)}
                  className="font-extrabold text-[#6B2C91] dark:text-pink-200 hover:underline"
                >
                  View offer letter
                </button>
              </div>
            </div>
          )}

          {/* Resume Used -- this used to show
              the literal hardcoded string "Priya_Sharma_Resume.pdf" for
              every candidate's every application regardless of whose
              resume was actually on file. The Application type/API this
              component receives doesn't carry a per-application resume
              filename (resumes aren't versioned per-application in the
              schema -- one resumeUrl lives on the candidate profile), so
              rather than fabricate a filename we show an honest, generic
              confirmation instead. */}
          <div className="flex items-center gap-3 text-xs">
            <div className="size-8 rounded-lg bg-violet-50 text-[#6B2C91] dark:bg-violet-500/20 dark:text-pink-100 flex items-center justify-center shrink-0">
              <FileText className="size-4" />
            </div>
            <div>
              <p className="font-bold text-slate-500 dark:text-slate-400">Resume</p>
              <p className="font-extrabold text-slate-900 dark:text-white truncate max-w-xs">
                Resume on file at time of application
              </p>
            </div>
          </div>
        </div>

        {status === "Withdrawn" && (
          <>
            <hr className="border-slate-100 dark:border-slate-800" />
            <div className="rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
              You withdrew this application. The recruiter can no longer see your profile details for it.
            </div>
            <Button
              type="button"
              onClick={handleReapply}
              disabled={reapplying}
              className="w-full h-8 gap-1.5 text-xs font-bold bg-[#6B2C91] text-white hover:bg-[#5a237b]"
            >
              <RotateCcw className="size-3.5" />
              {reapplying ? "Reapplying..." : "Reapply to this Job"}
            </Button>
          </>
        )}

        {canWithdraw && (
          <>
            <hr className="border-slate-100 dark:border-slate-800" />
            <Button
              type="button"
              variant="outline"
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="w-full h-8 gap-1.5 text-xs font-bold border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400"
            >
              <Undo2 className="size-3.5" />
              {withdrawing ? "Withdrawing..." : "Withdraw Application"}
            </Button>
          </>
        )}
      </div>

      <DocumentPreviewModal
        doc={previewingOffer && application.offerLetterUrl ? { url: application.offerLetterUrl, originalFilename: "Offer Letter" } : null}
        onClose={() => setPreviewingOffer(false)}
      />
    </DashboardCard>
  )
}
