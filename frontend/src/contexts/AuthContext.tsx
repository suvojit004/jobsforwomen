import React, { createContext, useContext, useState, useEffect } from "react"
import apiClient from "@/api/client"

export interface User {
  id: string
  email: string
  fullName?: string
  status: string
  roles: string[]
  permissions: string[]
  profileCompletePercent?: number
  candidateProfile?: any
  recruiterProfile?: any
  adminProfile?: any
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  registerCandidate: (data: any) => Promise<any>
  registerRecruiter: (data: any) => Promise<any>
  refreshSession: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshSession = async (): Promise<User | null> => {
    try {
      const refreshRes = await apiClient.post("/api/v1/auth/refresh", {})
      if (refreshRes && refreshRes.success && refreshRes.data?.accessToken) {
        const token = refreshRes.data.accessToken
        localStorage.setItem("jwt_token", token)
        
        const meRes = await apiClient.get("/api/v1/auth/me")
        if (meRes && meRes.success && meRes.data?.user) {
          const fetchedUser = meRes.data.user
          setUser(fetchedUser)
          localStorage.setItem("userRole", fetchedUser.roles[0])
          return fetchedUser
        }
      }
    } catch (err) {
      localStorage.removeItem("jwt_token")
      setUser(null)
    }
    return null
  }

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true)
      await refreshSession()
      setLoading(false)
    }
    initAuth()
  }, [])

  const login = async (email: string, password: string): Promise<User> => {
    const res = await apiClient.post("/api/v1/auth/login", { email, password })
    if (!res || !res.success || !res.data) {
      throw new Error(res?.message || "Invalid login response")
    }
    const { accessToken, user: loggedUser } = res.data
    localStorage.setItem("jwt_token", accessToken)
    localStorage.setItem("userRole", loggedUser.roles[0])
    setUser(loggedUser)
    return loggedUser
  }

  const logout = async () => {
    try {
      await apiClient.post("/api/v1/auth/logout", {})
    } catch (err) {
      // ignore
    } finally {
      localStorage.removeItem("jwt_token")
      localStorage.removeItem("userRole")
      setUser(null)
    }
  }

  const registerCandidate = async (data: any) => {
    return apiClient.post("/api/v1/auth/register/candidate", data)
  }

  const registerRecruiter = async (data: any) => {
    return apiClient.post("/api/v1/auth/register/recruiter", data)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        registerCandidate,
        registerRecruiter,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
