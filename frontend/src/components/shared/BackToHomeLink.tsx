import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"

// A small "back" affordance for the standalone auth pages (Login, Candidate
// Register, Recruiter Register) -- these pages sit outside the normal app
// shell (no navbar/sidebar), so there was previously no way back to the
// public landing page except the browser's own back button. Always points
// at "/" rather than using browser history (navigate(-1)) since a user can
// land here directly (shared link, bookmark) with no in-app history to go
// back to.
export function BackToHomeLink() {
  return (
    <Link
      to="/"
      className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:text-[#6B2C91] dark:text-slate-400 dark:hover:text-pink-300 sm:left-6 sm:top-6"
    >
      <ArrowLeft className="size-4" />
      Back to Home
    </Link>
  )
}

export default BackToHomeLink
