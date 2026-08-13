import { useState } from "react"
import { Globe, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { isValidPhone, sanitizeNumeric, normalizeWebsite } from "@/utils/validators"
import type { ExtendedCandidate, SocialLink } from "../../types/candidate"

type PersonalDetailsFormProps = {
  candidate: ExtendedCandidate
  isEditing: boolean
  onChange: (fields: Partial<ExtendedCandidate>) => void
  onAddLanguage: (lang: string) => void
  onRemoveLanguage: (lang: string) => void
  onAddSocialLink: (platform: SocialLink["platform"], url: string) => void
  onRemoveSocialLink: (id: string) => void
  onUpdateSocialLink: (id: string, url: string) => void
}

export function PersonalDetailsForm({
  candidate,
  isEditing,
  onChange,
  onAddLanguage,
  onRemoveLanguage,
  onAddSocialLink,
  onRemoveSocialLink,
  onUpdateSocialLink,
}: PersonalDetailsFormProps) {
  const [newLanguage, setNewLanguage] = useState("")
  const [newSocialPlatform, setNewSocialPlatform] = useState<SocialLink["platform"]>("LinkedIn")
  const [newSocialUrl, setNewSocialUrl] = useState("")

  const handleAddLanguage = (e: React.FormEvent) => {
    e.preventDefault()
    if (newLanguage.trim()) {
      onAddLanguage(newLanguage.trim())
      setNewLanguage("")
    }
  }

  const handleAddSocial = (e: React.FormEvent) => {
    e.preventDefault()
    if (newSocialUrl.trim()) {
      // Accept a bare domain/handle ("linkedin.com/in/x") same as the
      // website field elsewhere in the app -- prepend https:// if the user
      // didn't type a scheme, rather than requiring it up front.
      onAddSocialLink(newSocialPlatform, normalizeWebsite(newSocialUrl.trim()))
      setNewSocialUrl("")
    }
  }

  // Normalizes an existing link's URL once the user leaves the field,
  // rather than on every keystroke -- doing it on change would fight the
  // user mid-type (e.g. immediately rewriting "l" to "https://l").
  const handleSocialBlur = (id: string, url: string) => {
    if (url.trim()) {
      onUpdateSocialLink(id, normalizeWebsite(url.trim()))
    }
  }

  return (
    <DashboardCard className="p-5">
      <h2 className="mb-4 text-sm font-extrabold text-slate-950 dark:text-white">
        Personal & Contact Information
      </h2>

      {!isEditing ? (
        <div className="space-y-5">
          {candidate.bio && (
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50">
              <span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
                Professional Summary
              </span>
              <p className="whitespace-pre-wrap text-xs font-semibold text-slate-700 dark:text-slate-200">
                {candidate.bio}
              </p>
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2">
          {/* Details list */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Full Name</span>
              <span className="text-xs font-extrabold text-slate-950 dark:text-white">{candidate.fullName}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Role</span>
              <span className="text-xs font-extrabold text-slate-950 dark:text-white">{candidate.role}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Current CTC</span>
              <span className="text-xs font-extrabold text-slate-950 dark:text-white">{candidate.currentCtc}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Experience</span>
              <span className="text-xs font-extrabold text-slate-950 dark:text-white">{candidate.experience}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Languages</span>
              <div className="flex flex-wrap gap-1.5">
                {candidate.languages.map((lang) => (
                  <span
                    key={lang}
                    className="inline-flex items-center rounded-md bg-pink-50 px-2 py-0.5 text-xs font-semibold text-pink-700 dark:bg-pink-500/10 dark:text-pink-200"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50">
            <h3 className="text-xs font-extrabold text-slate-950 dark:text-white flex items-center gap-1.5">
              <Globe className="size-4 text-[#6B2C91] dark:text-pink-300" />
              Social Profiles
            </h3>
            {candidate.socialLinks.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">No social profiles added.</p>
            ) : (
              <ul className="space-y-2.5">
                {candidate.socialLinks.map((link) => (
                  <li key={link.id} className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600 dark:text-slate-300">{link.platform}:</span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-[#6B2C91] hover:underline font-extrabold dark:text-pink-200"
                    >
                      {link.url.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Edit form */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bio" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
              Professional Summary / Bio
            </label>
            <textarea
              id="bio"
              rows={4}
              maxLength={500}
              placeholder="A short summary recruiters will see -- your background, strengths, and what you're looking for."
              value={candidate.bio}
              onChange={(e) => onChange({ bio: e.target.value })}
              className="resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
            />
            <span className="text-right text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              {(candidate.bio || "").length}/500
            </span>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fullName" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={candidate.fullName}
                onChange={(e) => onChange({ fullName: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="role" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
                Professional Headline / Role
              </label>
              <input
                id="role"
                type="text"
                value={candidate.role}
                onChange={(e) => onChange({ role: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={candidate.email}
                onChange={(e) => onChange({ email: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
                Phone Number
              </label>
              <input
                id="phone"
                type="text"
                value={candidate.phone}
                onChange={(e) => onChange({ phone: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
              />
              {/* phone previously had no validation at all -- any
                  string persisted as-is. This doesn't block typing (the
                  parent owns save/submit), it just flags an invalid-looking
                  value inline before the user hits Save. */}
              {candidate.phone && !isValidPhone(candidate.phone) && (
                <p className="text-[10px] font-bold text-red-500">Please enter a valid phone number (10-14 digits).</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="location" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
                Location
              </label>
              <input
                id="location"
                type="text"
                value={candidate.location}
                onChange={(e) => onChange({ location: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="currentCtc" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
                Current CTC
              </label>
              <input
                id="currentCtc"
                type="text"
                inputMode="decimal"
                value={candidate.currentCtc}
                onChange={(e) => onChange({ currentCtc: sanitizeNumeric(e.target.value) })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="experience" className="text-xs font-extrabold text-slate-600 dark:text-slate-400">
                Total Years of Experience
              </label>
              <input
                id="experience"
                type="text"
                value={candidate.experience}
                onChange={(e) => onChange({ experience: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
              />
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Edit Languages */}
          <div>
            <label className="text-xs font-extrabold text-slate-600 dark:text-slate-400 block mb-2">
              Languages
            </label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {candidate.languages.map((lang) => (
                <span
                  key={lang}
                  className="inline-flex items-center gap-1 rounded-md bg-pink-50 px-2 py-0.5 text-xs font-semibold text-pink-700 dark:bg-pink-500/10 dark:text-pink-200"
                >
                  {lang}
                  <button
                    type="button"
                    onClick={() => onRemoveLanguage(lang)}
                    className="text-pink-700 hover:text-pink-900 dark:text-pink-200 dark:hover:text-white"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <form onSubmit={handleAddLanguage} className="flex max-w-xs gap-2">
              <input
                type="text"
                placeholder="Add language..."
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
              />
              <Button type="submit" size="sm" className="bg-[#6B2C91] text-white hover:bg-[#5a237b]">
                <Plus className="size-3.5" />
              </Button>
            </form>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Edit Social Profiles */}
          <div className="space-y-3">
            <label className="text-xs font-extrabold text-slate-600 dark:text-slate-400 block">
              Social Profiles
            </label>
            {candidate.socialLinks.map((link) => (
              <div key={link.id} className="flex items-center gap-2 max-w-xl">
                <span className="w-20 text-xs font-bold text-slate-500 dark:text-slate-400">{link.platform}</span>
                <input
                  type="text"
                  value={link.url}
                  onChange={(e) => onUpdateSocialLink(link.id, e.target.value)}
                  onBlur={(e) => handleSocialBlur(link.id, e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveSocialLink(link.id)}
                  className="text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}

            <form onSubmit={handleAddSocial} className="flex max-w-xl gap-2 mt-4 items-center border-t border-dashed border-slate-100 pt-3 dark:border-slate-800">
              <select
                value={newSocialPlatform}
                onChange={(e) => setNewSocialPlatform(e.target.value as SocialLink["platform"])}
                className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900"
              >
                <option value="LinkedIn">LinkedIn</option>
                <option value="GitHub">GitHub</option>
                <option value="Twitter">Twitter</option>
                <option value="Portfolio">Portfolio</option>
              </select>
              <input
                // Deliberately type="text", not "url" -- the browser's
                // built-in url validation requires a scheme (https://) to be
                // typed up front and blocks submitting otherwise, which
                // defeats normalizeWebsite() below adding it automatically.
                type="text"
                placeholder="e.g. linkedin.com/in/yourname"
                value={newSocialUrl}
                onChange={(e) => setNewSocialUrl(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900"
              />
              <Button type="submit" size="sm" className="bg-[#6B2C91] text-white hover:bg-[#5a237b] shrink-0">
                Add Profile
              </Button>
            </form>
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
