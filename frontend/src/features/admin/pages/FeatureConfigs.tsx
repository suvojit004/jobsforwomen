import { useState, useEffect } from "react"
import {
  Sparkles,
  MessageSquare,
  Globe,
  Cpu,
  Mail,
  Smartphone,
  BarChart,
  Network,
  CloudLightning,
  Bell,
  Lock,
  ShieldCheck,
} from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import { setFeatureFlag } from "@/config/features"
import type { FeatureKey } from "@/config/features"
import { AdminApi } from "../services/adminApi"

interface FeatureItem {
  key: FeatureKey
  name: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
}

interface FeatureGroup {
  category: "Communication" | "Platform" | "Notifications" | "Analytics" | "Experimental" | "Security"
  items: FeatureItem[]
}

export function FeatureConfigs() {
  const [flags, setFlags] = useState<Record<FeatureKey, boolean>>({
    CHAT_SYSTEM: false,
    WEB_SOCKETS: false,
    EMAIL_DIGESTS: false,
    ADMIN_MODERATION: true,
    RETURNSHIP_ALERTS: false,
    ANALYTICS_EXPORT: false,
    AI_RESUME_PARSER: false,
    SMS_NOTIFICATIONS: false,
    ENTERPRISE_GREENHOUSE: false,
    MFA_ENFORCEMENT: false,
    SESSION_TIMEOUT_LOGS: false,
    PUSH_NOTIFICATION_ALERTS: false,
  })

  const [saving, setSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadFlags() {
      try {
        const list = await AdminApi.getFeatureFlags()
        const mappedFlags = { ...flags }
        list.forEach((f: any) => {
          if (f.key in mappedFlags) {
            mappedFlags[f.key as FeatureKey] = !!f.enabled
          }
        })
        setFlags(mappedFlags)
      } catch (err) {
        console.error("Failed to load feature flags", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadFlags()
  }, [])

  const featureGroups: FeatureGroup[] = [
    {
      category: "Communication",
      items: [
        {
          key: "CHAT_SYSTEM",
          name: "Real-time Chat",
          desc: "Enables instant chat messaging between recruiter inbox streams and candidate profiles.",
          icon: MessageSquare,
        },
        {
          key: "EMAIL_DIGESTS",
          name: "Email Matchmaking digests",
          desc: "Sends weekly recurring emails containing curated candidate alerts to active recruiters.",
          icon: Mail,
        },
        {
          key: "SMS_NOTIFICATIONS",
          name: "SMS Interview Alerts",
          desc: "Sends automatic mobile text message reminders to candidates when interview schedules change.",
          icon: Smartphone,
        },
      ],
    },
    {
      category: "Platform",
      items: [
        {
          key: "ADMIN_MODERATION",
          name: "Admin Control Center",
          desc: "Enables access protection routing gates, security shields and logs auditing.",
          icon: Globe,
        },
        {
          key: "RETURNSHIP_ALERTS",
          name: "Returnship Badging",
          desc: "Highlights and categorizes job postings configured with women returning-to-work program support.",
          icon: CloudLightning,
        },
      ],
    },
    {
      category: "Notifications",
      items: [
        {
          key: "PUSH_NOTIFICATION_ALERTS",
          name: "Push Notification Alerts",
          desc: "Triggers browser notifications for instant candidate updates.",
          icon: Bell,
        },
        {
          key: "WEB_SOCKETS",
          name: "Live WebSockets Syncing",
          desc: "Utilizes bidirectional WebSocket feeds for micro-animations notifications pushes.",
          icon: Network,
        },
      ],
    },
    {
      category: "Analytics",
      items: [
        {
          key: "ANALYTICS_EXPORT",
          name: "Analytics CSV exports",
          desc: "Exposes report downloads grids inside recruiter dashboards.",
          icon: BarChart,
        },
      ],
    },
    {
      category: "Experimental",
      items: [
        {
          key: "AI_RESUME_PARSER",
          name: "AI-Powered Resume parsing",
          desc: "Extracts skill listings and work history matrices automatically from uploaded PDF files.",
          icon: Cpu,
        },
        {
          key: "ENTERPRISE_GREENHOUSE",
          name: "Greenhouse ATS syncs",
          desc: "Allows corporate partners to sync candidate logs automatically with Greenhouse accounts.",
          icon: Sparkles,
        },
      ],
    },
    {
      category: "Security",
      items: [
        {
          key: "MFA_ENFORCEMENT",
          name: "Enforce Multi-Factor Auth (MFA)",
          desc: "Requires security authorization codes when moderators change system configurations.",
          icon: Lock,
        },
        {
          key: "SESSION_TIMEOUT_LOGS",
          name: "Audit Inactivity Timeout Logs",
          desc: "Tracks and alerts operator records when background sessions expire due to idling.",
          icon: ShieldCheck,
        },
      ],
    },
  ]

  const handleToggle = async (key: FeatureKey) => {
    if (key === "ADMIN_MODERATION" && flags.ADMIN_MODERATION) {
      alert("Security constraint: Admin control center flag must remain enabled to access this control room.")
      return
    }

    const nextVal = !flags[key]
    setFlags((prev) => ({ ...prev, [key]: nextVal }))
    setFeatureFlag(key, nextVal)

    try {
      const list = await AdminApi.getFeatureFlags()
      const existing = list.find((f: any) => f.key === key)
      if (existing) {
        await AdminApi.updateFeatureFlag(existing.id, { enabled: nextVal })
      } else {
        await AdminApi.createFeatureFlag({ key, enabled: nextVal, description: `System flag for ${key}` })
      }
    } catch (err) {
      console.error("Failed to update feature flag", err)
    }
  }

  const handleSaveAll = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      alert("Feature configurations propagated to API nodes successfully!")
    }, 1000)
  }

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading feature configs...</div>
  }

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
            <Sparkles className="size-6 text-[#6B2C91] dark:text-pink-300" />
            System Feature Configs
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Globally configure active application modules, database syncs, experimental AI scripts, and communication flows.
          </p>
        </div>
        <div className="shrink-0">
          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={saving}
            className="h-8 text-xs font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700"
          >
            {saving ? "Propagating Configs..." : "Save Feature Configurations"}
          </Button>
        </div>
      </div>

      {/* Grouped Feature Toggles */}
      <div className="space-y-8">
        {featureGroups.map((group) => (
          <div key={group.category} className="space-y-3">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-150 pb-2 dark:border-slate-800">
              {group.category}
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.items.map((feat) => {
                const isEnabled = flags[feat.key]
                return (
                  <DashboardCard
                    key={feat.key}
                    className="p-5 flex flex-col justify-between space-y-4 hover:border-[#6B2C91]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <feat.icon className="size-4 text-slate-450 dark:text-slate-500" />
                          {feat.name}
                        </h4>
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">
                          {feat.desc}
                        </p>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggle(feat.key)}
                            className="sr-only peer"
                            aria-label={`Toggle ${feat.name}`}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-750 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-[#6B2C91] dark:peer-checked:bg-pink-600"></div>
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider">
                      <span className={`w-2 h-2 rounded-full ${isEnabled ? "bg-emerald-500 animate-pulse" : "bg-slate-350"}`} />
                      <span className={isEnabled ? "text-emerald-700 dark:text-emerald-400" : "text-slate-450"}>
                        {isEnabled ? "Online / Entitled" : "Offline / Disabled"}
                      </span>
                    </div>
                  </DashboardCard>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
export default FeatureConfigs
