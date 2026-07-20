import { useState, useEffect } from "react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { ChevronRight, Calendar, User, ArrowLeft, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CompanyLogo } from "@/components/shared/CompanyLogo"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { DashboardCard } from "@/components/dashboard/DashboardCard"
import { ApplicationTimeline } from "../components/Applications/ApplicationTimeline"
import { CandidateJobsApi, mapApiApplication, type DisplayApplication } from "../services/jobsApi"
import type { Application } from "@/types/dashboard"

export function Applications() {
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)

  // Mobile/Tablet detail drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [mobileShowTimeline, setMobileShowTimeline] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const rawApplications = await CandidateJobsApi.getApplications()
        const mapped: DisplayApplication[] = rawApplications.map(mapApiApplication)
        if (cancelled) return
        setApplications(mapped)
        if (mapped.length > 0) {
          setSelectedApp(mapped[0])
        }
      } catch (err: any) {
        console.error("Failed to load applications", err)
        toast.error(err?.message || "Failed to load your applications.")
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSelectApplication = (app: Application) => {
    setSelectedApp(app)
    setIsDrawerOpen(true)
    setMobileShowTimeline(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <div>
        <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          My Applications
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Track the status and timelines of your job applications.
        </p>
      </div>

      {applications.length > 0 ? (
        <>
          {/* Mobile view timeline split */}
          {mobileShowTimeline && selectedApp ? (
            <div className="md:hidden space-y-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMobileShowTimeline(false)}
                className="h-8 gap-1 text-xs text-[#6B2C91] hover:text-[#5a237b] dark:text-pink-200"
              >
                <ArrowLeft className="size-3.5" />
                Back to Application List
              </Button>
              <ApplicationTimeline
                application={selectedApp}
                onClose={() => setMobileShowTimeline(false)}
              />
            </div>
          ) : (
            <div className={cn(mobileShowTimeline ? "hidden md:grid" : "grid", "gap-6 lg:grid-cols-12")}>
              {/* Left Column: Applications Table (Desktop) / Cards List (Tablet/Mobile) */}
              <div className="lg:col-span-8 space-y-4">
                {/* Desktop view table */}
                <div className="hidden xl:block">
                  <DashboardCard className="overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 dark:bg-slate-950/45">
                          <TableHead className="w-52">Company</TableHead>
                          <TableHead className="w-44">Job Role</TableHead>
                          <TableHead>Applied Date</TableHead>
                          <TableHead>Recruiter</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {applications.map((app) => {
                          const isActive = selectedApp?.id === app.id
                          return (
                            <TableRow
                              key={app.id}
                              onClick={() => setSelectedApp(app)}
                              className={cn(
                                "cursor-pointer transition-colors",
                                isActive
                                  ? "bg-violet-50/60 hover:bg-violet-50/70 dark:bg-violet-500/10 dark:hover:bg-violet-500/15"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-900/40"
                              )}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <CompanyLogo
                                    code={app.companyCode}
                                    tone={
                                      app.companyCode === "CM"
                                        ? "green"
                                        : app.companyCode === "WA"
                                          ? "blue"
                                          : app.companyCode === "BC"
                                            ? "pink"
                                            : "purple"
                                    }
                                    className="size-8"
                                  />
                                  <span className="text-xs font-extrabold text-slate-950 dark:text-white truncate max-w-32">
                                    {app.company}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                {app.job}
                              </TableCell>
                              <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                                {app.appliedDate}
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {app.recruiter?.name ?? "Not Assigned"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={app.status} />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Select the row (updates the desktop right-hand panel)
                                    // AND open the drawer, so the click always produces
                                    // visible feedback even if the right-hand column happens
                                    // to be out of view (short window, already-selected row,
                                    // etc).
                                    setSelectedApp(app)
                                    setIsDrawerOpen(true)
                                  }}
                                  className="h-7 gap-1 text-xs text-[#6B2C91] dark:text-pink-200"
                                >
                                  View Details
                                  <ChevronRight className="size-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </DashboardCard>
                </div>

                {/* Tablet / Mobile Cards View */}
                <div className="xl:hidden grid gap-4 sm:grid-cols-2">
                  {applications.map((app) => (
                    <motion.div
                      key={app.id}
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => handleSelectApplication(app)}
                    >
                      <DashboardCard
                        className={cn(
                          "p-4 cursor-pointer border transition-all",
                          selectedApp?.id === app.id
                            ? "border-[#6B2C91] dark:border-pink-400/50 shadow-md"
                            : "border-slate-200/70"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <CompanyLogo
                            code={app.companyCode}
                            tone={
                              app.companyCode === "CM"
                                ? "green"
                                : app.companyCode === "WA"
                                  ? "blue"
                                  : app.companyCode === "BC"
                                    ? "pink"
                                    : "purple"
                            }
                            className="size-10"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {app.job}
                            </h4>
                            <p className="text-[11px] font-semibold text-slate-500 truncate">
                              {app.company}
                            </p>
                          </div>
                          <StatusBadge status={app.status} />
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3.5" />
                            {app.appliedDate}
                          </span>
                          {app.recruiter && (
                            <span className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                              <User className="size-3.5" />
                              {app.recruiter.name}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-[11px] font-extrabold text-[#6B2C91] dark:text-pink-200 p-0"
                          >
                            <Eye className="size-3.5" />
                            Show Timeline
                          </Button>
                        </div>
                      </DashboardCard>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Right Column: Timeline details (Only visible on Desktop, handled by drawer on Tablet/Mobile) */}
              <div className="hidden lg:block lg:col-span-4 h-full">
                {selectedApp ? (
                  <div className="sticky top-20">
                    <ApplicationTimeline application={selectedApp} />
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center border border-dashed border-slate-200 rounded-xl dark:border-slate-800 text-slate-400">
                    Select an application to view status timeline.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Drawer / Sheet popup for Tablet screen widths */}
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetContent
              side="right"
              className="w-full max-w-[400px] p-0 border-l border-slate-200 dark:border-slate-800"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Timeline Drawer</SheetTitle>
              </SheetHeader>
              {selectedApp && (
                <ApplicationTimeline
                  application={selectedApp}
                  onClose={() => setIsDrawerOpen(false)}
                />
              )}
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <div className="py-12">
          <DashboardCard className="p-8 text-center max-w-md mx-auto">
            <p className="text-sm font-semibold text-slate-500">
              No submitted applications found.
            </p>
          </DashboardCard>
        </div>
      )}
    </motion.div>
  )
}

// Inline className helper
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ")
}
