import { useState, useEffect, useCallback } from "react"
import {
  Activity,
  Clock,
  HardDrive,
  Database,
  Mail,
  Zap,
  RefreshCw,
  Users,
  UploadCloud,
} from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import { AdminApi } from "../services/adminApi"

interface ServiceHealth {
  name: string
  status: "UP" | "DOWN" | "UNKNOWN"
  details: string
  icon: React.ComponentType<{ className?: string }>
}

function formatUptime(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Renders the backend's `metricSemantics` classification (see
// admin.service.ts's getSystemHealth()) as an inline tag, so an in-memory
// counter that resets on every restart doesn't read as an all-time total.
function MetricTag({ isCounter }: { isCounter: boolean }) {
  return isCounter ? (
    <span
      className="ml-1.5 align-middle inline-block text-[8px] font-black uppercase tracking-wide text-teal-700 bg-teal-100/70 dark:bg-teal-950/30 dark:text-teal-300 px-1.5 py-0.5 rounded"
      title="Resets to 0 on every server restart/redeploy -- counts events since the process last started, not an all-time total."
    >
      Since Restart
    </span>
  ) : (
    <span
      className="ml-1.5 align-middle inline-block text-[8px] font-black uppercase tracking-wide text-emerald-700 bg-emerald-100/70 dark:bg-emerald-950/30 dark:text-emerald-350 px-1.5 py-0.5 rounded"
      title="Live value read fresh on every request -- reflects real current state, not an accumulating counter."
    >
      Live
    </span>
  )
}

export function SystemHealth() {
  const [refreshing, setRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastCheck, setLastCheck] = useState("")
  const [health, setHealth] = useState<any>(null)

  const load = useCallback(async () => {
    setError("")
    try {
      const data = await AdminApi.getHealth()
      setHealth(data)
      setLastCheck(new Date().toLocaleTimeString())
    } catch (err) {
      console.error("Failed to load system health", err)
      setError("Failed to fetch live system health from the server.")
    }
  }, [])

  useEffect(() => {
    async function initialLoad() {
      await load()
      setIsLoading(false)
    }
    initialLoad()
  }, [load])

  const handleRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  // Real service statuses reported by GET /api/v1/admins/health, which
  // actually pings the database, Redis, SMTP transport, disk storage, and
  // checks whether Socket.IO was really initialized -- as opposed to the
  // previous version of this page, which was a fully hardcoded list that
  // always showed every service as "Healthy" with fabricated latency and
  // uptime numbers, regardless of real system state.
  const services: ServiceHealth[] = health
    ? [
        {
          name: "PostgreSQL Database",
          status: health.database || "UNKNOWN",
          details: "Live SELECT 1 connectivity check against the configured DATABASE_URL.",
          icon: Database,
        },
        {
          name: "Redis Cache Store",
          status: health.redis || "UNKNOWN",
          details: "Real PING round-trip against the configured Redis connection.",
          icon: HardDrive,
        },
        {
          name: "SMTP Email Server",
          status: health.email || "UNKNOWN",
          details: "Live SMTP transporter.verify() against the configured mail host.",
          icon: Mail,
        },
        {
          name: "Object Storage (Local Disk)",
          status: health.storage || "UNKNOWN",
          details: "Live write/read probe against the configured disk mount.",
          icon: HardDrive,
        },
        {
          name: "Socket.IO Real-time Engine",
          status: health.socketio || "UNKNOWN",
          details: "Reports UP only if the server actually initialized the Socket.IO instance at boot.",
          icon: Activity,
        },
        {
          name: "Core API Process",
          status: "UP",
          details: `Node process uptime: ${formatUptime(health.apiUptime || 0)}.`,
          icon: Zap,
        },
      ]
    : []

  const statusStyles: Record<string, string> = {
    UP: "text-emerald-700 bg-emerald-100/60 dark:bg-emerald-950/30 dark:text-emerald-350",
    DOWN: "text-red-700 bg-red-100/60 dark:bg-red-950/30 dark:text-red-350",
    UNKNOWN: "text-slate-600 bg-slate-100/60 dark:bg-slate-800 dark:text-slate-350",
  }

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Checking system health...</div>
  }

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
            <Activity className="size-6 text-[#6B2C91] dark:text-pink-300" />
            Infrastructure Status
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Live connectivity checks against the database, cache, mail, storage, and real-time systems.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <Clock className="size-3.5" />
            Last Check: {lastCheck}
          </span>
          <Button
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-250/20 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-white dark:border-slate-800"
          >
            <RefreshCw className={`size-3 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Systems
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-pink-200 bg-pink-50 px-4 py-2.5 text-xs font-bold text-pink-700 dark:border-pink-900 dark:bg-pink-950/30 dark:text-pink-300">
          {error}
        </div>
      )}

      {/* Health Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => (
          <DashboardCard
            key={svc.name}
            className="p-5 flex flex-col justify-between space-y-4 relative overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-16 translate-x-16 ${svc.status === "UP" ? "bg-emerald-500/5 dark:bg-emerald-500/2" : "bg-red-500/5 dark:bg-red-500/2"}`} />

            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                  Service Node
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <svc.icon className="size-4 text-[#6B2C91] dark:text-pink-300" />
                  {svc.name}
                </h3>
              </div>
              <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full relative ${statusStyles[svc.status]}`}>
                <span className={`size-1.5 rounded-full ${svc.status === "UP" ? "bg-emerald-500" : svc.status === "DOWN" ? "bg-red-500" : "bg-slate-400"}`} />
                {svc.status}
              </span>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">
                {svc.details}
              </p>
            </div>
          </DashboardCard>
        ))}
      </div>

      {/* real dead-letter queue depth.
          Previously the backend's real BullMQ queue counters (activeJobs/
          completedJobs/failedJobs) existed but were never surfaced here at
          all, and there was no real DLQ to report on in the first place --
          see queue.ts's getDeadLetterQueueStats(). */}
      {health?.queues && (
        <DashboardCard className="p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white">
              Background Job Queues
            </h4>
          </div>
          <div className="grid gap-6 md:grid-cols-4 text-xs">
            <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-white">
                Active Jobs
                <MetricTag isCounter={false} />
              </h5>
              <p className="text-lg font-black text-slate-900 dark:text-white">{health.queues.activeJobs ?? 0}</p>
            </div>
            <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-white">
                Completed Jobs
                <MetricTag isCounter={true} />
              </h5>
              <p className="text-lg font-black text-slate-900 dark:text-white">{health.queues.completedJobs ?? 0}</p>
            </div>
            <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-white">
                Failed Jobs
                <MetricTag isCounter={true} />
              </h5>
              <p className="text-lg font-black text-slate-900 dark:text-white">{health.queues.failedJobs ?? 0}</p>
            </div>
            <div className="p-4 border border-pink-150 rounded-xl dark:border-pink-900/40 space-y-2 bg-pink-50/30 dark:bg-pink-950/10">
              <h5 className="font-bold text-slate-900 dark:text-white">
                Dead-Letter Queue Pending
                <MetricTag isCounter={false} />
              </h5>
              <p className="text-lg font-black text-pink-600 dark:text-pink-300">{health.queues.deadLetterPendingCount ?? 0}</p>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                Jobs that exhausted all retry attempts and are held for manual review. Backed by a real Redis-durable
                queue, so unlike the counters above this survives a server restart.
              </p>
            </div>
          </div>
        </DashboardCard>
      )}

      {/* Real-time socket connections + notification throughput -- computed
          server-side (socketMetrics in shared/socket/socket.ts) but never
          rendered anywhere on this page before, even though the backend
          was already tracking it live. messagesSec (chat's per-second
          message rate) has been removed entirely rather than kept as a
          placeholder -- real-time chat was isolated and removed from the
          app, so nothing increments it anymore and it would only ever
          read 0. */}
      {health?.sockets && (
        <DashboardCard className="p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white flex items-center gap-1.5">
              <Users className="size-3.5 text-[#6B2C91] dark:text-pink-300" />
              Real-time Connections
            </h4>
          </div>
          <div className="grid gap-6 md:grid-cols-4 text-xs">
            <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-white">
                Candidates Online
                <MetricTag isCounter={false} />
              </h5>
              <p className="text-lg font-black text-slate-900 dark:text-white">{health.sockets.connectedCandidates ?? 0}</p>
            </div>
            <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-white">
                Recruiters Online
                <MetricTag isCounter={false} />
              </h5>
              <p className="text-lg font-black text-slate-900 dark:text-white">{health.sockets.connectedRecruiters ?? 0}</p>
            </div>
            <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-white">
                Admins Online
                <MetricTag isCounter={false} />
              </h5>
              <p className="text-lg font-black text-slate-900 dark:text-white">{health.sockets.connectedAdmins ?? 0}</p>
            </div>
            <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-white">
                Notifications / sec
                <MetricTag isCounter={false} />
              </h5>
              <p className="text-lg font-black text-slate-900 dark:text-white">{health.sockets.notificationsSec ?? 0}</p>
            </div>
          </div>
        </DashboardCard>
      )}

      {/* Email delivery + storage operation counters -- also real (email.ts's
          emailMetrics, fileStorage.ts's storageMetrics), also already
          returned by the API, also never rendered here before now. */}
      <div className="grid gap-4 md:grid-cols-2">
        {health?.emailDelivery && (
          <DashboardCard className="p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
              <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white flex items-center gap-1.5">
                <Mail className="size-3.5 text-[#6B2C91] dark:text-pink-300" />
                Email Delivery
              </h4>
            </div>
            <div className="grid gap-4 grid-cols-2 text-xs">
              <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
                <h5 className="font-bold text-slate-900 dark:text-white">
                  Sent
                  <MetricTag isCounter={true} />
                </h5>
                <p className="text-lg font-black text-slate-900 dark:text-white">{health.emailDelivery.sent ?? 0}</p>
              </div>
              <div className="p-4 border border-pink-150 rounded-xl dark:border-pink-900/40 space-y-2 bg-pink-50/30 dark:bg-pink-950/10">
                <h5 className="font-bold text-slate-900 dark:text-white">
                  Failed
                  <MetricTag isCounter={true} />
                </h5>
                <p className="text-lg font-black text-pink-600 dark:text-pink-300">{health.emailDelivery.failed ?? 0}</p>
              </div>
            </div>
          </DashboardCard>
        )}

        {health?.storageMetrics && (
          <DashboardCard className="p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
              <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white flex items-center gap-1.5">
                <UploadCloud className="size-3.5 text-[#6B2C91] dark:text-pink-300" />
                Storage Operations
              </h4>
            </div>
            <div className="grid gap-4 grid-cols-2 text-xs">
              <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
                <h5 className="font-bold text-slate-900 dark:text-white">
                  Uploads
                  <MetricTag isCounter={true} />
                </h5>
                <p className="text-lg font-black text-slate-900 dark:text-white">{health.storageMetrics.uploadCount ?? 0}</p>
              </div>
              <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
                <h5 className="font-bold text-slate-900 dark:text-white">
                  Deletes
                  <MetricTag isCounter={true} />
                </h5>
                <p className="text-lg font-black text-slate-900 dark:text-white">{health.storageMetrics.deleteCount ?? 0}</p>
              </div>
              <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
                <h5 className="font-bold text-slate-900 dark:text-white">
                  Avg Latency
                  <MetricTag isCounter={true} />
                </h5>
                <p className="text-lg font-black text-slate-900 dark:text-white">{health.storageMetrics.averageLatencyMs ?? 0} ms</p>
              </div>
              <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
                <h5 className="font-bold text-slate-900 dark:text-white">
                  Retries
                  <MetricTag isCounter={true} />
                </h5>
                <p className="text-lg font-black text-slate-900 dark:text-white">{health.storageMetrics.retryCount ?? 0}</p>
              </div>
            </div>
          </DashboardCard>
        )}
      </div>

      {/* Process Resource Usage */}
      {health && (
        <DashboardCard className="p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white">
              API Process Resource Usage
            </h4>
          </div>
          <div className="grid gap-6 md:grid-cols-3 text-xs">
            <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-white">Process Uptime</h5>
              <p className="text-lg font-black text-slate-900 dark:text-white">{formatUptime(health.apiUptime || 0)}</p>
              {health.processStartedAt && (
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  Server last restarted {new Date(health.processStartedAt).toLocaleString()}. Every
                  "Since Restart" counter on this page has been accumulating since then, not since the platform launched.
                </p>
              )}
            </div>
            <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-white">Heap Memory Used</h5>
              <p className="text-lg font-black text-slate-900 dark:text-white">
                {health.memoryUsage ? formatBytes(health.memoryUsage.heapUsed) : "N/A"}
              </p>
            </div>
            <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-white">RSS Memory</h5>
              <p className="text-lg font-black text-slate-900 dark:text-white">
                {health.memoryUsage ? formatBytes(health.memoryUsage.rss) : "N/A"}
              </p>
            </div>
          </div>
        </DashboardCard>
      )}
    </div>
  )
}
export default SystemHealth
