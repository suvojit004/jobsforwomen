import { useNavigate } from "react-router-dom"
import { JobPostingForm } from "../components/JobPostingForm"

export function PostJob() {
  const navigate = useNavigate()

  const handleFormSubmit = (values: any) => {
    // Generate a unique ID for the new job
    const newJobId = `job-custom-${Date.now()}`

    // Parse skills from a comma-separated string to an array
    const skillList = values.skills
      ? values.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
      : []

    // Build the Job object
    const newJob = {
      id: newJobId,
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
      status: "Active",
      applicants: 0,
      postedOn: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    }

    // Save to LocalStorage
    const storedCustomJobs = localStorage.getItem("recruiterJobs")
    const customJobs = storedCustomJobs ? JSON.parse(storedCustomJobs) : []
    localStorage.setItem("recruiterJobs", JSON.stringify([newJob, ...customJobs]))

    // Delayed navigation back to Recruiter Dashboard
    setTimeout(() => {
      navigate("/recruiter/dashboard")
    }, 1500)
  }

  const handleSaveDraft = (values: any) => {
    localStorage.setItem("jobPostingDraft", JSON.stringify(values))
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Post a New Career Opportunity
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Reach thousands of qualified female professionals looking for returnships, hybrid, and progressive roles.
        </p>
      </div>

      <JobPostingForm onSubmit={handleFormSubmit} onSaveDraft={handleSaveDraft} />
    </div>
  )
}
export default PostJob
