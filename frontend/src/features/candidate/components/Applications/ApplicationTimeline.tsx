import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Check, Clock, User, Calendar, FileText, X, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { CompanyLogo } from "@/components/shared/CompanyLogo"
import type { Application } from "@/types/dashboard"
import { cn } from "@/lib/utils"
import { candidateApi } from "../../services/candidateApi"

type ApplicationTimelineProps = {
  application: Application
  onClose?: () => void
}

export function ApplicationTimeline({ application, onClose }: ApplicationTimelineProps) {
  // Stepper state computation based on status
  const status = application.status
  const navigate = useNavigate()
  const [messaging, setMessaging] = useState(false)

  // there was previously no way to start a
  // conversation with the recruiter from anywhere in the Candidate module --
  // see candidateApi.startConversation for the full explanation.
  const handleMessageRecruiter = async () => {
    try {
      setMessaging(true)
      const conversation = await candidateApi.startConversation(application.id)
      navigate(`/candidate/messages?conversation=${conversation.id}`)
    } catch (err: any) {
      toast.error(err?.message || "Couldn't start a conversation with the recruiter.")
    } finally {
      setMessaging(false)
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
      completed: ["Interview Scheduled", "Selected", "Rejected"].includes(status),
      active: status === "Interview Scheduled",
    },
    {
      label: status === "Rejected" ? "Rejected" : status === "Selected" ? "Selected" : "Final Decision",
      description: status === "Selected"
        ? "Congratulations! You received an offer."
        : status === "Rejected"
          ? "Role closed. Thank you for applying."
          : "Awaiting final feedback",
      completed: ["Selected", "Rejected"].includes(status),
      active: ["Selected", "Rejected"].includes(status),
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
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 min-w-0">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMessageRecruiter}
              disabled={messaging || !application.recruiter}
              className="h-7 gap-1 text-[11px] font-bold shrink-0"
            >
              <MessageCircle className="size-3.5" />
              {messaging ? "Opening..." : "Message"}
            </Button>
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
      </div>
    </DashboardCard>
  )
}
