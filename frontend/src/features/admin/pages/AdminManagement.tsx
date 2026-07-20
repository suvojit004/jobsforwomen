import { useEffect, useState, useCallback, useMemo } from "react"
import {
  ShieldCheck,
  RefreshCw,
  Plus,
  Search,
  Trash2,
  UserCog,
  Ban,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react"
import { DashboardCard } from "@/components/shared/DashboardCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AdminApi } from "../services/adminApi"
import { useAuth } from "@/hooks/useAuth"

interface AdminRow {
  id: string
  email: string
  fullName: string
  roles: string[]
  status: string
  lastLoginAt: string | null
  createdBy: string
  createdAt: string
}

interface ApiRole {
  id: string
  name: string
}

const ADMIN_TIER_ROLES = ["Admin", "Super Admin", "Moderator", "Support Executive"]

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "Active"
  const cls = isActive
    ? "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-350"
    : status === "Suspended" || status === "Blocked"
    ? "bg-rose-100/70 text-rose-700 dark:bg-rose-950/30 dark:text-rose-350"
    : "bg-teal-100/70 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300"
  return (
    <span className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${cls}`}>
      {status}
    </span>
  )
}

function RoleBadges({ roles }: { roles: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <span
          key={r}
          className={`inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-full ${
            r === "Super Admin"
              ? "bg-[#6B2C91]/10 text-[#6B2C91] dark:bg-pink-950/30 dark:text-pink-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  )
}

export function AdminManagement() {
  const { user } = useAuth()
  const isSuperAdmin = (user?.roles || []).includes("Super Admin")

  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [roles, setRoles] = useState<ApiRole[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ email: "", fullName: "", password: "", roleNames: [] as string[] })
  const [createError, setCreateError] = useState<string | null>(null)

  const [rolesModalAdmin, setRolesModalAdmin] = useState<AdminRow | null>(null)
  const [rolesDraft, setRolesDraft] = useState<string[]>([])
  const [rolesSaving, setRolesSaving] = useState(false)
  const [rolesError, setRolesError] = useState<string | null>(null)

  const [actionPendingId, setActionPendingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [adminsData, rbacData] = await Promise.all([
        AdminApi.getAdmins({
          search: search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          role: roleFilter !== "all" ? roleFilter : undefined,
        }),
        AdminApi.getRBAC(),
      ])
      setAdmins(adminsData || [])
      setRoles((rbacData.roles || []).filter((r: ApiRole) => ADMIN_TIER_ROLES.includes(r.name)))
    } catch (err) {
      console.error("Failed to load admin accounts:", err)
      setError("Failed to load admin accounts from the server.")
    } finally {
      setIsLoading(false)
    }
  }, [search, statusFilter, roleFilter])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    load()
  }

  const roleIdByName = useMemo(() => {
    const map: Record<string, string> = {}
    roles.forEach((r) => { map[r.name] = r.id })
    return map
  }, [roles])

  const handleCreateAdmin = async () => {
    if (!createForm.email.trim() || !createForm.fullName.trim() || createForm.password.length < 8 || createForm.roleNames.length === 0) {
      setCreateError("Fill in every field. Password must be at least 8 characters and at least one role must be selected.")
      return
    }
    try {
      setCreating(true)
      setCreateError(null)
      await AdminApi.createAdmin(createForm)
      setShowCreateModal(false)
      setCreateForm({ email: "", fullName: "", password: "", roleNames: [] })
      await load()
    } catch (err: any) {
      console.error("Failed to create admin:", err)
      setCreateError(err?.message || "Failed to create admin account. You may not have Super Admin rights.")
    } finally {
      setCreating(false)
    }
  }

  const openRolesModal = (admin: AdminRow) => {
    setRolesModalAdmin(admin)
    setRolesDraft(admin.roles)
    setRolesError(null)
  }

  const handleSaveRoles = async () => {
    if (!rolesModalAdmin) return
    if (rolesDraft.length === 0) {
      setRolesError("An admin must have at least one role.")
      return
    }
    try {
      setRolesSaving(true)
      setRolesError(null)
      const roleIds = rolesDraft.map((name) => roleIdByName[name]).filter(Boolean)
      await AdminApi.assignAdminRoles(rolesModalAdmin.id, roleIds)
      setRolesModalAdmin(null)
      await load()
    } catch (err: any) {
      console.error("Failed to update roles:", err)
      setRolesError(err?.message || "Failed to update roles. This may be blocked by a Super Admin safety rule.")
    } finally {
      setRolesSaving(false)
    }
  }

  const handleToggleStatus = async (admin: AdminRow) => {
    const nextStatus = admin.status === "Active" ? "Suspended" : "Active"
    try {
      setActionPendingId(admin.id)
      setError(null)
      await AdminApi.updateUserStatus(admin.id, nextStatus)
      await load()
    } catch (err: any) {
      console.error("Failed to update status:", err)
      setError(err?.message || `Failed to update status for ${admin.email}.`)
    } finally {
      setActionPendingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setError(null)
      await AdminApi.deleteUser(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (err: any) {
      console.error("Failed to delete admin:", err)
      setError(err?.message || `Failed to delete ${deleteTarget.email}.`)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="animate-fadeIn">
        <DashboardCard className="p-8 flex flex-col items-center text-center gap-2">
          <ShieldCheck className="size-8 text-slate-300" />
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-200">Super Admin Access Required</h2>
          <p className="text-xs font-semibold text-slate-500 max-w-md">
            Admin Management is restricted to Super Admin accounts. Contact a Super Admin if you need an
            administrator account created or its roles changed.
          </p>
        </DashboardCard>
      </div>
    )
  }

  return (
    <div className="space-y-6 select-none animate-fadeIn">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white flex items-center gap-2">
            <ShieldCheck className="size-6 text-[#6B2C91] dark:text-pink-300" />
            Admin Management
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Create, list, and manage administrator accounts and their roles. Super Admin only.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            disabled={isLoading}
            className="h-9 text-xs font-bold border-slate-200 hover:bg-slate-100"
          >
            <RefreshCw className={`size-3 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="h-9 text-xs font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white dark:bg-pink-650 dark:hover:bg-pink-700 flex items-center gap-1.5"
          >
            <Plus className="size-3.5" />
            Create Admin
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-pink-200 bg-pink-50 px-4 py-2.5 text-xs font-bold text-pink-700 dark:border-pink-900 dark:bg-pink-950/30 dark:text-pink-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="size-3.5" /></button>
        </div>
      )}

      <DashboardCard className="p-4 flex flex-col sm:flex-row gap-2 sm:items-center">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs h-9 pl-8"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="h-9 text-xs font-bold border-slate-200">
            Search
          </Button>
        </form>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); }}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
          <option value="Blocked">Blocked</option>
          <option value="PendingApproval">Pending Approval</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); }}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <option value="all">All Roles</option>
          {ADMIN_TIER_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <Button size="sm" onClick={load} className="h-9 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700">
          Apply Filters
        </Button>
      </DashboardCard>

      <DashboardCard className="p-4 overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex flex-col justify-center items-center gap-2">
            <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Fetching admin accounts...
            </p>
          </div>
        ) : admins.length === 0 ? (
          <p className="py-8 text-center text-xs font-bold text-slate-400">No admin accounts found.</p>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                  <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Name / Email</th>
                  <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Roles</th>
                  <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Status</th>
                  <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Last Login</th>
                  <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Created By</th>
                  <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Created At</th>
                  <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest dark:text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10">
                    <td className="p-3.5">
                      <p className="text-xs font-black text-slate-900 dark:text-white">{admin.fullName || "—"}</p>
                      <p className="text-[10px] font-semibold text-slate-500">{admin.email}</p>
                    </td>
                    <td className="p-3.5"><RoleBadges roles={admin.roles} /></td>
                    <td className="p-3.5"><StatusBadge status={admin.status} /></td>
                    <td className="p-3.5 text-[10px] font-semibold text-slate-500">
                      {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : "Never"}
                    </td>
                    <td className="p-3.5 text-[10px] font-semibold text-slate-500">{admin.createdBy}</td>
                    <td className="p-3.5 text-[10px] font-semibold text-slate-500">
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3.5">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRolesModal(admin)}
                          className="h-7 px-2 text-[10px] font-bold border-slate-200"
                          title="Manage roles"
                        >
                          <UserCog className="size-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(admin)}
                          disabled={actionPendingId === admin.id}
                          className="h-7 px-2 text-[10px] font-bold border-slate-200"
                          title={admin.status === "Active" ? "Suspend" : "Activate"}
                        >
                          {actionPendingId === admin.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : admin.status === "Active" ? (
                            <Ban className="size-3 text-rose-500" />
                          ) : (
                            <CheckCircle2 className="size-3 text-emerald-500" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteTarget(admin)}
                          className="h-7 px-2 text-[10px] font-bold border-slate-200 hover:bg-rose-50"
                          title="Delete account"
                        >
                          <Trash2 className="size-3 text-rose-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Create Admin Account</h3>
              <button onClick={() => setShowCreateModal(false)}><X className="size-4 text-slate-400" /></button>
            </div>
            {createError && (
              <div className="rounded-lg border border-pink-200 bg-pink-50 px-3 py-2 text-[11px] font-bold text-pink-700 dark:border-pink-900 dark:bg-pink-950/30 dark:text-pink-300">
                {createError}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Name <span className="text-red-500">*</span></label>
                <Input
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="text-xs h-9 mt-1"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email <span className="text-red-500">*</span></label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className="text-xs h-9 mt-1"
                  placeholder="jane@jobsforwomen.info"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Initial Password <span className="text-red-500">*</span></label>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  className="text-xs h-9 mt-1"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Roles <span className="text-red-500">*</span></label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {ADMIN_TIER_ROLES.map((r) => {
                    const checked = createForm.roleNames.includes(r)
                    return (
                      <button
                        type="button"
                        key={r}
                        onClick={() =>
                          setCreateForm((f) => ({
                            ...f,
                            roleNames: checked ? f.roleNames.filter((x) => x !== r) : [...f.roleNames, r],
                          }))
                        }
                        className={`text-[10px] font-black px-2.5 py-1 rounded-full border transition-colors ${
                          checked
                            ? "bg-[#6B2C91] text-white border-[#6B2C91]"
                            : "bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        }`}
                      >
                        {r}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setShowCreateModal(false)} className="h-9 text-xs font-bold">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateAdmin}
                disabled={creating}
                className="h-9 text-xs font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white"
              >
                {creating ? "Creating..." : "Create Admin"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Roles Modal */}
      {rolesModalAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Manage Roles — {rolesModalAdmin.fullName || rolesModalAdmin.email}
              </h3>
              <button onClick={() => setRolesModalAdmin(null)}><X className="size-4 text-slate-400" /></button>
            </div>
            {rolesError && (
              <div className="rounded-lg border border-pink-200 bg-pink-50 px-3 py-2 text-[11px] font-bold text-pink-700 dark:border-pink-900 dark:bg-pink-950/30 dark:text-pink-300">
                {rolesError}
              </div>
            )}
            <p className="text-[11px] font-semibold text-slate-500">
              Select every role this account should hold. Removing the Super Admin role from the platform's last
              Super Admin, or removing your own last remaining role, will be rejected by the server.
            </p>
            <div className="flex flex-wrap gap-2">
              {ADMIN_TIER_ROLES.map((r) => {
                const checked = rolesDraft.includes(r)
                return (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRolesDraft((prev) => (checked ? prev.filter((x) => x !== r) : [...prev, r]))}
                    className={`text-[10px] font-black px-2.5 py-1 rounded-full border transition-colors ${
                      checked
                        ? "bg-[#6B2C91] text-white border-[#6B2C91]"
                        : "bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    }`}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setRolesModalAdmin(null)} className="h-9 text-xs font-bold">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRoles}
                disabled={rolesSaving}
                className="h-9 text-xs font-black bg-[#6B2C91] hover:bg-[#5a237b] text-white"
              >
                {rolesSaving ? "Saving..." : "Save Roles"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Delete Admin Account?</h3>
            <p className="text-xs font-semibold text-slate-500">
              This permanently deletes <span className="font-black text-slate-800 dark:text-slate-200">{deleteTarget.email}</span>{" "}
              and cannot be undone. Super Admin accounts can never be deleted from this screen.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setDeleteTarget(null)} className="h-9 text-xs font-bold">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="h-9 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white"
              >
                {deleting ? "Deleting..." : "Delete Permanently"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminManagement
