import { useState, useEffect } from "react"
import {
  Activity,
  Clock,
  HardDrive,
  Database,
  Mail,
  Zap,
  RefreshCw,
} from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"

interface ServiceHealth {
  name: string
  status: "Healthy" | "Degraded" | "Down"
  latency: string
  uptime: string
  details: string
  icon: React.ComponentType<{ className?: string }>
}

export function SystemHealth() {
  const [refreshing, setRefreshing] = useState(false)
  const [lastCheck, setLastCheck] = useState("")

  const getTimestamp = () => {
    return new Date().toLocaleTimeString()
  }

  useEffect(() => {
    setLastCheck(getTimestamp())
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      setLastCheck(getTimestamp())
    }, 1000)
  }

  const services: ServiceHealth[] = [
    {
      name: "Core API Gateway",
      status: "Healthy",
      latency: "42 ms",
      uptime: "99.92%",
      details: "Load average: 1.45. Version v1.2.0 active.",
      icon: Zap,
    },
    {
      name: "PostgreSQL Database",
      status: "Healthy",
      latency: "6 ms",
      uptime: "99.98%",
      details: "Connections: 45/200 active. Buffer hit rate: 99.8%.",
      icon: Database,
    },
    {
      name: "Redis Cache Store",
      status: "Healthy",
      latency: "1 ms",
      uptime: "100.00%",
      details: "Memory utilization: 124MB / 512MB (24%). Key eviction rate: 0/s.",
      icon: HardDrive,
    },
    {
      name: "SMTP Email Server",
      status: "Healthy",
      latency: "420 ms",
      uptime: "99.85%",
      details: "Send queue: 0 pending. Daily relay usage: 1,420 / 10,000 sent.",
      icon: Mail,
    },
    {
      name: "Socket.IO Real-time Engine",
      status: "Healthy",
      latency: "12 ms",
      uptime: "99.90%",
      details: "Active connections: 1,242 WebSocket sessions. Message rate: 45/s.",
      icon: Activity,
    },
    {
      name: "Object Storage Bucket",
      status: "Healthy",
      latency: "115 ms",
      uptime: "99.99%",
      details: "Total files: 142k (Resume PDFs, images). Storage size: 1.2 TB / 10 TB.",
      icon: HardDrive,
    },
  ]

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
            Real-time status overview, latency charts, and uptime check indices for platform systems.
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

      {/* Health Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => (
          <DashboardCard
            key={svc.name}
            className="p-5 flex flex-col justify-between space-y-4 relative overflow-hidden"
          >
            {/* Heartbeat pulse overlay */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/2 rounded-full -translate-y-16 translate-x-16" />

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
              <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-100/60 dark:bg-emerald-950/30 dark:text-emerald-350 px-2 py-0.5 rounded-full relative">
                <span className="size-1.5 rounded-full bg-emerald-500 motion-safe:animate-ping absolute left-2" />
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {svc.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-100 py-3 dark:border-slate-850">
              <div className="space-y-0.5">
                <p className="text-[9px] font-black text-slate-450 uppercase dark:text-slate-500">Latency</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{svc.latency}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black text-slate-450 uppercase dark:text-slate-500">Uptime Check</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{svc.uptime}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">
                {svc.details}
              </p>
            </div>
          </DashboardCard>
        ))}
      </div>

      {/* Platform Load Overview */}
      <DashboardCard className="p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
          <h4 className="text-xs font-black text-slate-900 uppercase dark:text-white">
            System Operations Threshold logs
          </h4>
        </div>
        <div className="grid gap-6 md:grid-cols-3 text-xs">
          <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
            <h5 className="font-bold text-slate-900 dark:text-white">Server CPU utilization</h5>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#6B2C91] dark:bg-pink-600 rounded-full" style={{ width: "34%" }} />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-500">
              <span>Usage: 34%</span>
              <span>Uptime: 14 Days</span>
            </div>
          </div>
          <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
            <h5 className="font-bold text-slate-900 dark:text-white">API Network Traffic</h5>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: "62%" }} />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-500">
              <span>Bandwidth: 142 Mbps</span>
              <span>Capacity: 500 Mbps</span>
            </div>
          </div>
          <div className="p-4 border border-slate-150 rounded-xl dark:border-slate-850 space-y-2">
            <h5 className="font-bold text-slate-900 dark:text-white">Email Delivery Rates</h5>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: "99%" }} />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-500">
              <span>Delivered: 99.5%</span>
              <span>Bounced: 0.5%</span>
            </div>
          </div>
        </div>
      </DashboardCard>
    </div>
  )
}
export default SystemHealth
