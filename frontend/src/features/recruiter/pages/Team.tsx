import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Users,
  UserPlus,
  Mail,
  Trash2,
  Calendar,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { RecruiterApi } from "../services/recruiterApi"

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
})

type InviteFormValues = z.infer<typeof inviteSchema>

interface Member {
  id: string
  userId: string
  fullName: string
  email: string
  phone: string | null
  verified: boolean
  status: string
}

interface PendingInvitation {
  id: string
  email: string
  createdAt: string
  expiresAt: string
  status: string
}

export function Team() {
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [companyName, setCompanyName] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
    },
  })

  const loadTeamData = async () => {
    try {
      const data = await RecruiterApi.getTeam()
      setMembers(data.members || [])
      setInvitations(data.invitations || [])
      setCompanyName(data.companyName || "")
    } catch (err: any) {
      console.error("Failed to load recruiter team data", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTeamData()
  }, [])

  const onInviteSubmit = async (data: InviteFormValues) => {
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      await RecruiterApi.inviteColleague(data.email)
      setSuccessMsg(`Colleague invitation sent to ${data.email} successfully.`)
      reset()
      loadTeamData()
      setTimeout(() => setSuccessMsg(null), 5000)
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send invitation. Please try again.")
    }
  }

  const handleCancelInvite = async (inviteId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to cancel the invitation for ${email}?`)) {
      return
    }
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      await RecruiterApi.cancelColleagueInvitation(inviteId)
      setSuccessMsg("Invitation cancelled successfully.")
      loadTeamData()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to cancel invitation.")
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-sm font-bold text-[#6B2C91]">Loading team management dashboard...</div>
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
            <Users className="size-6 text-[#6B2C91] dark:text-pink-500" />
            Manage Team
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {companyName ? `Corporate account for ${companyName}. ` : ""}
            Invite and manage colleague credentials, recruiter status, and permissions.
          </p>
        </div>
      </div>

      {/* Message Banners */}
      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl text-xs font-black flex items-center gap-2.5 border border-emerald-100 dark:border-emerald-950/50 select-none animate-fadeIn">
          <CheckCircle className="size-4 shrink-0 stroke-[3]" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-black flex items-center gap-2.5 border border-red-100 dark:border-red-950/50 select-none animate-fadeIn">
          <AlertCircle className="size-4 shrink-0 stroke-[3]" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Invitation Form Card (Left Col) */}
        <div className="md:col-span-1">
          <DashboardCard className="p-5 space-y-4 h-fit">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <UserPlus className="size-4 text-[#6B2C91] dark:text-pink-500" />
              <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white">
                Invite Colleague
              </h3>
            </div>
            <form onSubmit={handleSubmit(onInviteSubmit)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    {...register("email")}
                    placeholder="colleague@company.com"
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-850 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                {errors.email && <p className="text-[10px] font-bold text-red-500">{errors.email.message}</p>}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#6B2C91] hover:bg-[#5a237b] text-white font-extrabold text-xs h-9 gap-1.5 cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700"
              >
                {isSubmitting ? "Inviting..." : "Send Invitation"}
                <ArrowRight className="size-3.5" />
              </Button>
            </form>
          </DashboardCard>
        </div>

        {/* Team Lists Card (Right 2 Cols) */}
        <div className="md:col-span-2 space-y-6">
          {/* Active Members */}
          <DashboardCard className="p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800 flex items-center justify-between">
              <span>Active Colleagues</span>
              <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-350 px-2 py-0.5 rounded-full text-[9px] font-black">
                {members.length} {members.length === 1 ? "member" : "members"}
              </span>
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.length === 0 ? (
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 py-4 text-center">
                  No active team members registered.
                </p>
              ) : (
                members.map((member) => (
                  <div key={member.id} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0 gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {member.fullName}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate">
                        {member.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-650 dark:bg-slate-800 dark:text-slate-300">
                        <ShieldCheck className="size-3 text-slate-500" />
                        Recruiter
                      </span>
                      {/* Part 17 accessible status colors: non-Active
                          (PendingVerification/PendingApproval etc.) moved
                          from amber to Blue. */}
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                        member.status === "Active"
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
                      }`}>
                        {member.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DashboardCard>

          {/* Pending Invitations */}
          <DashboardCard className="p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800 flex items-center justify-between">
              <span>Pending Invitations</span>
              <span className="bg-[#6B2C91]/10 text-[#6B2C91] dark:bg-pink-950/40 dark:text-pink-300 px-2 py-0.5 rounded-full text-[9px] font-black">
                {invitations.length} {invitations.length === 1 ? "invite" : "invites"}
              </span>
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {invitations.length === 0 ? (
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 py-4 text-center">
                  No pending corporate invitations.
                </p>
              ) : (
                invitations.map((invite) => (
                  <div key={invite.id} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0 gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {invite.email}
                      </p>
                      <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                        <Calendar className="size-3 shrink-0" />
                        Expires: {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                        onClick={() => handleCancelInvite(invite.id, invite.email)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  )
}
export default Team
