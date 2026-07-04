import { Bell, Bookmark, BriefcaseBusiness, Send } from "lucide-react"
import { EmptyState } from "@/components/shared/EmptyState"

export function NoApplicationsState() {
  return (
    <EmptyState
      icon={Send}
      title="No Applications"
      description="Your submitted applications will appear here once you start applying to jobs."
      actionLabel="Find Jobs"
    />
  )
}

export function NoSavedJobsState() {
  return (
    <EmptyState
      icon={Bookmark}
      title="No Saved Jobs"
      description="Save roles you want to revisit and compare them from one place."
      actionLabel="Browse Jobs"
    />
  )
}

export function NoNotificationsState() {
  return (
    <EmptyState
      icon={Bell}
      title="No Notifications"
      description="Profile views, application updates, and interview reminders will appear here."
    />
  )
}

export function NoRecommendedJobsState() {
  return (
    <EmptyState
      icon={BriefcaseBusiness}
      title="No Recommended Jobs"
      description="Complete your profile and choose filters to receive curated job recommendations."
      actionLabel="Browse Jobs"
    />
  )
}
