import { Fragment, useEffect, useState, useCallback } from "react"
import { Shield, RefreshCw, Check, X, Info, Plus, Users } from "lucide-react"
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
// their permission set from this screen. Shown as a read-only reference
// below the editable matrix instead of occupying two of six columns in it.
const BASE_ROLE_NAMES = new Set(["Candidate", "Recruiter"])

// Human-readable label + description for every seeded permission, plus
// whether the backend actually checks it via requirePermission() at request
// time. Most of these are currently DATA ONLY: stored on Role/RolePermission
// and toggleable right here, but the real route-level gates
// (admin.routes.ts) check the caller's role NAME directly
// (requireRole/requireSuperAdmin), never this permission table. Only
// manage:roles and manage:permissions actually gate real endpoints (the RBAC
// CRUD routes under /api/v1/rbac); manage:users gates just the
// role-assignment endpoints there, not general account suspend/delete.
// Disclosing this honestly (rather than implying every toggle changes live
// behavior) matches this app's existing convention for flagging inert
// controls -- see FeatureConfigs.tsx's "Not Implemented" badge.
interface PermissionMeta {
  label: string
  description: string
  enforced: boolean
  enforcedNote: string
  category: "Job Lifecycle" | "People" | "Platform Operations"
}

const PERMISSION_META: Record<string, PermissionMeta> = {
  "create:job": {
    label: "Create Jobs",
    description: "Post new job listings on behalf of a company.",
    enforced: false,
    enforcedNote: "Not checked by any route -- job endpoints are gated by role name (Moderator/Admin/Super Admin), not this permission.",
    category: "Job Lifecycle",
  },
  "read:job": {
    label: "View Jobs",
    description: "View job listings and their details.",
    enforced: false,
    enforcedNote: "Not checked by any route -- job endpoints are gated by role name (Moderator/Admin/Super Admin), not this permission.",
    category: "Job Lifecycle",
  },
  "update:job": {
    label: "Edit Jobs",
    description: "Modify an existing job listing.",
    enforced: false,
    enforcedNote: "Not checked by any route -- job endpoints are gated by role name (Moderator/Admin/Super Admin), not this permission.",
    category: "Job Lifecycle",
  },
  "delete:job": {
    label: "Delete Jobs",
    description: "Permanently remove a job listing.",
    enforced: false,
    enforcedNote: "Not checked by any route -- job endpoints are gated by role name (Moderator/Admin/Super Admin), not this permission.",
    category: "Job Lifecycle",
  },
  "approve:job": {
    label: "Approve Jobs",
    description: "Approve a pending job submission for publishing.",
    enforced: false,
    enforcedNote: "Not checked by any route -- POST /jobs/:id/moderate is gated by role name (Moderator/Admin/Super Admin), not this permission.",
    category: "Job Lifecycle",
  },
  "reject:job": {
    label: "Reject Jobs",
    description: "Reject a pending job submission.",
    enforced: false,
    enforcedNote: "Not checked by any route -- POST /jobs/:id/moderate is gated by role name (Moderator/Admin/Super Admin), not this permission.",
    category: "Job Lifecycle",
  },
  "manage:users": {
    label: "Manage Users",
    description: "Assign roles to a user account and view their effective permissions.",
    enforced: true,
    enforcedNote: "Gates POST /rbac/users/:id/roles and GET .../effective only -- suspending or deleting an account checks role name directly, not this permission.",
    category: "People",
  },
  "manage:companies": {
    label: "Manage Companies",
    description: "Verify, suspend, or moderate recruiter companies.",
    enforced: false,
    enforcedNote: "Not checked by any route -- company moderation endpoints are gated by role name, not this permission.",
    category: "People",
  },
  "manage:reports": {
    label: "Manage Reports",
    description: "View and act on reported jobs and platform analytics.",
    enforced: false,
    enforcedNote: "Not checked by any route yet.",
    category: "Platform Operations",
  },
  "manage:notifications": {
    label: "Manage Notifications",
    description: "Configure platform-wide notification behavior.",
    enforced: false,
    enforcedNote: "Not checked by any route yet.",
    category: "Platform Operations",
  },
  "manage:features": {
    label: "Manage Feature Flags",
    description: "Toggle platform feature flags on or off.",
    enforced: false,
    enforcedNote: "Not checked by any route -- feature-flag endpoints require Super Admin directly, not this permission.",
    category: "Platform Operations",
  },
  "manage:roles": {
    label: "Manage Roles",
    description: "Create, edit, or delete roles and assign permissions to them.",
    enforced: true,
    enforcedNote: "Gates every Role CRUD and permission-assignment endpoint under /api/v1/rbac.",
    category: "Platform Operations",
  },
  "manage:permissions": {
    label: "Manage Permissions",
    description: "Create, edit, or delete permission definitions.",
    enforced: true,
    enforcedNote: "Gates every Permission CRUD endpoint under /api/v1/rbac.",
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

export function RolesPermissions() {
  const [roles, setRoles] = useState<ApiRole[]>([])
  const [permissions, setPermissions] = useState<ApiPermission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingCell, setPendingCell] = useState<string | null>(null)
  const [newRoleName, setNewRoleName] = useState("")
  const [creatingRole, setCreatingRole] = useState(false)

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

  const hasPermission = (role: ApiRole, permissionId: string) =>
    role.permissions.some((rp) => rp.permission.id === permissionId)

  const handleToggle = async (role: ApiRole, permission: ApiPermission) => {
    const cellKey = `${role.id}:${permission.id}`
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
    setPendingCell(cellKey)

    try {
      await AdminApi.updateRolePermissions(role.id, nextNames)
    } catch (err) {
      console.error("Failed to update role permissions:", err)
      setRoles(prevRoles)
      setError(`Failed to update "${permission.name}" for ${role.name}. You may not have Super Admin rights.`)
    } finally {
      setPendingCell(null)
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

  const renderToggle = (role: ApiRole, permission: ApiPermission) => {
    const val = hasPermission(role, permission.id)
    const cellKey = `${role.id}:${permission.id}`
    const isPending = pendingCell === cellKey

    return (
      <div
        className={`flex justify-center cursor-pointer p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-max mx-auto ${
          isPending ? "opacity-50 cursor-wait" : ""
        }`}
        onClick={() => !isPending && handleToggle(role, permission)}
        title={`Toggle "${metaFor(permission).label}" for ${role.name}`}
      >
        {val ? (
          <Check className="size-4 text-emerald-500 stroke-[3]" />
        ) : (
          <X className="size-4 text-slate-300 dark:text-slate-700 stroke-[2]" />
        )}
      </div>
    )
  }

  // Non-interactive twin of renderToggle for the read-only base-role
  // reference table below -- same visual language, but no click handler and
  // no hover affordance, so it doesn't look editable when it isn't.
  const renderStatic = (role: ApiRole, permission: ApiPermission) => {
    const val = hasPermission(role, permission.id)
    return (
      <div className="flex justify-center p-1 w-max mx-auto">
        {val ? (
          <Check className="size-4 text-emerald-500/70 stroke-[3]" />
        ) : (
          <X className="size-4 text-slate-250 dark:text-slate-800 stroke-[2]" />
        )}
      </div>
    )
  }

  const adminRoles = roles.filter((r) => !BASE_ROLE_NAMES.has(r.name))
  const baseRoles = roles.filter((r) => BASE_ROLE_NAMES.has(r.name))

  const groupedPermissions = CATEGORY_ORDER.map((category) => ({
    category,
    items: permissions.filter((p) => metaFor(p).category === category),
  })).filter((g) => g.items.length > 0)

  const permissionRow = (permission: ApiPermission, roleList: ApiRole[], indicator: typeof renderToggle) => {
    const meta = metaFor(permission)
    return (
      <tr key={permission.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10">
        <td className="p-3.5 space-y-0.5">
          <div
            className="flex items-center gap-1.5 w-max cursor-help"
            title={`${meta.description}\n\n${meta.enforced ? "Enforced: " : "Not enforced: "}${meta.enforcedNote}`}
          >
            <Info className="size-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">{meta.label}</span>
            <span
              className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                meta.enforced
                  ? "text-emerald-700 bg-emerald-100/70 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "text-slate-450 bg-slate-100 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {meta.enforced ? "Enforced" : "Not Enforced"}
            </span>
          </div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 pl-5">{permission.name}</p>
        </td>
        {roleList.map((role) => (
          <td key={role.id} className="p-3.5 text-center">
            {indicator(role, permission)}
          </td>
        ))}
      </tr>
    )
  }

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
            Define admin-tier Role-Based Access Control (RBAC) policies. Changes persist immediately per toggle.
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

      {/* Grid Matrix Table -- Admin-tier roles only (Candidate/Recruiter are
          base account types, not access policy -- see the read-only
          reference table further down). */}
      <DashboardCard className="p-4 overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex flex-col justify-center items-center gap-2">
            <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Fetching RBAC policies...
            </p>
          </div>
        ) : permissions.length === 0 || adminRoles.length === 0 ? (
          <p className="py-8 text-center text-xs font-bold text-slate-400">
            No roles or permissions found.
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                  <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">
                    Permission
                  </th>
                  {adminRoles.map((role) => (
                    <th
                      key={role.id}
                      className="p-3 text-xs font-black text-slate-550 uppercase tracking-widest text-center dark:text-slate-400 w-24"
                    >
                      {role.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {groupedPermissions.map((group) => (
                  <Fragment key={group.category}>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/40">
                      <td
                        colSpan={1 + adminRoles.length}
                        className="px-3.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-[#6B2C91] dark:text-pink-300"
                      >
                        {group.category}
                      </td>
                    </tr>
                    {group.items.map((permission) => permissionRow(permission, adminRoles, renderToggle))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      {/* Read-only reference: what Candidate/Recruiter currently have,
          without giving this screen a way to accidentally change base
          account behavior alongside admin-tier policy. */}
      {!isLoading && baseRoles.length > 0 && (
        <DashboardCard className="p-4 overflow-hidden opacity-90">
          <div className="px-2 pt-1 pb-3 flex items-center gap-1.5">
            <Users className="size-3.5 text-slate-400 dark:text-slate-500" />
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Base Account Roles (Read-Only)
            </h3>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 normal-case tracking-normal">
              -- shown for reference, not reconfigured from this screen.
            </span>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">
                    Permission
                  </th>
                  {baseRoles.map((role) => (
                    <th
                      key={role.id}
                      className="p-3 text-xs font-black text-slate-550 uppercase tracking-widest text-center dark:text-slate-400 w-24"
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
                        className="px-3.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500"
                      >
                        {group.category}
                      </td>
                    </tr>
                    {group.items.map((permission) => permissionRow(permission, baseRoles, renderStatic))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      )}
    </div>
  )
}
export default RolesPermissions
