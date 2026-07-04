import { Mail, MapPin, Phone, Edit3, Check, X } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import type { ExtendedCandidate } from "../../types/candidate"

type ProfileHeaderProps = {
  candidate: ExtendedCandidate
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

export function ProfileHeader({
  candidate,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: ProfileHeaderProps) {
  // Generate initials
  const initials = candidate.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase()

  return (
    <DashboardCard className="p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="size-24 border-2 border-violet-100 dark:border-slate-800">
            <AvatarFallback className="bg-gradient-to-br from-pink-100 via-white to-violet-200 text-2xl font-bold text-[#6B2C91] dark:from-pink-500/20 dark:via-slate-900 dark:to-violet-500/25 dark:text-pink-100">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-slate-950 dark:text-white">
              {candidate.fullName}
            </h1>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {candidate.role}
            </p>
            <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="size-3.5" />
              {candidate.location}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-pink-500" />
                {candidate.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5 text-pink-500" />
                {candidate.phone}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-extrabold text-[#6B2C91] ring-1 ring-violet-100 dark:bg-violet-500/20 dark:text-pink-100 dark:ring-violet-400/20">
              Profile Strength: <strong>{candidate.profileCompletion}%</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button
                type="button"
                onClick={onEdit}
                className="bg-[#6B2C91] text-white hover:bg-[#5a237b]"
              >
                <Edit3 className="mr-1.5 size-4" />
                Edit Profile
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <X className="mr-1.5 size-4" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={onSave}
                  className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                >
                  <Check className="mr-1.5 size-4" />
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}
