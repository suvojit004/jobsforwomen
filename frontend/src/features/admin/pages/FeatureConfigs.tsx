import { useState, useEffect } from "react"
import {
  MessageSquare,
  Mail,
  Network,
} from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import { AdminApi } from "../services/adminApi"

// Displays and edits the real, database-persisted FeatureFlag rows
// (chat_enabled, email_automation) with the payload shape the backend's
// Zod schema expects (`{ value }`), and doesn't touch the separate
// client-only @/config/features localStorage store.
//
// push_notifications, advanced_analytics, experimental_sockets, and
// mfa_enforced used to be seeded and shown here too, always as permanently
// disabled "Not Implemented" rows -- nothing in the codebase ever branched
// on them. They've been removed from seeding and are filtered out of
// AdminService.getFeatureFlags() server-side, so they no longer come back
// from the API at all; there's nothing left here to special-case for them.

interface ApiFlag {
  id: string
  key: string
  value: boolean
  category: string
  description: string | null
}

const FLAG_META: Record<
  string,
  { name: string; icon: React.ComponentType<{ className?: string }>; enforced: string; implemented: boolean }
> = {
  chat_enabled: {
    name: "Real-time Chat",
    icon: MessageSquare,
    enforced: "Enforced: when off, starting a new conversation or sending a message returns 403 from the API. Existing message history remains readable.",
    implemented: true,
  },
  email_automation: {
    name: "Automated Email Delivery",
    icon: Mail,
    enforced: "Enforced: when off, status-update/digest emails are skipped before being queued. Account verification and password-reset emails always send regardless (security-critical).",
    implemented: true,
  },
}

export function FeatureConfigs() {
  const [flags, setFlags] = useState<ApiFlag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState("")

  const load = async () => {
    try {
      setIsLoading(true)
      setError("")
      const list = await AdminApi.getFeatureFlags()
      setFlags(list)
    } catch (err) {
      console.error("Failed to load feature flags", err)
      setError("Failed to load feature flags from the server.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleToggle = async (flag: ApiFlag) => {
    // Defense in depth: the checkbox for an unimplemented flag is already
    // rendered `disabled`, but guard the handler itself too so a stale
    // render or a programmatic call can never fire a request that would
    // flip a DB value with zero runtime effect (Final Implementation Pass,
    // Part 3 -- no fake-success toggle-then-nothing-changes).
    const meta = FLAG_META[flag.key]
    if (meta && !meta.implemented) return

    const nextVal = !flag.value
    const prevFlags = flags
    setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, value: nextVal } : f)))
    setPendingKey(flag.key)
    setError("")
    try {
      await AdminApi.updateFeatureFlag(flag.id, { value: nextVal })
    } catch (err) {
      console.error("Failed to update feature flag", err)
      setFlags(prevFlags)
      setError(`Failed to update "${flag.key}". Please try again.`)
    } finally {
      setPendingKey(null)
    }
  }

  const grouped = flags.reduce<Record<string, ApiFlag[]>>((acc, f) => {
    acc[f.category] = acc[f.category] || []
    acc[f.category].push(f)
    return acc
  }, {})

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading feature configs...</div>
  }

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
            <Network className="size-6 text-[#6B2C91] dark:text-pink-300" />
            System Feature Flags
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Toggles the real, database-persisted platform flags. Each card states exactly what it does and does not
            enforce.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={load}
          className="h-8 text-xs font-bold border-slate-200 hover:bg-slate-100 shrink-0"
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-pink-200 bg-pink-50 px-4 py-2.5 text-xs font-bold text-pink-700 dark:border-pink-900 dark:bg-pink-950/30 dark:text-pink-300">
          {error}
        </div>
      )}

      {flags.length === 0 ? (
        <p className="py-8 text-center text-xs font-bold text-slate-400">No feature flags found.</p>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-150 pb-2 dark:border-slate-800">
                {category}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((flag) => {
                  const meta = FLAG_META[flag.key] || { name: flag.key, icon: Network, enforced: "", implemented: true }
                  const isPending = pendingKey === flag.key
                  const locked = !meta.implemented
                  return (
                    <DashboardCard
                      key={flag.id}
                      className={`p-5 flex flex-col justify-between space-y-4 transition-colors ${
                        locked ? "opacity-80" : "hover:border-[#6B2C91]/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <meta.icon className="size-4 text-slate-450 dark:text-slate-500" />
                            {meta.name}
                          </h4>
                          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">
                            {flag.description || `Database key: ${flag.key}`}
                          </p>
                        </div>
                        <div className="shrink-0 pt-0.5">
                          {locked ? (
                            // Honest disabled control: this flag has no runtime
                            // effect anywhere in the backend, so it is not
                            // offered as a clickable toggle at all (Final
                            // Implementation Pass, Part 3) -- rendering it as a
                            // disabled switch rather than omitting it keeps the
                            // row visible/auditable without implying it does
                            // anything when flipped.
                            <div
                              className="relative inline-flex items-center cursor-not-allowed"
                              title="Not implemented -- toggling has no runtime effect"
                            >
                              <div className="w-9 h-5 bg-slate-150 rounded-full dark:bg-slate-800 border border-slate-200 dark:border-slate-700 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-350 dark:after:bg-slate-600 after:rounded-full after:h-4 after:w-4" />
                            </div>
                          ) : (
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={flag.value}
                                disabled={isPending}
                                onChange={() => handleToggle(flag)}
                                className="sr-only peer"
                                aria-label={`Toggle ${meta.name}`}
                              />
                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-750 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-[#6B2C91] dark:peer-checked:bg-pink-600" />
                            </label>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider">
                        {locked ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-slate-350" />
                            <span className="text-slate-450 dark:text-slate-500">Not Implemented</span>
                          </>
                        ) : (
                          <>
                            <span className={`w-2 h-2 rounded-full ${flag.value ? "bg-emerald-500 animate-pulse" : "bg-slate-350"}`} />
                            <span className={flag.value ? "text-emerald-700 dark:text-emerald-400" : "text-slate-450"}>
                              {flag.value ? "Online" : "Offline"}
                            </span>
                          </>
                        )}
                      </div>
                      {meta.enforced && (
                        <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2">
                          {meta.enforced}
                        </p>
                      )}
                    </DashboardCard>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
export default FeatureConfigs
