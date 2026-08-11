import { Fragment, useEffect, useMemo, useState, useCallback } from "react"
import { Shield, RefreshCw, Check, Plus, Users, ChevronDown, ChevronRight, Search, Info } from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AdminApi } from "../services/adminApi"

interface ApiPermission {
  id: string
  name: string
}

interface ApiRole {
  id: string
  name: string
  permissions: { permission: ApiPermission }[]
}

// Candidate and Recruiter are base account types, not admin-tier access
// policy (see backend/src/shared/constants/roles.ts's ADMIN_TIER_ROLES,
// which deliberately excludes them) -- nobody realistically reconfigures
// their permission set from this screen. Shown as a collapsed, read-only
// reference below the editor instead of a second always-visible table.
const BASE_ROLE_NAMES = new Set(["Candidate", "Recruiter"])

// Human-readable label + description for every seeded permission, plus
// whether the backend actually checks it via requirePermission() at request
// time. Every permission below is wired into at least one real route
// (admin.routes.ts / recruiter.routes.ts / support.routes.ts) -- either
// REPLACING a coarse role-name gate outright, or LAYERED as an additional
// AND-condition alongside an existing, more specific role gate for
// destructive/sensitive actions, so today's explicit role boundaries can
// only get narrower, never wider, than before. manage:notifications is the
// one exception -- disclosed honestly below rather than force-mapped onto
// an admin's own personal notification inbox, which every admin-tier role
// needs regardless of any permission.
//
// manage:job and moderate:job were previously three and two separate
// permissions respectively (create/update/delete:job, approve/reject:job).
// No role ever held one of a group without the others -- every route that
// checked them required all of them together anyway -- so they're
// consolidated here into one toggle each, matching what the backend now
// actually checks.
interface PermissionMeta {
  label: string
  description: string
  enforced: boolean
  enforcedNote: string
  category: "Job Lifecycle" | "People" | "Platform Operations"
}

