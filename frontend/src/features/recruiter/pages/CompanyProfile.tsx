import { useState } from "react"
import { Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Building2,
  Globe,
  MapPin,
  Users,
  Briefcase,
  Award,
  FileCheck,
  ArrowRight,
  Images,
  ShieldCheck,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { normalizeWebsite, isValidWebsite } from "@/utils/validators"

// Website previously only checked `.min(3)` -- never validated URL shape at
// all, so "xxx" passed here and only failed later on the backend's
// `onboardCompanySchema`, which does use `.url()`. But the backend's `.url()`
// requires a full URL with protocol (e.g. "https://technova.com"), while this
// form's placeholder ("e.g. technova.com") suggests a bare domain -- so a
// user following that placeholder literally would still round-trip-fail even
// with a naive `.url()` added here. Normalize first (prepend https:// if no
// protocol given), then validate the normalized value is a real URL.
const companySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters."),
  website: z
    .string()
    .min(3, "Please enter a valid website URL.")
    .transform(normalizeWebsite)
    .refine(isValidWebsite, "Please enter a valid website URL (e.g. company.com)."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  employees: z.string(),
  industry: z.string().min(2, "Please enter the industry sector."),
  location: z.string().min(2, "Please enter the headquarters location."),
})

type CompanyFormValues = z.infer<typeof companySchema>

import { useEffect } from "react"
import { RecruiterApi } from "../services/recruiterApi"

interface GalleryPhoto {
  url: string
  publicId: string
  caption?: string
  uploadedAt?: string
}

interface CompanyPolicy {
  title: string
  description: string
}

