import { Bell, Bookmark, BriefcaseBusiness, Send } from "lucide-react"
import { EmptyState } from "@/components/shared/EmptyState"

type EmptyStateActionProps = {
  onActionClick?: () => void
}

export function NoApplicationsState({ onActionClick }: EmptyStateActionProps = {}) {
  return (
    <EmptyState
      icon={Send}
      title="No Applications"
      description="Your submitted applications will appear here once you start applying to jobs."
      actionLabel="Find Jobs"
      onActionClick={onActionClick}
    />
  )
}

export function NoSavedJobsState({ onActionClick }: EmptyStateActionProps = {}) {
  return (
    <EmptyState
      icon={Bookmark}
      title="No Saved Jobs"
      description="Save roles you want to revisit and compare them from one place."
      actionLabel="Browse Jobs"
      onActionClick={onActionClick}
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

export function NoRecommendedJobsState({ onActionClick }: EmptyStateActionProps = {}) {
  return (
    <EmptyState
      icon={BriefcaseBusiness}
      title="No Recommended Jobs"
      description="Complete your profile and choose filters to receive curated job recommendations."
      actionLabel="Browse Jobs"
      onActionClick={onActionClick}
    />
  )
}