const PERMISSION_META: Record<string, PermissionMeta> = {
  "manage:job": {
    label: "Manage Jobs",
    description: "Create, edit, or delete job listings on behalf of a company.",
    enforced: true,
    enforcedNote: "Gates POST/PUT/DELETE on /recruiters/jobs* -- create, update, archive, lifecycle actions, duplicate, and delete. Consolidated from three separate permissions (create/update/delete:job) that were never granted independently of each other.",
    category: "Job Lifecycle",
  },
  "read:job": {
    label: "View Jobs",
    description: "View job listings and their details.",
    enforced: true,
    enforcedNote: "Gates GET /recruiters/jobs, GET .../jobs/:id, and the admin job-moderation list (GET /admins/jobs). Note: Candidate also holds this permission (for browsing public listings), so it doesn't by itself stop a Candidate account from reaching a recruiter's own job list -- ownership checks handle that.",
    category: "Job Lifecycle",
  },
  "moderate:job": {
    label: "Moderate Jobs",
    description: "Approve or reject a pending job submission.",
    enforced: true,
    enforcedNote: "Gates POST /admins/jobs/:id/moderate (a single endpoint handles both approve and reject). Consolidated from two separate permissions (approve/reject:job) that were never granted independently of each other.",
    category: "Job Lifecycle",
  },
  "manage:users": {
    label: "Manage Users",
    description: "Suspend/delete a user account, trigger administrative account actions, and (together with Super Admin) assign roles to a user.",
    enforced: true,
    enforcedNote: "Gates PUT /admins/users/:id/status, DELETE /admins/users/:id, POST .../action/:action, and (layered with Super Admin) POST /api/v1/rbac/users/:id/roles.",
    category: "People",
  },
  "manage:companies": {
    label: "Manage Companies",
    description: "View, verify, suspend, or delete recruiter companies.",
    enforced: true,
    enforcedNote: "Gates GET/verify on /admins/companies outright, and (layered with Admin/Super Admin) suspend/unsuspend/delete.",
    category: "People",
  },
  "verify:recruiters": {
    label: "Verify Individual Recruiters",
    description: "Manually verify a single recruiter account (separate from the company-level verification above).",
    enforced: true,
    enforcedNote: "Layered with Admin/Super Admin on PUT /admins/recruiters/:id/verify.",
    category: "People",
  },
  "manage:perks": {
    label: "Manage Perk Requests",
    description: "Review and approve or reject company perk submissions.",
    enforced: true,
    enforcedNote: "Gates GET /admins/perks and POST /admins/perks/:id/review. Seeded to all four admin-tier roles today (matching the blanket admin-tier access this section always had), so this doesn't restrict anyone new yet -- it just makes that access genuinely follow the RBAC Matrix.",
    category: "People",
  },
  "manage:invitations": {
    label: "Manage Employee Invitations",
    description: "Send, resend, cancel, or expire an invitation for a new admin-tier employee.",
    enforced: true,
    enforcedNote: "Layered with Admin/Super Admin on every /admins/invitations* route.",
    category: "People",
  },
  "manage:admins": {
    label: "Manage Admin Accounts",
    description: "Create administrator accounts and revoke a single role from one, end to end.",
    enforced: true,
    enforcedNote: "Layered with Super Admin on every /admins/management/admins* route -- the most sensitive module on the admin surface, since it creates and edits other admin-tier accounts.",
    category: "People",
  },
  "manage:reports": {
    label: "Manage Reports",
    description: "Export the full Reports & Analytics CSV.",
    enforced: true,
    enforcedNote: "Layered with Admin/Super Admin on the CSV export path of GET /admins/reports. The plain JSON summary (for the trend chart) stays open to every admin-tier role regardless of this permission.",
    category: "Platform Operations",
  },
  "manage:notifications": {
    label: "Manage Notifications",
    description: "Configure platform-wide notification behavior.",
    enforced: false,
    enforcedNote: "No real route currently maps to this -- the only notification endpoints in the app are each admin's own personal inbox (view/mark-read/delete their own notifications), which every admin-tier role needs regardless of any permission. Left honestly unenforced rather than gated onto something it doesn't actually mean.",
    category: "Platform Operations",
  },
  "manage:features": {
    label: "Manage Feature Flags",
    description: "Toggle platform feature flags on or off.",
    enforced: true,
    enforcedNote: "Layered with Super Admin on all feature-flag mutation routes -- stays Super-Admin-only in practice; this permission can only narrow that boundary further, not widen it.",
    category: "Platform Operations",
  },
  "manage:roles": {
    label: "Manage Roles",
    description: "Create, edit, or delete roles and assign permissions to them.",
    enforced: true,
    enforcedNote: "Gates create/update/delete on /api/v1/rbac/roles -- including the exact endpoint this page's toggles call (POST /api/v1/rbac/roles/:id/permissions).",
    category: "Platform Operations",
  },
  "manage:permissions": {
    label: "Manage Permissions",
    description: "Create, edit, or delete permission definitions.",
    enforced: true,
    enforcedNote: "Gates every Permission CRUD endpoint under /api/v1/rbac.",
    category: "Platform Operations",
  },
  "manage:support-tickets": {
    label: "Manage Support Tickets",
    description: "Change a support ticket's status (open/in progress/resolved).",
    enforced: true,
    enforcedNote: "Layered with Support Executive/Admin/Super Admin on PUT /support-tickets/:id/status.",
    category: "Platform Operations",
  },
  "manage:platform-settings": {
    label: "Manage Platform Settings",
    description: "Change general, non-security platform settings (currently the Operations Support Contacts helpdesk email).",
    enforced: true,
    enforcedNote: "Layered with Admin/Super Admin on PUT /admins/platform-settings. Viewing stays open to every admin-tier role regardless of this permission.",
    category: "Platform Operations",
  },
}

const CATEGORY_ORDER: PermissionMeta["category"][] = ["Job Lifecycle", "People", "Platform Operations"]

const FALLBACK_META: PermissionMeta = {
  label: "",
  description: "No description recorded for this permission yet.",
  enforced: false,
  enforcedNote: "Enforcement status unknown -- not one of the seeded permissions this page has a record for.",
  category: "Platform Operations",
}

