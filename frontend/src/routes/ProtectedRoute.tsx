import React from "react"
import { Navigate } from "react-router-dom"
import { UserRole } from "@/constants/roles"

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const currentRole = (localStorage.getItem("userRole") as UserRole) || UserRole.CANDIDATE

  if (!allowedRoles.includes(currentRole)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
export default ProtectedRoute
