import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { JobPostingForm } from "../components/JobPostingForm"
import { RecruiterApi } from "../services/recruiterApi"

export function PostJob() {
  const navigate = useNavigate()

  const handleFormSubmit = async (values: any) => {
    try {
      await RecruiterApi.createJob(values)
      toast.success("Job posted successfully. It's now pending admin approval.")
      setTimeout(() => {
        navigate("/recruiter/manage-jobs")
      }, 1200)
    } catch (err: any) {
      toast.error(err?.message || "Couldn't post this job. Please check the form and try again.")
    }
  }

  const handleSaveDraft = async (values: any) => {
    try {
      await RecruiterApi.saveDraft(values)
      toast.success("Draft saved.")
    } catch (err: any) {
      toast.error(err?.message || "Couldn't save draft. Please try again.")
    }
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
