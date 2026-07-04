import React, { useRef } from "react"
import { Camera, Trash2 } from "lucide-react"

interface ProfileImageUploaderProps {
  label?: string
  imageUrl?: string
  initials?: string
  onUpload?: (file: File) => void
  onRemove?: () => void
}

export function ProfileImageUploader({
  label = "Profile Image",
  imageUrl,
  initials = "PS",
  onUpload,
  onRemove,
}: ProfileImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onUpload) {
      onUpload(file)
    }
  }

  return (
    <div className="space-y-1.5 w-full col-span-2 select-none flex flex-col items-center">
      {label && (
        <span className="text-xs font-black text-slate-800 dark:text-slate-200 self-start">
          {label}
        </span>
      )}
      <input
        type="file"
        ref={fileRef}
        onChange={handleChange}
        accept="image/*"
        className="hidden"
      />

      <div className="relative group size-20 rounded-full border-2 border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 overflow-hidden flex items-center justify-center shadow-sm">
        {imageUrl ? (
          <img src={imageUrl} alt="Profile preview" className="size-full object-cover" />
        ) : (
          <span className="text-lg font-black text-[#6B2C91] dark:text-pink-300">
            {initials}
          </span>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
        >
          <Camera className="size-5" />
        </button>
      </div>

      {imageUrl && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-[10px] font-black text-red-500 hover:text-red-700 flex items-center gap-1 mt-1 cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          Remove Image
        </button>
      )}
    </div>
  )
}
export default ProfileImageUploader
