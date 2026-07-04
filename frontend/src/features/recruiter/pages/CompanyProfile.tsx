import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Building2,
  Globe,
  MapPin,
  Users,
  Briefcase,
  Heart,
  FileCheck,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"

const companySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters."),
  website: z.string().min(3, "Please enter a valid website URL."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  employees: z.string(),
  industry: z.string().min(2, "Please enter the industry sector."),
  location: z.string().min(2, "Please enter the headquarters location."),
  menstrualLeaveChampion: z.boolean(),
  workFromHome: z.boolean(),
  flexibleHours: z.boolean(),
  learningBudget: z.boolean(),
  childcareSupport: z.boolean(),
})

type CompanyFormValues = z.infer<typeof companySchema>

export function CompanyProfile() {
  const [successMsg, setSuccessMsg] = useState(false)

  // Load initial values from localStorage or fallback
  const initialValues = (() => {
    const defaultVals: CompanyFormValues = {
      name: "TechNova Solutions",
      website: "www.technova.com",
      description: "We build innovative software solutions that empower businesses worldwide.",
      employees: "51-200 employees",
      industry: "Software & Technology",
      location: "Bengaluru, Karnataka",
      menstrualLeaveChampion: true,
      workFromHome: true,
      flexibleHours: true,
      learningBudget: true,
      childcareSupport: false,
    }
    const stored = localStorage.getItem("companyProfile")
    return stored ? { ...defaultVals, ...JSON.parse(stored) } : defaultVals
  })()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: initialValues,
  })

  const onSubmit = (data: CompanyFormValues) => {
    // Write profile variables back to LocalStorage
    localStorage.setItem("companyProfile", JSON.stringify(data))
    setSuccessMsg(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
    setTimeout(() => setSuccessMsg(false), 3000)
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
        <DashboardCard className="p-6 space-y-6">
          <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
            Basic Information
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Company Name */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Company Name</label>
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
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Website URL</label>
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
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">HQ Location</label>
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
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Company Size</label>
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
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Industry / Sector</label>
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
              <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">About Company</label>
              <textarea
                rows={4}
                {...register("description")}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
              />
              {errors.description && <p className="text-[10px] font-bold text-red-500">{errors.description.message}</p>}
            </div>
          </div>
        </DashboardCard>

        {/* Benefits Checklist Card */}
        <DashboardCard className="p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white">
              Workplace Equality perks & benefits
            </h3>
            <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[8px] font-black uppercase text-pink-700 dark:bg-pink-950/40 dark:text-pink-300">
              Diversity Enablers
            </span>
          </div>

          <div className="space-y-4">
            {/* Menstrual leave */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("menstrualLeaveChampion")}
                className="mt-0.5 size-4 accent-[#6B2C91] dark:accent-pink-500"
              />
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                  Menstrual Leave Support
                  <Heart className="size-3.5 fill-pink-500 text-pink-500 animate-pulse" />
                </p>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  Activates your premium "Menstrual Leave Partner" footer badge on job postings and indexes.
                </p>
              </div>
            </label>

            {/* Work from Home */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("workFromHome")}
                className="mt-0.5 size-4 accent-[#6B2C91] dark:accent-pink-500"
              />
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">Work from Home (WFH) Stipend</p>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  Company provides hardware assets, desk allocations, and monthly remote utility coverage.
                </p>
              </div>
            </label>

            {/* Flexible working hours */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("flexibleHours")}
                className="mt-0.5 size-4 accent-[#6B2C91] dark:accent-pink-500"
              />
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">Flexible Working Hours</p>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  Support returnees and mothers with core hour blocks and adaptable weekly schedules.
                </p>
              </div>
            </label>

            {/* Learning budget */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("learningBudget")}
                className="mt-0.5 size-4 accent-[#6B2C91] dark:accent-pink-500"
              />
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">Dedicated Upskilling / Learning Budget</p>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  Provide course credits and conference tokens to facilitate skill enhancement during career returns.
                </p>
              </div>
            </label>

            {/* Childcare support */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("childcareSupport")}
                className="mt-0.5 size-4 accent-[#6B2C91] dark:accent-pink-500"
              />
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">Childcare Allowance / Creche Support</p>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  Subsidized daycare access or monthly parent benefits to simplify parenting schedules.
                </p>
              </div>
            </label>
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
    </div>
  )
}
export default CompanyProfile
