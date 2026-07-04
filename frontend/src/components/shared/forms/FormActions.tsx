import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FormActionsProps {
  onCancel?: () => void
  cancelText?: string
  submitText?: string
  isSubmitting?: boolean
  className?: string
}

export function FormActions({
  onCancel,
  cancelText = "Cancel",
  submitText = "Save Specifications",
  isSubmitting = false,
  className,
}: FormActionsProps) {
  return (
    <div className={`flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 ${className || ""}`}>
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="h-9 font-extrabold text-xs px-4 cursor-pointer"
        >
          {cancelText}
        </Button>
      )}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="bg-[#6B2C91] hover:bg-[#5a237b] text-white font-extrabold text-xs h-9 px-5 gap-1.5 cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700"
      >
        {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
        {submitText}
      </Button>
    </div>
  )
}
export default FormActions
