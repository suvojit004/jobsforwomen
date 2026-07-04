import { useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Calendar,
  DollarSign,
  Award,
  Users,
  Clock,
  Heart,
  Edit2,
  Trash2,
  Pause,
  Play,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { JobPostingForm } from "../components/JobPostingForm"
import { cn } from "@/lib/utils"

interface JobDetail {
  id: string
  title: string
  department: string
  workMode: "Remote" | "Hybrid" | "On-site"
  type: string
  location: string
  salary: string
  experience: string
  skills: string[]
  description: string
  responsibilities: string
  requirements: string
  benefits: string
  deadline: string
  menstrualLeaveChampion: boolean
  flexibleHours: boolean
  workFromHome: boolean
  status: "Active" | "Paused" | "Closed"
  applicants: number
  postedOn: string
}

export function JobDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)

  // Load the current job
  const [job, setJob] = useState<JobDetail | null>(() => {
    const initialJobs: JobDetail[] = [
      {
        id: "job-p1",
        title: "Frontend Developer",
        department: "Engineering",
        workMode: "Remote",
        type: "Full Time",
        location: "Remote",
        salary: "₹8 - 12 LPA",
        experience: "2+ Years",
        skills: ["React", "TypeScript", "Tailwind CSS", "REST APIs"],
        description: "We are looking for a skilled Frontend Developer to build clean, responsive user interfaces. You will work closely with design and product teams to implement premium layouts and dynamic animations.",
        responsibilities: "- Architect scalable web components\n- Optimize frontend rendering cycles\n- Collaborate with backend engineers on API contracts\n- Author end-to-end tests",
        requirements: "- Strong proficiency in React and TypeScript\n- Experience building interfaces using Tailwind CSS\n- Understanding of client-side caching and state management\n- Passion for clean typography and aesthetics",
        benefits: "- Comprehensive healthcare package\n- Flexible work-from-home configurations\n- Paid menstrual leave support (1 day/month)\n- Learning and certification allowances",
        deadline: "30 June 2025",
        menstrualLeaveChampion: true,
        flexibleHours: true,
        workFromHome: true,
        status: "Active",
        applicants: 15,
        postedOn: "12 May 2025",
      },
      {
        id: "job-p2",
        title: "UI/UX Designer",
        department: "Design",
        workMode: "Hybrid",
        type: "Full Time",
        location: "Bengaluru",
        salary: "₹10 - 15 LPA",
        experience: "3+ Years",
        skills: ["Figma", "Design Systems", "Prototyping", "UX Research"],
        description: "Join us as a UI/UX designer to craft beautiful customer experiences. You will design, test, and iterate product templates and maintain our shared interface design systems.",
        responsibilities: "- Create wireframes and functional interactive prototypes\n- Perform usability studies and user research sessions\n- Establish unified layout systems\n- Present visual findings directly to stakeholders",
        requirements: "- Portfolio showcasing state-of-the-art web products\n- Advanced mastery of Figma variables and components\n- Ability to think through complex flow architectures\n- Basic knowledge of frontend margins and layout boxes",
        benefits: "- Hybrid workspace setup (2 days/week on-site)\n- Paid menstrual leave support\n- Wellness and physical fitness stipends\n- Mentorship and growth track mapping",
        deadline: "25 June 2025",
        menstrualLeaveChampion: true,
        flexibleHours: true,
        workFromHome: true,
        status: "Active",
        applicants: 12,
        postedOn: "11 May 2025",
      },
      {
        id: "job-p3",
        title: "Product Manager",
        department: "Management",
        workMode: "On-site",
        type: "Full Time",
        location: "Bengaluru",
        salary: "₹15 - 22 LPA",
        experience: "4+ Years",
        skills: ["Product Strategy", "Agile Roadmap", "Data Analytics", "Customer Interviews"],
        description: "We are hiring a Product Manager to direct product roadmaps and prioritize feature releases. You will lead cross-functional engineering, design, and marketing teams to release updates.",
        responsibilities: "- Author product requirement specifications\n- Monitor product analytics metrics and conversion funnels\n- Gather qualitative customer feedback\n- Establish team scrum sprint planning schedules",
        requirements: "- Experience launching tech-focused B2C SaaS platforms\n- Strong background in data analytics and telemetry queries\n- Exceptional presentation and writing abilities\n- Empathy-driven mindset for team builders",
        benefits: "- Flexible working hours\n- Paid menstrual leave champion allowance\n- High-spec equipment budgets\n- Free catered office meals",
        deadline: "20 June 2025",
        menstrualLeaveChampion: true,
        flexibleHours: true,
        workFromHome: false,
        status: "Active",
        applicants: 9,
        postedOn: "08 May 2025",
      },
      {
        id: "job-p4",
        title: "Content Writer",
        department: "Marketing",
        workMode: "Remote",
        type: "Part Time",
        location: "Remote",
        salary: "₹4 - 6 LPA",
        experience: "1+ Years",
        skills: ["Copywriting", "SEO Optimization", "Content Strategy", "Social Media"],
        description: "We want a Part-Time Content Writer to construct high-quality corporate guides, blog articles, and newsletters targeted at women looking to restart their professional careers.",
        responsibilities: "- Author bi-weekly community newsletters\n- Create SEO-optimized content checklists\n- Collaborate with graphic designers on landing page taglines\n- Moderate social media discussions",
        requirements: "- Portfolio of writing content pieces or technical articles\n- Familiarity with SEO and keywords research systems\n- Self-starting calendar management discipline\n- Fluent editorial grammar skills",
        benefits: "- 100% remote flexible operations\n- Menstrual leave support badge qualification\n- Training and copywriting certifications budget",
        deadline: "15 June 2025",
        menstrualLeaveChampion: true,
        flexibleHours: true,
        workFromHome: true,
        status: "Paused",
        applicants: 6,
        postedOn: "05 May 2025",
      },
      {
        id: "job-p5",
        title: "Digital Marketing Executive",
        department: "Marketing",
        workMode: "Hybrid",
        type: "Full Time",
        location: "Bengaluru",
        salary: "₹6 - 9 LPA",
        experience: "2+ Years",
        skills: ["Google Ads", "Social Media Marketing", "Email Campaigns", "KPI Reports"],
        description: "Join us as a Digital Marketing Executive to direct advertisement budgets and design outreach newsletters to help women returnship applicants connect with corporate partners.",
        responsibilities: "- Construct and audit social media advertising budgets\n- Create email workflow sequences\n- Track conversion click metrics\n- Design campaign landing page layouts",
        requirements: "- Experience launching paid acquisition ads\n- Familiarity with email outreach systems\n- Basic spreadsheet analytics capabilities\n- Strong verbal and graphical communication",
        benefits: "- Hybrid workspaces (3 days home, 2 office)\n- Paid menstrual leave support\n- Learning allowances",
        deadline: "10 June 2025",
        menstrualLeaveChampion: true,
        flexibleHours: true,
        workFromHome: true,
        status: "Active",
        applicants: 6,
        postedOn: "02 May 2025",
      },
    ]

    // Load custom jobs
    const storedCustomJobs = localStorage.getItem("recruiterJobs")
    const customJobs = storedCustomJobs ? JSON.parse(storedCustomJobs) : []

    // Load overrides
    const storedOverrides = localStorage.getItem("recruiterJobsOverrides")
    const overrides = storedOverrides ? JSON.parse(storedOverrides) : []

    const allJobs = [...customJobs, ...initialJobs].map((j: any) => {
      const match = overrides.find((o: any) => o.id === j.id)
      return match ? { ...j, ...match } : j
    })

    const found = allJobs.find((j) => j.id === id)
    return found ? (found as JobDetail) : null
  })

  if (!job) {
    return (
      <div className="py-12 max-w-md mx-auto text-center space-y-4">
        <AlertCircle className="size-12 text-slate-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Posting Not Found</h2>
        <p className="text-sm text-slate-500">We couldn't locate the job posting details you requested.</p>
        <Button onClick={() => navigate("/recruiter/manage-jobs")}>Back to Listings</Button>
      </div>
    )
  }

  // Handle Editing form submission
  const handleEditSubmit = (values: any) => {
    // Convert comma-separated string back to array
    const skillList = typeof values.skills === "string"
      ? values.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
      : values.skills

    const updatedJob: JobDetail = {
      ...job,
      title: values.title,
      department: values.department,
      location: values.location,
      salary: values.salary,
      experience: values.experience,
      type: values.type,
      workMode: values.workMode,
      skills: skillList,
      description: values.description,
      responsibilities: values.responsibilities,
      requirements: values.requirements,
      benefits: values.benefits,
      deadline: values.deadline,
      menstrualLeaveChampion: values.menstrualLeaveChampion,
      flexibleHours: values.flexibleHours,
      workFromHome: values.workFromHome,
    }

    setJob(updatedJob)

    // Save changes back to LocalStorage
    if (job.id.startsWith("job-custom-")) {
      const storedCustomJobs = localStorage.getItem("recruiterJobs")
      const customJobs = storedCustomJobs ? JSON.parse(storedCustomJobs) : []
      const updatedCustom = customJobs.map((j: any) => (j.id === job.id ? updatedJob : j))
      localStorage.setItem("recruiterJobs", JSON.stringify(updatedCustom))
    } else {
      // Save overrides for default jobs
      const storedOverrides = localStorage.getItem("recruiterJobsOverrides")
      const overrides = storedOverrides ? JSON.parse(storedOverrides) : []
      const existingIdx = overrides.findIndex((o: any) => o.id === job.id)

      const payload = {
        id: job.id,
        title: values.title,
        department: values.department,
        location: values.location,
        salary: values.salary,
        experience: values.experience,
        type: values.type,
        workMode: values.workMode,
        skills: skillList,
        description: values.description,
        responsibilities: values.responsibilities,
        requirements: values.requirements,
        benefits: values.benefits,
        deadline: values.deadline,
        menstrualLeaveChampion: values.menstrualLeaveChampion,
        flexibleHours: values.flexibleHours,
        workFromHome: values.workFromHome,
        status: job.status,
      }

      if (existingIdx > -1) {
        overrides[existingIdx] = { ...overrides[existingIdx], ...payload }
      } else {
        overrides.push(payload)
      }
      localStorage.setItem("recruiterJobsOverrides", JSON.stringify(overrides))
    }

    setTimeout(() => {
      setIsEditing(false)
    }, 1500)
  }

  // Toggle active/paused state
  const handleToggleStatus = () => {
    const nextStatus = job.status === "Active" ? "Paused" : "Active"
    const updatedJob: JobDetail = { ...job, status: nextStatus as "Active" | "Paused" }
    setJob(updatedJob)

    if (job.id.startsWith("job-custom-")) {
      const storedCustomJobs = localStorage.getItem("recruiterJobs")
      const customJobs = storedCustomJobs ? JSON.parse(storedCustomJobs) : []
      const updatedCustom = customJobs.map((j: any) => (j.id === job.id ? updatedJob : j))
      localStorage.setItem("recruiterJobs", JSON.stringify(updatedCustom))
    } else {
      const storedOverrides = localStorage.getItem("recruiterJobsOverrides")
      const overrides = storedOverrides ? JSON.parse(storedOverrides) : []
      const existingIdx = overrides.findIndex((o: any) => o.id === job.id)
      if (existingIdx > -1) {
        overrides[existingIdx].status = nextStatus
      } else {
        overrides.push({ id: job.id, status: nextStatus })
      }
      localStorage.setItem("recruiterJobsOverrides", JSON.stringify(overrides))
    }
  }

  // Delete posting
  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this job posting? This cannot be undone.")) {
      if (job.id.startsWith("job-custom-")) {
        const storedCustomJobs = localStorage.getItem("recruiterJobs")
        const customJobs = storedCustomJobs ? JSON.parse(storedCustomJobs) : []
        const filtered = customJobs.filter((j: any) => j.id !== job.id)
        localStorage.setItem("recruiterJobs", JSON.stringify(filtered))
      } else {
        const storedOverrides = localStorage.getItem("recruiterJobsOverrides")
        const overrides = storedOverrides ? JSON.parse(storedOverrides) : []
        const existingIdx = overrides.findIndex((o: any) => o.id === job.id)
        if (existingIdx > -1) {
          overrides[existingIdx].status = "Closed" // Mark closed/deleted
        } else {
          overrides.push({ id: job.id, status: "Closed" })
        }
        localStorage.setItem("recruiterJobsOverrides", JSON.stringify(overrides))
      }
      navigate("/recruiter/manage-jobs")
    }
  }

  // Map values for the posting form
  const initialFormValues = {
    title: job.title,
    department: job.department,
    location: job.location,
    salary: job.salary,
    experience: job.experience,
    type: job.type as "Full Time" | "Part Time",
    workMode: job.workMode as "Remote" | "Hybrid" | "On-site",
    skills: job.skills.join(", "),
    description: job.description,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    benefits: job.benefits,
    deadline: job.deadline,
    menstrualLeaveChampion: job.menstrualLeaveChampion,
    flexibleHours: job.flexibleHours,
    workFromHome: job.workFromHome,
  }

  // Generate bullet lists helper
  const renderList = (text: string) => {
    return text
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item, idx) => {
        const cleanItem = item.startsWith("-") ? item.substring(1).trim() : item
        return (
          <li key={idx} className="text-xs font-semibold text-slate-700 leading-relaxed dark:text-slate-300 flex items-start gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6B2C91] dark:bg-pink-400 mt-1.5 shrink-0" />
            {cleanItem}
          </li>
        )
      })
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <div>
        <Link
          to="/recruiter/manage-jobs"
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
        >
          <ArrowLeft className="size-3.5" />
          Back to Listings
        </Link>
      </div>

      {isEditing ? (
        /* Edit Form mode */
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-black text-slate-950 dark:text-white">Edit Job Posting</h1>
            <p className="text-xs font-bold text-slate-500">Modify details for "{job.title}" below.</p>
          </div>
          <JobPostingForm
            onSubmit={handleEditSubmit}
            initialValues={initialFormValues}
            submitLabel="Save Specifications"
          />
        </div>
      ) : (
        /* Standard detail viewer mode */
        <div className="space-y-6">
          {/* Header Action Card */}
          <DashboardCard className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-950 truncate dark:text-white">
                    {job.title}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex h-5 items-center rounded-md px-2 text-[10px] font-black uppercase ring-1 ring-inset shrink-0",
                      job.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300"
                    )}
                  >
                    {job.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
                  <span className="uppercase text-[#6B2C91] dark:text-pink-300 font-extrabold">{job.department}</span>
                  <span>•</span>
                  <span>{job.location} ({job.workMode})</span>
                  <span>•</span>
                  <span>Posted {job.postedOn}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  className="h-9 font-bold text-xs gap-1.5 cursor-pointer"
                >
                  <Edit2 className="size-4" />
                  Edit Posting
                </Button>
                <Button
                  onClick={handleToggleStatus}
                  variant="outline"
                  className="h-9 font-bold text-xs gap-1.5 cursor-pointer"
                >
                  {job.status === "Active" ? (
                    <>
                      <Pause className="size-4" />
                      Pause Posting
                    </>
                  ) : (
                    <>
                      <Play className="size-4" />
                      Activate Posting
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDelete}
                  variant="ghost"
                  className="h-9 font-bold text-xs gap-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </div>
          </DashboardCard>

          {/* Statistics Grid */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[
              { label: "Total Applicants", value: job.applicants, icon: Users, color: "text-[#6B2C91]" },
              { label: "Shortlisted", value: Math.ceil(job.applicants * 0.4), icon: Award, color: "text-blue-500" },
              { label: "Interviews", value: Math.ceil(job.applicants * 0.15), icon: Calendar, color: "text-emerald-500" },
              { label: "Hired/Offered", value: Math.ceil(job.applicants * 0.05), icon: CheckCircle, color: "text-amber-500" },
            ].map((stat, idx) => {
              const Icon = stat.icon
              return (
                <DashboardCard key={idx} className="p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">{stat.label}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{stat.value}</p>
                  </div>
                  <Icon className={cn("size-5", stat.color)} />
                </DashboardCard>
              )
            })}
          </div>

          {/* Details Content Columns */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left side specs details */}
            <div className="md:col-span-2 space-y-6">
              {/* Description */}
              <DashboardCard className="p-5 space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
                  Job Description
                </h3>
                <p className="text-xs leading-relaxed text-slate-700 font-semibold dark:text-slate-300">
                  {job.description}
                </p>
              </DashboardCard>

              {/* Responsibilities */}
              <DashboardCard className="p-5 space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
                  Responsibilities
                </h3>
                <ul className="space-y-2">
                  {renderList(job.responsibilities)}
                </ul>
              </DashboardCard>

              {/* Requirements */}
              <DashboardCard className="p-5 space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
                  Requirements
                </h3>
                <ul className="space-y-2">
                  {renderList(job.requirements)}
                </ul>
              </DashboardCard>

              {/* Benefits */}
              <DashboardCard className="p-5 space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
                  Benefits & Perks
                </h3>
                <ul className="space-y-2">
                  {renderList(job.benefits)}
                </ul>
              </DashboardCard>
            </div>

            {/* Right side specifications summary sidebar */}
            <div className="space-y-6">
              {/* Job Specification Card */}
              <DashboardCard className="p-5 space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
                  Job Specifications
                </h3>

                <div className="space-y-3.5">
                  <div className="flex items-center gap-3">
                    <Briefcase className="size-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Employment Type</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{job.type}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <MapPin className="size-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Work Mode</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{job.workMode}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <DollarSign className="size-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Salary Package</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{job.salary}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="size-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Experience Required</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{job.experience}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="size-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Application Deadline</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{job.deadline}</p>
                    </div>
                  </div>
                </div>
              </DashboardCard>

              {/* Progressive Policies Status */}
              <DashboardCard className="p-5 space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
                  Equality Indicators
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600 dark:text-slate-400">Menstrual Leave Support</span>
                    {job.menstrualLeaveChampion ? (
                      <span className="rounded-full bg-pink-50 dark:bg-pink-950/20 text-pink-500 px-2 py-0.5 text-[10px] font-black uppercase flex items-center gap-1">
                        <Heart className="size-3 fill-pink-500" />
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 text-slate-400 px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600 dark:text-slate-400">Flexible Shift Hours</span>
                    {job.flexibleHours ? (
                      <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 text-slate-400 px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600 dark:text-slate-400">Work from Home Stipends</span>
                    {job.workFromHome ? (
                      <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 text-slate-400 px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              </DashboardCard>

              {/* View Applicants Shortcut */}
              <DashboardCard className="p-4 bg-gradient-to-r from-violet-50/50 to-pink-50/50 border border-violet-100 dark:from-violet-950/20 dark:to-pink-950/10 dark:border-violet-400/20 flex items-center justify-between select-none">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Applicant Log</p>
                  <p className="text-xs font-black text-slate-900 dark:text-white">Inspect application pipeline</p>
                </div>
                <Button
                  onClick={() => navigate(`/recruiter/applicants?jobId=${job.id}`)}
                  className="bg-[#6B2C91] text-white hover:bg-[#5a237b] h-8 px-3 font-extrabold text-[10px] gap-1 cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700"
                >
                  View candidates
                  <ArrowRight className="size-3" />
                </Button>
              </DashboardCard>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default JobDetails
