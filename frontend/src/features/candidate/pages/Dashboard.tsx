import { useState, useEffect } from "react"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { CandidateInformationCard } from "@/components/dashboard/CandidateInformationCard"
import { CareerBreakCard } from "@/components/dashboard/CareerBreakCard"
import { MyApplications } from "@/components/dashboard/MyApplications"
import { ProfileStrengthCard } from "@/components/dashboard/ProfileStrengthCard"
import { QuickFilters } from "@/components/dashboard/QuickFilters"
import { RecommendedJobs } from "@/components/dashboard/RecommendedJobs"
import { ResumeCard } from "@/components/dashboard/ResumeCard"
import { useAuth } from "@/hooks/useAuth"
import { candidateApi } from "../services/candidateApi"
import { CandidateJobsApi, mapApiApplication } from "../services/jobsApi"
import type { ExtendedJob } from "@/types/job"
import type { Activity } from "@/types/dashboard"

export function Dashboard() {
  const { user } = useAuth()
  const name = user?.fullName?.split(" ")[0] || "Candidate"

  const [profile, setProfile] = useState<any>(null)
  const [applications, setApplications] = useState<any[]>([])
  const [recommendedJobs, setRecommendedJobs] = useState<ExtendedJob[]>([])
  const [savedJobIds, setSavedJobIds] = useState<string[]>([])
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [prof, apps, recs, saved] = await Promise.all([
          candidateApi.getProfile(),
          CandidateJobsApi.getApplications(),
          CandidateJobsApi.getRecommendations(),
          CandidateJobsApi.getSavedJobs(),
        ])

        const extendedProfile = {
          fullName: prof?.fullName || user?.fullName || "Candidate",
          role: prof?.title || "Professional",
          location: prof?.bio || "Not Specified",
          email: user?.email || "",
          phone: prof?.phone || "Not Specified",
          experience: prof?.noticePeriod || "Not Specified",
          currentCtc: prof?.expectedSalary || "Not Specified",
          expectedCtc: prof?.expectedSalary || "Not Specified",
          availability: "Immediate",
          noticePeriod: prof?.noticePeriod || "Immediate",
          profileCompletion: 85,
          skills: (prof?.skills || []).map((s: any) => s.skill?.name || s.name || s),
          languages: prof?.languages || ["English"],
          socialLinks: prof?.socialLinks || [],
          careerBreak: {
            hasBreak: true,
            reason: "Maternity Leave",
            duration: "2 Years",
            summary: "Focused on parenting and upskilling in modern technologies."
          },
          resume: {
            name: prof?.resumeUrl ? "Resume_latest.pdf" : "Not Uploaded",
            uploadDate: "Just now",
            verified: !!prof?.resumeUrl
          }
        }

        setProfile(extendedProfile)
        setApplications(apps.map(mapApiApplication))
        setRecommendedJobs(recs)
        setSavedJobIds(saved.map(s => s.id))
        setAppliedJobIds(apps.map(a => a.jobId))

        const mappedActivities: Activity[] = apps.map((app: any) => ({
          id: app.id,
          title: `Application ${app.status}`,
          description: `You applied to ${app.job?.title || "Untitled Role"} at ${app.job?.company?.name || "Unknown Company"}`,
          time: "Just now",
          type: app.status === "Rejected" ? "rejected" : "submitted"
        }))
        setActivities(mappedActivities)
      } catch (err) {
        console.error("Failed to load dashboard details", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [user])

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading candidate workspace...</div>
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Welcome back, {name} 👋
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Let's find your next opportunity today.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 2xl:col-span-7">
          <CandidateInformationCard candidate={profile} />
        </div>
        <div className="lg:col-span-5 xl:col-span-2 2xl:col-span-2">
          <ProfileStrengthCard completion={profile?.profileCompletion} />
        </div>
        <div className="grid gap-4 lg:col-span-12 xl:col-span-3 2xl:col-span-3">
          <CareerBreakCard careerBreak={profile?.careerBreak} />
          <ResumeCard resume={profile?.resume} />
        </div>
      </section>

      <QuickFilters />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <RecommendedJobs
            jobs={recommendedJobs}
            savedJobs={savedJobIds}
            appliedJobs={appliedJobIds}
          />
          <MyApplications applications={applications} />
        </div>
        <aside className="space-y-5">
          <ActivityFeed activities={activities} />
          <div className="rounded-xl border border-violet-200 bg-gradient-to-r from-pink-50 to-violet-50 p-4 text-center shadow-[0_8px_28px_rgba(107,44,145,0.08)] dark:border-violet-400/20 dark:from-pink-500/10 dark:to-violet-500/15">
            <p className="text-sm font-black text-[#6B2C91] dark:text-pink-100">
              {profile?.profileCompletion || 0}% profile completion
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
              Premium partner jobs are prioritized for complete profiles.
            </p>
          </div>
        </aside>
      </section>
    </div>
  )
}
