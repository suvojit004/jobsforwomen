import { useRef, useState } from "react"
import { toast } from "sonner"
import { Mail, MapPin, Phone, Edit3, Check, X, Camera, Loader2, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import type { ExtendedCandidate } from "../../types/candidate"

const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2MB, matches backend uploadAvatarMiddleware limit

type ProfileHeaderProps = {
  candidate: ExtendedCandidate
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onUploadAvatar?: (file: File) => Promise<any>
  onDeleteAvatar?: () => Promise<any>
}

export function ProfileHeader({
  candidate,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onUploadAvatar,
  onDeleteAvatar,
}: ProfileHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Generate initials
  const initials = candidate.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase()

  const handlePickFile = () => {
    if (isUploading || isDeleting) return
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset the input immediately so selecting the same file again still fires onChange
    e.target.value = ""
    if (!file || !onUploadAvatar) return

    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Unsupported file type. Please upload a JPEG, PNG, GIF, or WEBP image.")
      return
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      toast.error("File is too large. Maximum photo size is 2MB.")
      return
    }

    setIsUploading(true)
    try {
      await onUploadAvatar(file)
      toast.success("Profile photo updated successfully.")
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload profile photo. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteAvatar = async () => {
    if (isUploading || isDeleting || !onDeleteAvatar) return
    if (!window.confirm("Remove your profile photo?")) return
    setIsDeleting(true)
    try {
      await onDeleteAvatar()
      toast.success("Profile photo removed successfully.")
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove profile photo. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <DashboardCard className="p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="group/avatar-upload relative shrink-0">
            <Avatar className="size-24 border-2 border-violet-100 dark:border-slate-800">
              {candidate.avatarUrl && <AvatarImage src={candidate.avatarUrl} alt={candidate.fullName} />}
              <AvatarFallback className="bg-gradient-to-br from-pink-100 via-white to-violet-200 text-2xl font-bold text-[#6B2C91] dark:from-pink-500/20 dark:via-slate-900 dark:to-violet-500/25 dark:text-pink-100">
                {initials}
              </AvatarFallback>
            </Avatar>
            {onUploadAvatar && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileSelected}
                />
                <button
                  type="button"
                  onClick={handlePickFile}
                  disabled={isUploading || isDeleting}
                  title={candidate.avatarUrl ? "Replace photo" : "Upload photo"}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/0 text-white opacity-0 transition-opacity duration-150 hover:bg-slate-950/45 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none disabled:cursor-not-allowed"
                >
                  {isUploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
                </button>
                {candidate.avatarUrl && onDeleteAvatar && (
                  <button
                    type="button"
                    onClick={handleDeleteAvatar}
                    disabled={isUploading || isDeleting}
                    title="Remove photo"
                    className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-2 border-white bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed dark:border-slate-900"
                  >
                    {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </button>
                )}
              </>
            )}
          </div>
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
              {/* a long, unbroken email has no natural wrap point,
                  so it could stretch this row wider than the card on narrow
                  screens -- break-all lets it wrap mid-string instead. */}
              <span className="flex items-center gap-1.5 min-w-0 break-all">
                <Mail className="size-3.5 text-pink-500 shrink-0" />
                {candidate.email}
              </span>
              <span className="flex items-center gap-1.5 min-w-0 break-all">
                <Phone className="size-3.5 text-pink-500 shrink-0" />
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
