import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { toast } from "sonner"
import { Building, Globe, MapPin, Briefcase, FileText, Upload, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/shared/Logo"
import { CompanyVerificationApi } from "../services/companyVerificationApi"
import { normalizeWebsite, isValidWebsite } from "@/utils/validators"

const DOCUMENT_CATEGORIES = [
  { value: "GST", label: "GST Certificate" },
  { value: "PAN", label: "PAN Card" },
  { value: "CIN", label: "CIN (Corporate Identity Number)" },
  { value: "CompanyRegistrationCertificate", label: "Company Registration Certificate" },
  { value: "WebsiteOwnershipProof", label: "Website Ownership Proof" },
  { value: "Other", label: "Other Document" },
]

interface VerificationDocument {
  url: string
  category: string
  uploadedAt: string
  version: number
}

// Public, unauthenticated page (Part 3 of the recruiter onboarding/approval
// spec) -- reached via the secure, single-use, expiring link in the "More
// Information Required" email (see email.listener.ts's CompanyInfoRequested
// handler). No login is involved; the token in the URL is the credential.
export function CompanyVerification() {
  const { token } = useParams<{ token: string }>()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null)

  const [companyName, setCompanyName] = useState("")
  const [website, setWebsite] = useState("")
  const [industryName, setIndustryName] = useState("")
  const [location, setLocation] = useState("")
  const [comment, setComment] = useState("")
  const [websiteError, setWebsiteError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  const [documents, setDocuments] = useState<VerificationDocument[]>([])
  const [selectedCategory, setSelectedCategory] = useState(DOCUMENT_CATEGORIES[0].value)

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setLoadError("This verification link is invalid.")
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const data = await CompanyVerificationApi.getByToken(token)
        setCompanyName(data.companyName || "")
        setWebsite(data.website || "")
        setIndustryName(data.industryName || "")
        setLocation(data.location || "")
        setFeedback(data.feedback || "")
        setDocuments(data.verificationDocuments || [])
      } catch (err: any) {
        setLoadError(err.message || "This verification link is invalid or has expired.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const handleUploadDocument = async (file: File) => {
    if (!token) return
    try {
      setUploadingCategory(selectedCategory)
      const doc = await CompanyVerificationApi.uploadDocument(token, file, selectedCategory)
      setDocuments((prev) => [...prev, doc])
      toast.success("Document uploaded successfully.")
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document.")
    } finally {
      setUploadingCategory(null)
    }
  }

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (!comment.trim()) {
      toast.error("Please add a comment describing what you updated.")
      return
    }

    // Website is the one field here with a real format (the backend's
    // resubmitCompanySchema uses `.url()`, which -- like CompanyProfile.tsx's
    // onboarding form -- requires a full URL with protocol). Validate and
    // normalize inline instead of letting a bare domain round-trip-fail.
    let normalizedWebsite: string | undefined
    if (website.trim()) {
      normalizedWebsite = normalizeWebsite(website)
      if (!isValidWebsite(normalizedWebsite)) {
        setWebsiteError("Please enter a valid website URL (e.g. company.com).")
        return
      }
    }
    setWebsiteError(null)

    try {
      setSubmitting(true)
      await CompanyVerificationApi.resubmit(token, {
        companyName: companyName || undefined,
        website: normalizedWebsite,
        industryName: industryName || undefined,
        location: location || undefined,
        comment,
      })
      setSubmitted(true)
    } catch (err: any) {
      toast.error(err.message || "Failed to resubmit verification details.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBFD] dark:bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#6B2C91]" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FDFBFD] px-4 text-center dark:bg-slate-950">
        <Logo />
        <p className="max-w-md text-sm font-bold text-slate-700 dark:text-slate-200">{loadError}</p>
        <p className="max-w-md text-xs font-semibold text-slate-450 dark:text-slate-500">
          If you believe this is a mistake, please contact your JobsForWomen account admin for a new link.
        </p>
        <Link to="/auth/login" className="text-sm font-extrabold text-[#6B2C91] hover:underline dark:text-pink-300">
          Back to login
        </Link>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBFD] px-4 py-12 font-sans dark:bg-slate-950">
        <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-green-200 bg-green-50 text-green-600">
            <CheckCircle className="size-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Verification Resubmitted</h2>
          <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            Thank you. Your updated company details and documents have been sent for admin review. You'll receive an
            email once verification is complete.
          </p>
          <Link to="/auth/login" className="text-sm font-extrabold text-[#6B2C91] hover:underline dark:text-pink-300">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDFBFD] px-4 py-12 font-sans dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl space-y-8 rounded-3xl border border-slate-100 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col items-center space-y-4">
          <Logo />
          <h2 className="bg-gradient-to-r from-[#6B2C91] to-pink-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            Update Company Verification
          </h2>
          <p className="text-center text-sm font-medium text-slate-450 dark:text-slate-400">
            An admin has requested more information for your company registration. Update the details below, attach
            any requested documents, and resubmit for review.
          </p>
        </div>

        {feedback && (
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3.5 text-xs font-semibold text-blue-800 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-300">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider">Admin Note</span>
            {feedback}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleResubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Company Name</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 pl-10 dark:border-slate-800"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Website</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="url"
                  value={website}
                  onChange={(e) => {
                    setWebsite(e.target.value)
                    if (websiteError) setWebsiteError(null)
                  }}
                  className="h-11 rounded-xl border-slate-200 pl-10 dark:border-slate-800"
                />
              </div>
              {websiteError && <p className="text-[10px] font-bold text-red-500">{websiteError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Headquarters</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 pl-10 dark:border-slate-800"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Industry</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={industryName}
                  onChange={(e) => setIndustryName(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 pl-10 dark:border-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Document Upload */}
          <div className="space-y-3 rounded-xl border border-slate-100 p-4 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
              Upload Documents
            </h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <label className="flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <Upload className="size-3.5" />
                {uploadingCategory ? "Uploading..." : "Choose File"}
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className="hidden"
                  disabled={!!uploadingCategory}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUploadDocument(file)
                    e.target.value = ""
                  }}
                />
              </label>
            </div>

            {documents.length > 0 ? (
              <ul className="space-y-1.5">
                {documents.map((doc, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600 dark:bg-slate-950/40 dark:text-slate-300"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText className="size-3.5 text-[#6B2C91] dark:text-pink-300" />
                      {DOCUMENT_CATEGORIES.find((c) => c.value === doc.category)?.label || doc.category}
                      <span className="text-slate-400">v{doc.version}</span>
                    </span>
                    <span className="text-slate-400">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] font-semibold text-slate-400">No documents uploaded yet.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Comments for Admin
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Describe what you've updated or attached..."
              className="h-24 w-full rounded-lg border border-slate-250 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-xl bg-gradient-to-r from-[#6B2C91] to-pink-600 font-bold text-white shadow-md hover:from-[#5A247A] hover:to-pink-700"
          >
            {submitting ? "Resubmitting..." : "Resubmit Verification"}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default CompanyVerification
