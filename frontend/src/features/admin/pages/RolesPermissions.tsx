import { useEffect, useState, useCallback } from "react"
import { Shield, RefreshCw, Check, X, Info, Plus } from "lucide-react"
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

  const renderIndicator = (role: ApiRole, permission: ApiPermission) => {
    const val = hasPermission(role, permission.id)
    const cellKey = `${role.id}:${permission.id}`
    const isPending = pendingCell === cellKey

    return (
      <div
        className={`flex justify-center cursor-pointer p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-max mx-auto ${
          isPending ? "opacity-50 cursor-wait" : ""
        }`}
        onClick={() => !isPending && handleToggle(role, permission)}
        title={`Toggle "${permission.name}" for ${role.name}`}
      >
        {val ? (
          <Check className="size-4 text-emerald-500 stroke-[3]" />
        ) : (
          <X className="size-4 text-slate-300 dark:text-slate-700 stroke-[2]" />
        )}
      </div>
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
            Define system-wide Role-Based Access Control (RBAC) policies. Changes persist immediately per toggle.
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

      {/* Grid Matrix Table */}
      <DashboardCard className="p-4 overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex flex-col justify-center items-center gap-2">
            <span className="size-6 border-2 border-slate-350 border-t-[#6B2C91] rounded-full animate-spin dark:border-slate-800 dark:border-t-pink-300" />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Fetching RBAC policies...
            </p>
          </div>
        ) : permissions.length === 0 || roles.length === 0 ? (
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
                  {roles.map((role) => (
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
                {permissions.map((permission) => (
                  <tr key={permission.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10">
                    <td className="p-3.5 space-y-0.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Info className="size-3.5 text-slate-400 dark:text-slate-500" />
                        {permission.name}
                      </p>
                    </td>
                    {roles.map((role) => (
                      <td key={role.id} className="p-3.5 text-center">
                        {renderIndicator(role, permission)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>
    </div>
  )
}
export default RolesPermissions