function metaFor(permission: ApiPermission): PermissionMeta {
  return PERMISSION_META[permission.name] || { ...FALLBACK_META, label: permission.name }
}

function matchesSearch(permission: ApiPermission, meta: PermissionMeta, query: string): boolean {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  return (
    meta.label.toLowerCase().includes(q) ||
    permission.name.toLowerCase().includes(q) ||
    meta.description.toLowerCase().includes(q)
  )
}

export function RolesPermissions() {
  const [roles, setRoles] = useState<ApiRole[]>([])
  const [permissions, setPermissions] = useState<ApiPermission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingPermissionId, setPendingPermissionId] = useState<string | null>(null)
  const [newRoleName, setNewRoleName] = useState("")
  const [creatingRole, setCreatingRole] = useState(false)

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [showComparison, setShowComparison] = useState(false)
  const [showBaseRoles, setShowBaseRoles] = useState(false)

  const load = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await AdminApi.getRBAC()
      setRoles(data.roles || [])
      setPermissions(data.permissions || [])
    } catch (err) {
      console.error("Failed to load RBAC data:", err)
      setError("Failed to load roles & permissions from the server.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const adminRoles = useMemo(() => roles.filter((r) => !BASE_ROLE_NAMES.has(r.name)), [roles])
  const baseRoles = useMemo(() => roles.filter((r) => BASE_ROLE_NAMES.has(r.name)), [roles])

  // Keep a valid role selected as data loads/changes -- default to the
  // first admin-tier role once one is available.
  useEffect(() => {
    if (adminRoles.length === 0) return
    if (!selectedRoleId || !adminRoles.some((r) => r.id === selectedRoleId)) {
      setSelectedRoleId(adminRoles[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminRoles.map((r) => r.id).join(",")])

  const selectedRole = adminRoles.find((r) => r.id === selectedRoleId) || null

  const hasPermission = (role: ApiRole, permissionId: string) =>
    role.permissions.some((rp) => rp.permission.id === permissionId)

  const handleToggle = async (role: ApiRole, permission: ApiPermission) => {
    const currentlyHas = hasPermission(role, permission.id)
    const nextNames = currentlyHas
      ? role.permissions.filter((rp) => rp.permission.id !== permission.id).map((rp) => rp.permission.name)
      : [...role.permissions.map((rp) => rp.permission.name), permission.name]

    // Optimistic update
    const prevRoles = roles
    setRoles((prev) =>
      prev.map((r) =>
        r.id === role.id
          ? {
              ...r,
              permissions: currentlyHas
                ? r.permissions.filter((rp) => rp.permission.id !== permission.id)
                : [...r.permissions, { permission }],
            }
          : r
      )
    )
    setPendingPermissionId(permission.id)

    try {
      await AdminApi.updateRolePermissions(role.id, nextNames)
    } catch (err) {
      console.error("Failed to update role permissions:", err)
      setRoles(prevRoles)
      setError(`Failed to update "${permission.name}" for ${role.name}. You may not have Super Admin rights.`)
    } finally {
      setPendingPermissionId(null)
    }
  }

  const handleCreateRole = async () => {
    const name = newRoleName.trim()
    if (!name) return
    try {
      setCreatingRole(true)
      setError(null)
      await AdminApi.createRole(name, [])
      setNewRoleName("")
      await load()
    } catch (err) {
      console.error("Failed to create role:", err)
      setError(`Failed to create role "${name}". You may not have Super Admin rights.`)
    } finally {
      setCreatingRole(false)
    }
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const unenforcedPermissions = permissions.filter((p) => !metaFor(p).enforced)

  const groupedPermissions = CATEGORY_ORDER.map((category) => ({
    category,
    items: permissions.filter((p) => metaFor(p).category === category),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
            <Shield className="size-6 text-[#6B2C91] dark:text-pink-300" />
            Roles & Permissions Matrix
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Pick a role, then toggle what it can do. Changes persist immediately per toggle.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            disabled={isLoading}
            className="h-8 text-xs font-bold border-slate-200 hover:bg-slate-100"
          >
            <RefreshCw className={`size-3 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-pink-200 bg-pink-50 px-4 py-2.5 text-xs font-bold text-pink-700 dark:border-pink-900 dark:bg-pink-950/30 dark:text-pink-300">
          {error}
        </div>
      )}

      {/* Single enforcement disclosure, replacing a per-row badge on every
          permission -- almost everything below is genuinely enforced now,
          so repeating that on every row was just noise. Only call out the
          exceptions. */}
      {!isLoading && permissions.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-400 flex items-start gap-1.5">
          <Info className="size-3.5 shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" />
          {unenforcedPermissions.length === 0 ? (
            <span>All {permissions.length} permissions below are actually enforced by the backend.</span>
          ) : (
            <span>
              {permissions.length - unenforcedPermissions.length} of {permissions.length} permissions are enforced.
              Not yet enforced: {unenforcedPermissions.map((p) => metaFor(p).label || p.name).join(", ")} -- hover its
              row for why.
            </span>
          )}
        </div>
      )}

      {/* Add role */}
      <DashboardCard className="p-4 flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input
          placeholder="New role name (e.g. Support Executive)"
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
          className="text-xs h-9 max-w-xs"
        />
        <Button
          size="sm"
          onClick={handleCreateRole}
          disabled={creatingRole || !newRoleName.trim()}
          className="h-9 text-xs font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700 flex items-center gap-1.5"
        >
          <Plus className="size-3.5" />
          {creatingRole ? "Creating..." : "Add Role"}
        </Button>
      </DashboardCard>

      {/* Role-focused editor -- one role's permission checklist at a time,
          instead of every role's toggles visible simultaneously. */}
      <DashboardCard className="p-4">
        {isLoading ? (
          <div className="py-12 flex flex-col justify-center items-center gap-2">
            <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Fetching RBAC policies...
            </p>
          </div>
        ) : adminRoles.length === 0 || permissions.length === 0 ? (
          <p className="py-8 text-center text-xs font-bold text-slate-400">No roles or permissions found.</p>
        ) : (
          <>
            {/* Role tabs */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {adminRoles.map((role) => {
                const isActive = role.id === selectedRoleId
                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${
                      isActive
                        ? "bg-[#6B2C91] text-white dark:bg-pink-650"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    {role.name}
                    <span className={`ml-1.5 font-bold ${isActive ? "text-white/70" : "text-slate-400 dark:text-slate-500"}`}>
                      {role.permissions.length}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Search filter */}
            <div className="relative mb-4 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-350 dark:text-slate-600" />
              <Input
                placeholder="Filter permissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs h-9 pl-8"
              />
            </div>

            {selectedRole &&
              groupedPermissions.map((group) => {
                const matches = group.items.filter((p) => matchesSearch(p, metaFor(p), searchQuery))
                if (matches.length === 0) return null
                const isExpanded = searchQuery.trim() ? true : expandedCategories.has(group.category)
                const enabledCount = matches.filter((p) => hasPermission(selectedRole, p.id)).length

                return (
                  <div key={group.category} className="mb-2 border border-slate-100 dark:border-slate-850 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCategory(group.category)}
                      className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-50/80 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#6B2C91] dark:text-pink-300">
                        {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        {group.category}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        {enabledCount}/{matches.length} enabled
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="divide-y divide-slate-100 dark:divide-slate-850">
                        {matches.map((permission) => {
                          const meta = metaFor(permission)
                          const checked = hasPermission(selectedRole, permission.id)
                          const isPending = pendingPermissionId === permission.id
                          return (
                            <label
                              key={permission.id}
                              className={`flex items-start gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors ${
                                isPending ? "opacity-50 cursor-wait" : ""
                              }`}
                              title={`${meta.description}\n\n${meta.enforced ? "Enforced: " : "Not enforced: "}${meta.enforcedNote}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isPending}
                                onChange={() => handleToggle(selectedRole, permission)}
                                className="mt-0.5 size-4 rounded accent-[#6B2C91] cursor-pointer disabled:cursor-wait"
                              />
                              <span className="flex-1">
                                <span className="block text-xs font-bold text-slate-900 dark:text-white">{meta.label}</span>
                                <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                  {permission.name}
                                </span>
                              </span>
                              {checked && <Check className="size-3.5 text-emerald-500 stroke-[3] shrink-0 mt-0.5" />}
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
          </>
        )}
      </DashboardCard>

      {/* Compare all roles -- collapsed by default. Read-only: this page's
          one editing surface is the role-focused checklist above; this is
          just for eyeballing everything at once. */}
      {!isLoading && adminRoles.length > 0 && (
        <DashboardCard className="p-0 overflow-hidden">
          <button
            onClick={() => setShowComparison((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors"
          >
            <span className="flex items-center gap-1.5 text-xs font-black text-slate-600 dark:text-slate-300">
              {showComparison ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              Compare all roles
            </span>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Read-only overview</span>
          </button>
          {showComparison && (
            <div className="w-full overflow-x-auto border-t border-slate-100 dark:border-slate-850">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                    <th className="p-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">
                      Permission
                    </th>
                    {adminRoles.map((role) => (
                      <th
                        key={role.id}
                        className="p-2.5 text-[10px] font-black text-slate-550 uppercase tracking-widest text-center dark:text-slate-400 w-20"
                      >
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {groupedPermissions.map((group) => (
                    <Fragment key={group.category}>
                      <tr className="bg-slate-50/50 dark:bg-slate-950/30">
                        <td
                          colSpan={1 + adminRoles.length}
                          className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500"
                        >
                          {group.category}
                        </td>
                      </tr>
                      {group.items.map((permission) => (
                        <tr key={permission.id}>
                          <td className="p-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {metaFor(permission).label || permission.name}
                          </td>
                          {adminRoles.map((role) => (
                            <td key={role.id} className="p-2.5 text-center">
                              {hasPermission(role, permission.id) ? (
                                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                              ) : (
                                <span className="inline-block size-1.5 rounded-full bg-slate-200 dark:bg-slate-800" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>
      )}

      {/* Base account roles -- collapsed by default, out of the way of the
          admin-tier editing task this page is actually for. */}
      {!isLoading && baseRoles.length > 0 && (
        <DashboardCard className="p-0 overflow-hidden opacity-90">
          <button
            onClick={() => setShowBaseRoles((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors"
          >
            <span className="flex items-center gap-1.5 text-xs font-black text-slate-500 dark:text-slate-400">
              {showBaseRoles ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              <Users className="size-3.5" />
              Base account roles (read-only)
            </span>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 normal-case">
              Candidate & Recruiter -- not reconfigured from this screen
            </span>
          </button>
          {showBaseRoles && (
            <div className="w-full overflow-x-auto border-t border-slate-100 dark:border-slate-850">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="p-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">
                      Permission
                    </th>
                    {baseRoles.map((role) => (
                      <th
                        key={role.id}
                        className="p-2.5 text-[10px] font-black text-slate-550 uppercase tracking-widest text-center dark:text-slate-400 w-20"
                      >
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {groupedPermissions.map((group) => (
                    <Fragment key={group.category}>
                      <tr>
                        <td
                          colSpan={1 + baseRoles.length}
                          className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500"
                        >
                          {group.category}
                        </td>
                      </tr>
                      {group.items.map((permission) => (
                        <tr key={permission.id}>
                          <td className="p-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {metaFor(permission).label || permission.name}
                          </td>
                          {baseRoles.map((role) => (
                            <td key={role.id} className="p-2.5 text-center">
                              {hasPermission(role, permission.id) ? (
                                <span className="inline-block size-1.5 rounded-full bg-emerald-500/70" />
                              ) : (
                                <span className="inline-block size-1.5 rounded-full bg-slate-200 dark:bg-slate-800" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>
      )}
    </div>
  )
}
export default RolesPermissions
