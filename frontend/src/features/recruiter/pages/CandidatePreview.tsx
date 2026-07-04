import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  ArrowLeft,
  Calendar,
  FileText,
  Download,
  CheckCircle,
  AlertCircle,
  Heart,
  Clock,
  UserCheck,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { cn } from "@/lib/utils"

interface CandidateProfile {
  id: string
  name: string
  role: string
  email: string
  phone: string
  location: string
  experience: string
  currentCtc: string
  expectedCtc: string
  noticePeriod: string
  availability: string
  skills: string[]
  careerBreak: {
    reason: string
    duration: string
    summary: string
  }
  resume: {
    name: string
    uploadDate: string
    verified: boolean
  }
  status: "Applied" | "Under Review" | "Interview Scheduled" | "Selected" | "Rejected"
}

export function CandidatePreview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Interview scheduler state
  const [showScheduler, setShowScheduler] = useState(false)
  const [interviewDate, setInterviewDate] = useState("")
  const [interviewTime, setInterviewTime] = useState("")
  const [interviewerName, setInterviewerName] = useState("TechNova HR Team")
  const [isScheduled, setIsScheduled] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  // Load candidate profile dynamically based on ID
  const [profile, setProfile] = useState<CandidateProfile | null>(() => {
    // List of candidates
    const candidatesList = [
      {
        id: "application-1",
        name: "Priya Sharma",
        role: "Frontend Developer",
        email: "priya.sharma@example.com",
        phone: "+91 98765 43210",
        location: "Bengaluru, Karnataka",
        experience: "2.5 Years",
        currentCtc: "₹ 8.5 LPA",
        expectedCtc: "₹ 12.0 LPA",
        noticePeriod: "15 Days",
        availability: "Immediate",
        skills: ["React", "JavaScript", "Tailwind CSS", "HTML/CSS", "REST APIs"],
        careerBreak: {
          reason: "Family care (Maternity & Childcare)",
          duration: "Jun 2022 - Mar 2023 (10 months)",
          summary: "I took a career break to focus on my family commitments and childcare. During this period, I kept my skills up to date by taking certified online courses and building personal portfolios using React and TypeScript.",
        },
        resume: {
          name: "Priya_Sharma_Resume.pdf",
          uploadDate: "10 May 2025",
          verified: true,
        },
        status: "Applied" as const,
      },
      {
        id: "app-verma",
        name: "Anjali Verma",
        role: "UI/UX Designer",
        email: "anjali.v@example.com",
        phone: "+91 98765 11111",
        location: "Bengaluru, Karnataka",
        experience: "3+ Years",
        currentCtc: "₹ 10.0 LPA",
        expectedCtc: "₹ 14.5 LPA",
        noticePeriod: "30 Days",
        availability: "Immediate",
        skills: ["Figma", "Design Systems", "Prototyping", "UX Research", "Wireframing"],
        careerBreak: {
          reason: "Childcare & Family responsibilities",
          duration: "Jan 2023 - Dec 2024 (2 Years)",
          summary: "Dedicated time to raise my newborn. Re-skilled in advanced design tokens and component structures in Figma. Eager to return to full-time design operations.",
        },
        resume: {
          name: "Anjali_Verma_Portfolio_Resume.pdf",
          uploadDate: "11 May 2025",
          verified: true,
        },
        status: "Under Review" as const,
      },
      {
        id: "app-singh",
        name: "Neha Singh",
        role: "Frontend Developer",
        email: "neha.singh@example.com",
        phone: "+91 98765 22222",
        location: "Noida, UP",
        experience: "2+ Years",
        currentCtc: "₹ 7.5 LPA",
        expectedCtc: "₹ 10.0 LPA",
        noticePeriod: "Immediate",
        availability: "Immediate",
        skills: ["React", "Angular", "JavaScript ES6", "CSS Grid", "Material UI"],
        careerBreak: {
          reason: "Health recovery & Wellness",
          duration: "May 2024 - Dec 2024 (8 months)",
          summary: "Took a brief sabbatical to recuperate from medical issues. Completed advanced React frameworks certification and modern state management courses during recovery.",
        },
        resume: {
          name: "Neha_Singh_Resume.pdf",
          uploadDate: "10 May 2025",
          verified: true,
        },
        status: "Interview Scheduled" as const,
      },
      {
        id: "app-patel",
        name: "Riya Patel",
        role: "Content Writer",
        email: "riya.patel@example.com",
        phone: "+91 98765 33333",
        location: "Mumbai, Maharashtra",
        experience: "1+ Years",
        currentCtc: "₹ 4.0 LPA",
        expectedCtc: "₹ 6.0 LPA",
        noticePeriod: "15 Days",
        availability: "Immediate",
        skills: ["Copywriting", "SEO Optimization", "Content Strategy", "Social Media Editing"],
        careerBreak: {
          reason: "Elderly Care support",
          duration: "Mar 2023 - Mar 2024 (1 Year)",
          summary: "Provided family support for elder care. Conducted freelance copywriting projects part-time during the break to maintain industry writing standards.",
        },
        resume: {
          name: "Riya_Patel_Writing_Resume.pdf",
          uploadDate: "09 May 2025",
          verified: true,
        },
        status: "Selected" as const,
      },
      {
        id: "app-khan",
        name: "Ayesha Khan",
        role: "Frontend Developer",
        email: "ayesha.khan@example.com",
        phone: "+91 98765 44444",
        location: "Remote",
        experience: "2+ Years",
        currentCtc: "₹ 8.0 LPA",
        expectedCtc: "₹ 11.5 LPA",
        noticePeriod: "Immediate",
        availability: "Immediate",
        skills: ["React", "Vue.js", "Tailwind CSS", "Bootstrap", "Git/CI-CD"],
        careerBreak: {
          reason: "Personal skill-sabbatical",
          duration: "Aug 2024 - Jan 2025 (6 months)",
          summary: "Volunteered for non-profit open source design contributions and learned advanced backend cloud computing concepts to supplement frontend skills.",
        },
        resume: {
          name: "Ayesha_Khan_Resume.pdf",
          uploadDate: "08 May 2025",
          verified: true,
        },
        status: "Rejected" as const,
      },
    ]

    // Check if there are candidate applied custom jobs in storage
    const storedAppsStr = localStorage.getItem("customApplications")
    const customApps = storedAppsStr ? JSON.parse(storedAppsStr) : []

    // If ID is custom, map Priya Sharma's profile to it
    const isCustom = id && (id.startsWith("job-custom-") || id.startsWith("job-p") || id.includes("custom"))
    let activeProfile = candidatesList.find((c) => c.id === id)

    if (!activeProfile && isCustom) {
      const matchCustom = customApps.find((a: any) => a.id === id)
      if (matchCustom) {
        activeProfile = {
          id: matchCustom.id,
          name: "Priya Sharma",
          role: matchCustom.job,
          email: "priya.sharma@example.com",
          phone: "+91 98765 43210",
          location: "Bengaluru, Karnataka",
          experience: "2.5 Years",
          currentCtc: "₹ 8.5 LPA",
          expectedCtc: "₹ 12.0 LPA",
          noticePeriod: "15 Days",
          availability: "Immediate",
          skills: ["React", "JavaScript", "Tailwind CSS", "HTML/CSS", "REST APIs"],
          careerBreak: {
            reason: "Family care (Maternity & Childcare)",
            duration: "Jun 2022 - Mar 2023 (10 months)",
            summary: "I took a career break to focus on my family commitments and childcare. During this period, I kept my skills up to date by taking certified online courses and building personal portfolios using React and TypeScript.",
          },
          resume: {
            name: "Priya_Sharma_Resume.pdf",
            uploadDate: "10 May 2025",
            verified: true,
          },
          status: (matchCustom.status as any) || "Applied",
        }
      }
    }

    // Merge overrides
    if (activeProfile) {
      const overridesStr = localStorage.getItem("applicationsOverrides")
      const overrides = overridesStr ? JSON.parse(overridesStr) : []
      const matchOverride = overrides.find((o: any) => o.id === activeProfile?.id)
      if (matchOverride) {
        activeProfile.status = matchOverride.status
      }
      return activeProfile
    }

    return null
  })

  // Set default scheduler date values if available
  useEffect(() => {
    if (profile?.id) {
      const overridesStr = localStorage.getItem("applicationsOverrides")
      const overrides = overridesStr ? JSON.parse(overridesStr) : []
      const match = overrides.find((o: any) => o.id === profile.id)
      if (match && match.interviewDate) {
        const [d, t] = match.interviewDate.split(" @ ")
        setInterviewDate(d || "")
        setInterviewTime(t || "")
        setIsScheduled(true)
      }
    }
  }, [profile])

  if (!profile) {
    return (
      <div className="py-12 max-w-md mx-auto text-center space-y-4">
        <AlertCircle className="size-12 text-slate-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Profile Not Found</h2>
        <p className="text-sm text-slate-500">We couldn't locate the candidate application details.</p>
        <Button onClick={() => navigate("/recruiter/applicants")}>Back to Applicants</Button>
      </div>
    )
  }

  // Update Status & Sync to localStorage
  const handleUpdateStatus = (newStatus: CandidateProfile["status"], additionalPayload = {}) => {
    const updated = { ...profile, status: newStatus }
    setProfile(updated)

    const overridesStr = localStorage.getItem("applicationsOverrides")
    const overrides = overridesStr ? JSON.parse(overridesStr) : []
    const existingIdx = overrides.findIndex((o: any) => o.id === profile.id)

    const payload = {
      id: profile.id,
      status: newStatus,
      ...additionalPayload,
    }

    if (existingIdx > -1) {
      overrides[existingIdx] = { ...overrides[existingIdx], ...payload }
    } else {
      overrides.push(payload)
    }
    localStorage.setItem("applicationsOverrides", JSON.stringify(overrides))
  }

  // Handle Interview Form Submission
  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!interviewDate || !interviewTime) {
      alert("Please select both date and time.")
      return
    }

    const formattedDateTime = `${interviewDate} @ ${interviewTime}`
    handleUpdateStatus("Interview Scheduled", {
      interviewDate: formattedDateTime,
      recruiter: interviewerName,
    })

    setIsScheduled(true)
    setShowScheduler(false)
  }

  const handleDownload = () => {
    setDownloadSuccess(true)
    setTimeout(() => setDownloadSuccess(false), 2500)
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
                .join("")}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-950 truncate dark:text-white">
                  {profile.name}
                </h1>
                <StatusBadge status={profile.status} />
              </div>
              <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                Applying for <span className="text-[#6B2C91] dark:text-pink-300 uppercase">{profile.role}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={handleDownload}
              className="h-9 font-bold text-xs gap-1.5 cursor-pointer"
            >
              <Download className="size-4" />
              Download Resume
            </Button>
          </div>
        </div>
      </DashboardCard>

      {/* Download Alert toast */}
      {downloadSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg text-xs font-bold flex items-center gap-2 border border-emerald-100 dark:border-emerald-950/50">
          <CheckCircle className="size-4 animate-bounce" />
          Resume downloaded successfully!
        </div>
      )}

      {/* Main Details Workspace */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left main: profile components */}
        <div className="md:col-span-2 space-y-6">
          {/* Career Break Highlight */}
          <DashboardCard className="p-5 border-pink-100 bg-gradient-to-br from-pink-50/15 via-white to-violet-50/15 dark:border-pink-950/10 dark:from-pink-950/5 dark:via-slate-900 dark:to-violet-950/5 relative overflow-hidden select-none">
            <div className="flex items-start gap-4">
              <div className="size-10 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center shrink-0 dark:bg-pink-900/30 dark:text-pink-200">
                <Heart className="size-5 fill-pink-500 text-pink-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-slate-950 dark:text-white flex items-center gap-1.5">
                  Career Break Returnee Highlight
                  <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[9px] font-black text-pink-700 dark:bg-pink-950/40 dark:text-pink-200 uppercase">
                    Returnee
                  </span>
                </h3>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 space-y-0.5">
                  <p>Reason: <span className="text-slate-800 dark:text-slate-200">{profile.careerBreak.reason}</span></p>
                  <p>Duration: <span className="text-slate-800 dark:text-slate-200">{profile.careerBreak.duration}</span></p>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-350 border-t border-slate-100 pt-2.5 mt-2 dark:border-slate-850">
                  {profile.careerBreak.summary}
                </p>
              </div>
            </div>
          </DashboardCard>

          {/* Experience Skeletons */}
          <DashboardCard className="p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              Work Experience
            </h3>
            <div className="space-y-4">
              <div className="relative pl-5 border-l border-slate-150 dark:border-slate-800 space-y-1">
                <div className="absolute -left-1.5 top-1.5 size-3 rounded-full bg-[#6B2C91] dark:bg-pink-400" />
                <h4 className="text-xs font-black text-slate-900 dark:text-white">Software Engineer (Contract)</h4>
                <p className="text-[11px] font-bold text-slate-400">Freelance / Remote · Apr 2023 - Present</p>
                <p className="text-xs text-slate-600 leading-relaxed dark:text-slate-350 pt-1">
                  Built modern responsive components for B2B dashboards, integrated APIs, and improved client rendering speeds.
                </p>
              </div>

              <div className="relative pl-5 border-l border-slate-150 dark:border-slate-800 space-y-1">
                <div className="absolute -left-1.5 top-1.5 size-3 rounded-full bg-slate-300 dark:bg-slate-700" />
                <h4 className="text-xs font-black text-slate-900 dark:text-white">Junior Frontend Developer</h4>
                <p className="text-[11px] font-bold text-slate-400">NextGen Tech · Jul 2020 - May 2022</p>
                <p className="text-xs text-slate-600 leading-relaxed dark:text-slate-350 pt-1">
                  Collaborated on web application components using HTML, CSS, and vanilla JS. Maintained legacy styles sheets.
                </p>
              </div>
            </div>
          </DashboardCard>

          {/* Education */}
          <DashboardCard className="p-5 space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              Education
            </h3>
            <div className="space-y-1.5">
              <h4 className="text-xs font-black text-slate-900 dark:text-white">Bachelor of Engineering in Computer Science</h4>
              <p className="text-[11px] font-bold text-slate-400">Visvesvaraya Technological University (VTU) · Graduated 2020</p>
            </div>
          </DashboardCard>

          {/* Verified Resume display */}
          <DashboardCard className="p-5 space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              Resume Attachment
            </h3>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-pink-50 dark:bg-pink-950/20 text-[#6B2C91] dark:text-pink-300 flex items-center justify-center">
                  <FileText className="size-5 text-pink-500" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">{profile.resume.name}</p>
                  <p className="text-[10px] text-slate-400 font-semibold">Uploaded {profile.resume.uploadDate} · Verified candidate</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-8 gap-1 text-[11px] font-bold text-[#6B2C91] dark:text-pink-200"
              >
                <Download className="size-3.5" />
                Download
              </Button>
            </div>
          </DashboardCard>
        </div>

        {/* Right side: Application Action Control Card */}
        <div className="space-y-6">
          <DashboardCard className="p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              Application Actions
            </h3>

            {/* Pipeline Stage Switches */}
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
                onClick={() => setShowScheduler(!showScheduler)}
                variant="outline"
                className={cn(
                  "w-full h-9 font-bold text-xs justify-start gap-2 cursor-pointer",
                  profile.status === "Interview Scheduled" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300"
                )}
              >
                <Calendar className="size-4 text-emerald-500" />
                {isScheduled ? "Reschedule Interview" : "Schedule Interview"}
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
                Select Candidate (Offer Job)
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

            {/* Scheduler Panel dropdown form */}
            {showScheduler && (
              <form onSubmit={handleScheduleSubmit} className="border-t border-slate-100 pt-4 space-y-3 dark:border-slate-800 select-none">
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Configure Interview Slot</p>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Date</label>
                    <input
                      type="date"
                      required
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus-visible:outline-none dark:border-slate-850 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Time</label>
                    <input
                      type="time"
                      required
                      value={interviewTime}
                      onChange={(e) => setInterviewTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus-visible:outline-none dark:border-slate-850 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Interviewer</label>
                    <input
                      type="text"
                      required
                      value={interviewerName}
                      onChange={(e) => setInterviewerName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus-visible:outline-none dark:border-slate-850 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1.5">
                  <Button
                    type="submit"
                    className="h-8 text-[10px] font-extrabold bg-[#6B2C91] text-white hover:bg-[#5a237b] dark:bg-pink-600 dark:hover:bg-pink-700 cursor-pointer"
                  >
                    Confirm Interview
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowScheduler(false)}
                    className="h-8 text-[10px] font-bold"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {isScheduled && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg text-xs font-bold space-y-1 select-none border border-emerald-100 dark:border-emerald-950/50">
                <p className="flex items-center gap-1">
                  <CheckCircle className="size-4 stroke-[3]" />
                  Interview Scheduled
                </p>
                <p className="text-[10px] text-slate-500">
                  Date: {interviewDate} @ {interviewTime}
                </p>
                <p className="text-[10px] text-slate-500">
                  Interviewer: {interviewerName}
                </p>
              </div>
            )}
          </DashboardCard>

          {/* Quick Specifications */}
          <DashboardCard className="p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
              Candidate Details
            </h3>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Total Experience</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{profile.experience}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Current Salary (CTC)</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{profile.currentCtc}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Expected Salary (CTC)</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{profile.expectedCtc}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Availability / Availability</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{profile.availability}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Notice Period</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{profile.noticePeriod}</p>
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  )
}
export default CandidatePreview