export function CompanyProfile() {
  const [successMsg, setSuccessMsg] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)

  // expanded Company Profile -- office photo gallery + policies
  const [gallery, setGallery] = useState<GalleryPhoto[]>([])
  const [isGalleryUploading, setIsGalleryUploading] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)

  const [policies, setPolicies] = useState<CompanyPolicy[]>([])
  const [policyDraft, setPolicyDraft] = useState<CompanyPolicy>({ title: "", description: "" })
  const [isSavingPolicies, setIsSavingPolicies] = useState(false)
  const [policiesError, setPoliciesError] = useState<string | null>(null)
  const [policiesSaved, setPoliciesSaved] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      website: "",
      description: "",
      employees: "51-200 employees",
      industry: "",
      location: "",
    },
  })

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!allowedMimeTypes.includes(file.type)) {
      setLogoError("Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.")
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setLogoError("File size exceeds 2 MB limit.")
      return
    }

    setLogoError(null)
    setIsUploading(true)

    try {
      const res = await RecruiterApi.uploadCompanyLogo(file)
      if (res && res.success && res.data?.company) {
        setLogoUrl(res.data.company.logoUrl || null)
      } else {
        setLogoError("Failed to upload logo image.")
      }
    } catch (err: any) {
      setLogoError(err.message || "An error occurred during logo upload.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleLogoDelete = async () => {
    setIsUploading(true)
    try {
      const res = await RecruiterApi.deleteCompanyLogo()
      if (res && res.success) {
        setLogoUrl(null)
        setLogoError(null)
      }
    } catch (err: any) {
      setLogoError(err.message || "Failed to remove logo.")
    } finally {
      setIsUploading(false)
    }
  }

  useEffect(() => {
    async function loadCompany() {
      try {
        const dash = await RecruiterApi.getDashboard()
        const comp = dash?.company || dash?.recruiterProfile?.company
        if (comp) {
          setLogoUrl(comp.logoUrl || null)
          setGallery(Array.isArray(comp.galleryImages) ? comp.galleryImages : [])
          setPolicies(Array.isArray(comp.policies) ? comp.policies : [])
          reset({
            name: comp.name || "",
            website: comp.website || "",
            description: comp.description || "",
            employees: "51-200 employees",
            industry: comp.industry?.name || "Software & Technology",
            location: comp.location || "",
          })
        }
      } catch (err: any) {
        console.error("Failed to load company profile", err)
        toast.error(err?.message || "Failed to load company profile.")
      } finally {
        setIsLoading(false)
      }
    }
    loadCompany()
  }, [reset])

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!allowedMimeTypes.includes(file.type)) {
      setGalleryError("Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setGalleryError("File size exceeds 2 MB limit.")
      return
    }
    if (gallery.length >= 20) {
      setGalleryError("Maximum of 20 gallery photos allowed. Remove one before adding another.")
      return
    }

    setGalleryError(null)
    setIsGalleryUploading(true)
    try {
      const res = await RecruiterApi.uploadGalleryPhoto(file)
      if (res?.company?.galleryImages) {
        setGallery(res.company.galleryImages)
      }
    } catch (err: any) {
      setGalleryError(err.message || "Failed to upload photo.")
    } finally {
      setIsGalleryUploading(false)
      e.target.value = ""
    }
  }

  const handleGalleryDelete = async (publicId: string) => {
    setIsGalleryUploading(true)
    try {
      const res = await RecruiterApi.deleteGalleryPhoto(publicId)
      if (res?.company?.galleryImages !== undefined) {
        setGallery(res.company.galleryImages || [])
      } else {
        setGallery((prev) => prev.filter((p) => p.publicId !== publicId))
      }
    } catch (err: any) {
      setGalleryError(err.message || "Failed to remove photo.")
    } finally {
      setIsGalleryUploading(false)
    }
  }

  const handleAddPolicy = () => {
    if (!policyDraft.title.trim() || !policyDraft.description.trim()) {
      setPoliciesError("Please provide both a title and description for the policy.")
      return
    }
    setPoliciesError(null)
    setPolicies((prev) => [...prev, { ...policyDraft }])
    setPolicyDraft({ title: "", description: "" })
  }

  const handleRemovePolicy = (index: number) => {
    setPolicies((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSavePolicies = async () => {
    setIsSavingPolicies(true)
    setPoliciesError(null)
    try {
      const res = await RecruiterApi.updatePolicies(policies)
      if (res?.company?.policies) {
        setPolicies(res.company.policies)
      }
      setPoliciesSaved(true)
      setTimeout(() => setPoliciesSaved(false), 3000)
    } catch (err: any) {
      setPoliciesError(err.message || "Failed to save policies.")
    } finally {
      setIsSavingPolicies(false)
    }
  }

  const onSubmit = async (data: CompanyFormValues) => {
    try {
      await RecruiterApi.onboardCompany({
        name: data.name,
        description: data.description,
        website: data.website,
        location: data.location,
        industryName: data.industry,
      })

      setSuccessMsg(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
      setTimeout(() => setSuccessMsg(false), 3000)
    } catch (err: any) {
      // Previously this only logged to the console -- the recruiter saw no
      // success banner and no error, so "Save Corporate Profile" looked like
      // a dead button on any failure (e.g. a duplicate company name hitting
      // the @unique constraint, or a validation error).
      console.error("Failed to save company profile", err)
      toast.error(err?.message || "Couldn't save company profile. Please try again.")
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading company profile...</div>
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header section */}
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Company Profile
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Manage your organizational details, website portals, and workplace diversity perks.
        </p>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl text-xs font-black flex items-center gap-2.5 border border-emerald-100 dark:border-emerald-950/50 select-none animate-fadeIn">
          <FileCheck className="size-4 shrink-0 stroke-[3]" />
          <span>Profile configuration saved successfully. Dashboard widgets synced in real-time.</span>
        </div>
      )}

      {/* Main Profile Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <DashboardCard className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group shrink-0 size-24 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
              {logoUrl ? (
                <img src={logoUrl} alt="Company Logo" className="size-full object-contain" />
              ) : (
                <Building2 className="size-8 text-slate-350 dark:text-slate-600" />
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-white/75 dark:bg-black/75 flex items-center justify-center">
                  <span className="size-5 border-2 border-slate-300 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-700 dark:border-t-pink-500" />
                </div>
              )}
            </div>
            <div className="space-y-2 text-center sm:text-left flex-1">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Company Logo</h4>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                Upload a PNG, JPEG, GIF or WEBP image. Max size 2 MB.
              </p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <label className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-[11px] font-black text-white bg-[#6B2C91] hover:bg-[#5a237b] dark:bg-pink-650 dark:hover:bg-pink-700 cursor-pointer transition-colors shadow-sm select-none">
                  Select Logo File
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/gif, image/webp"
                    className="hidden"
                    onChange={handleLogoChange}
                    disabled={isUploading}
                  />
                </label>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-xl text-[11px] font-black border-slate-200 text-slate-650 hover:text-red-500 dark:border-slate-800 dark:text-slate-400 cursor-pointer"
                    onClick={handleLogoDelete}
                    disabled={isUploading}
                  >
                    Remove Logo
                  </Button>
                )}
              </div>
              {logoError && <p className="text-[10px] font-bold text-red-500 mt-1">{logoError}</p>}
            </div>
          </div>
        </DashboardCard>

        <DashboardCard className="p-6 space-y-6">
          <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
            Basic Information
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Company Name */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Company Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  {...register("name")}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
                />
              </div>
              {errors.name && <p className="text-[10px] font-bold text-red-500">{errors.name.message}</p>}
            </div>

            {/* Corporate Website */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Website URL <span className="text-red-500">*</span></label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  {...register("website")}
                  placeholder="e.g. technova.com"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
                />
              </div>
              {errors.website && <p className="text-[10px] font-bold text-red-500">{errors.website.message}</p>}
            </div>

            {/* HQ Location */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">HQ Location <span className="text-red-500">*</span></label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  {...register("location")}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
                />
              </div>
              {errors.location && <p className="text-[10px] font-bold text-red-500">{errors.location.message}</p>}
            </div>

            {/* Employee Count */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Company Size <span className="text-red-500">*</span></label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  {...register("employees")}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
                >
                  <option value="1-10 employees">1-10 employees</option>
                  <option value="11-50 employees">11-50 employees</option>
                  <option value="51-200 employees">51-200 employees</option>
                  <option value="201-500 employees">201-500 employees</option>
                  <option value="500+ employees">500+ employees</option>
                </select>
              </div>
            </div>

            {/* Industry sector */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Industry / Sector <span className="text-red-500">*</span></label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  {...register("industry")}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
                />
              </div>
              {errors.industry && <p className="text-[10px] font-bold text-red-500">{errors.industry.message}</p>}
            </div>

            {/* Company Bio */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">About Company <span className="text-red-500">*</span></label>
              <textarea
                rows={4}
                {...register("description")}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
              />
              {errors.description && <p className="text-[10px] font-bold text-red-500">{errors.description.message}</p>}
            </div>
          </div>
        </DashboardCard>

        {/* Perks & Certifications now live on their own page with a real
            per-perk approval workflow (proof upload, admin review, resubmit)
            -- this card used to be a checkbox list that just bulk-saved a
            boolean per perk with no verification step at all. */}
        <DashboardCard className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-violet-100 text-[#6B2C91] dark:bg-pink-900/20 dark:text-pink-300 flex items-center justify-center shrink-0">
                <Award className="size-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white">Perks & Certifications</h3>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                  Claim workplace equality perks, attach proof, and track verification status.
                </p>
              </div>
            </div>
            <Button asChild className="h-9 text-[11px] font-bold bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700 shrink-0">
              <Link to="/recruiter/perks">Manage Perks</Link>
            </Button>
          </div>
        </DashboardCard>

        {/* Action Panel */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#6B2C91] hover:bg-[#5a237b] text-white font-extrabold text-xs h-10 px-5 gap-1.5 cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700"
          >
            {isSubmitting ? "Saving details..." : "Save Corporate Profile"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </form>

      {/* Office Photo Gallery -- separate save surface from the main
          form, mirroring the logo upload pattern: each photo action saves
          immediately rather than being bundled into "Save Corporate Profile". */}
      <DashboardCard className="p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="size-10 rounded-xl bg-violet-100 text-[#6B2C91] dark:bg-pink-900/20 dark:text-pink-300 flex items-center justify-center shrink-0">
            <Images className="size-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white">Office Gallery</h3>
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
              Showcase your office and workplace culture to candidates. Up to 20 photos, 2 MB each.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {gallery.map((photo) => (
            <div
              key={photo.publicId}
              className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
            >
              <img src={photo.url} alt={photo.caption || "Office photo"} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => handleGalleryDelete(photo.publicId)}
                disabled={isGalleryUploading}
                className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Remove photo"
              >
                <X className="size-3.5" />
              </button>
              {photo.caption && (
                <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] font-semibold px-1.5 py-1 truncate">
                  {photo.caption}
                </p>
              )}
            </div>
          ))}

          {gallery.length < 20 && (
            <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-slate-400 hover:text-[#6B2C91] hover:border-[#6B2C91]/40 dark:hover:text-pink-300 transition-colors">
              {isGalleryUploading ? (
                <span className="size-5 border-2 border-slate-300 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-700 dark:border-t-pink-500" />
              ) : (
                <>
                  <Plus className="size-5" />
                  <span className="text-[9px] font-black uppercase">Add Photo</span>
                </>
              )}
              <input
                type="file"
                accept="image/png, image/jpeg, image/gif, image/webp"
                className="hidden"
                onChange={handleGalleryUpload}
                disabled={isGalleryUploading}
              />
            </label>
          )}
        </div>

        {galleryError && <p className="text-[10px] font-bold text-red-500">{galleryError}</p>}
      </DashboardCard>

      {/* Workplace Policies -- free-form list, not a fixed set of
          fields, so recruiters can add whichever named policies matter to
          their organization (POSH, maternity, equal pay, grievance
          redressal, etc). */}
      <DashboardCard className="p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="size-10 rounded-xl bg-violet-100 text-[#6B2C91] dark:bg-pink-900/20 dark:text-pink-300 flex items-center justify-center shrink-0">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white">Workplace Policies</h3>
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
              Publish workplace policy statements (e.g. POSH, maternity leave, equal pay) that build candidate trust.
            </p>
          </div>
        </div>

        {policiesSaved && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg text-[11px] font-black flex items-center gap-2 border border-emerald-100 dark:border-emerald-950/50">
            <FileCheck className="size-3.5 shrink-0 stroke-[3]" />
            <span>Policies saved successfully.</span>
          </div>
        )}

        {policies.length > 0 && (
          <ul className="space-y-2">
            {policies.map((policy, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{policy.title}</p>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{policy.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePolicy(i)}
                  className="shrink-0 size-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                  aria-label="Remove policy"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2 sm:grid-cols-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Policy Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={policyDraft.title}
              onChange={(e) => setPolicyDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. POSH / Anti-Harassment Policy"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Description <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={policyDraft.description}
              onChange={(e) => setPolicyDraft((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Briefly describe this policy"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        {policiesError && <p className="text-[10px] font-bold text-red-500">{policiesError}</p>}

        <div className="flex flex-wrap justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleAddPolicy}
            className="h-9 text-[11px] font-bold border-slate-200 dark:border-slate-800 gap-1.5"
          >
            <Plus className="size-3.5" />
            Add Policy
          </Button>
          <Button
            type="button"
            onClick={handleSavePolicies}
            disabled={isSavingPolicies}
            className="h-9 text-[11px] font-bold bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700"
          >
            {isSavingPolicies ? "Saving..." : "Save Policies"}
          </Button>
        </div>
      </DashboardCard>
    </div>
  )
}
export default CompanyProfile
