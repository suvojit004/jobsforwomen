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

// CONFIRMED ROOT CAUSE of the Google OAuth "We couldn't complete your Google
// sign-in" flash-error (which then silently works after a manual refresh):
//
// The backend's googleCallback issues a single-use, ROTATING refresh-token
// cookie and does a real server-side 302 redirect to
// `${FRONTEND_URL}/oauth/callback?token=...` -- a genuine full browser page
// load, not client-side SPA navigation. That means the entire React tree,
// including this AuthProvider, mounts fresh. AuthProvider's own mount-time
// effect below (`initAuth`) immediately calls `refreshSession()` to bootstrap
// the session exactly like it does on any normal page load -- but
// `OAuthCallback.tsx` ALSO calls `refreshSession()` itself, in its own effect,
// for the same reason. Both fire nearly simultaneously against
// `POST /api/v1/auth/refresh`, which validates-then-revokes the refresh
// cookie's current value and issues a brand new one (rotation). Whichever of
// the two concurrent requests reaches the backend second is validating an
// already-revoked token and gets a real "Invalid or expired refresh token"
// failure -- and if that's the request OAuthCallback's own call happens to be
// waiting on, its local `error` state renders the failure UI even though the
// OTHER (winning) call may have already set a perfectly valid `user` in this
// very context. A manual refresh only ever fires one clean `initAuth()` call
// with no concurrent competitor, so it always succeeds.
//
// Fix: make `refreshSession` single-flight, the same pattern already used in
// api/client.ts's `tryRefreshToken` for the 401-retry path. Every caller
// within the same tick/in-flight window now awaits the one real network
// call instead of each firing (and racing) their own.
let refreshSessionInFlight: Promise<any> | null = null

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshSession = async (): Promise<User | null> => {
    if (refreshSessionInFlight) return refreshSessionInFlight

    refreshSessionInFlight = (async () => {
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
    })()

    try {
      return await refreshSessionInFlight
    } finally {
      refreshSessionInFlight = null
    }
  }

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true)
      await refreshSession()
      setLoading(false)
    }
    initAuth()
  }, [])

  // apiClient dispatches this exactly once when a refresh genuinely fails
  // (see handleSessionExpired in api/client.ts) -- it has already cleared
  // localStorage and disconnected the socket by the time this fires. Clearing
  // `user` here is what actually ends the session from the app's point of
  // view: ProtectedRoute reads `isAuthenticated` (derived from `user`) and
  // declaratively redirects to /auth/login, so navigation stays owned by
  // React Router instead of apiClient forcing a raw `window.location` change.
  useEffect(() => {
    const handleSessionExpired = () => setUser(null)
    window.addEventListener("auth:session-expired", handleSessionExpired)
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired)
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
      // A real user-initiated logout should tear down the live socket
      // connection immediately rather than waiting for the next failed
      // request to notice the session is gone.
      import("@/api/socket")
        .then(({ disconnectSocket }) => disconnectSocket())
        .catch(() => {})
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
