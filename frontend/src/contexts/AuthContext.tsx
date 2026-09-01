import React, { createContext, useContext, useState, useEffect } from "react"
import apiClient from "@/api/client"

export interface User {
  id: string
  email: string
  fullName?: string
  avatarUrl?: string
  status: string
  roles: string[]
  permissions: string[]
  profileCompletePercent?: number
  // Real now -- see AuthService.createAuthSession/getMe. Drives the
  // Administrative Settings 2FA enrollment UI and the Login.tsx code step.
  twoFactorEnabled?: boolean
  candidateProfile?: any
  recruiterProfile?: any
  adminProfile?: any
}

// Returned by login() when the password check passes but the account has
// 2FA enrolled -- no tokens issued yet. Login.tsx switches to a code-entry
// step and calls verifyTwoFactor() with the pendingToken to finish.
export interface TwoFactorChallenge {
  requiresTwoFactor: true
  pendingToken: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<User | TwoFactorChallenge>
  verifyTwoFactor: (pendingToken: string, code: string) => Promise<User>
  logout: () => Promise<void>
  registerCandidate: (data: any) => Promise<any>
  registerRecruiter: (data: any) => Promise<any>
  refreshSession: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Google OAuth's redirect is a real full page load, so AuthProvider's mount
// effect and OAuthCallback.tsx both call `refreshSession()` nearly
// simultaneously. The refresh-token cookie rotates on use, so whichever
// request reaches the backend second is validating an already-revoked token
// and fails -- even though the other (winning) request already set a valid
// user. Made single-flight (same pattern as api/client.ts's
// `tryRefreshToken`) so concurrent callers share one real network call.
let refreshSessionInFlight: Promise<any> | null = null

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Shared by refreshSession() below (page-load bootstrap) and the
  // "auth:session-refreshed" listener further down (api/client.ts's silent,
  // request-triggered token refresh) -- both need the exact same
  // fetch-/auth/me-and-update-state behavior, so it's factored out once
  // instead of duplicated. Deliberately best-effort/non-throwing: a failure
  // here just leaves the existing `user` state as-is rather than logging the
  // user out -- the request that actually needed the token will surface its
  // own error if the session is genuinely broken, this is just a sync.
  const syncUserFromServer = async (): Promise<User | null> => {
    try {
      const meRes = await apiClient.get("/api/v1/auth/me")
      if (meRes && meRes.success && meRes.data?.user) {
        const fetchedUser = meRes.data.user
        setUser(fetchedUser)
        localStorage.setItem("userRole", fetchedUser.roles[0])
        return fetchedUser
      }
    } catch (err) {
      // Best-effort -- see comment above.
    }
    return null
  }

  const refreshSession = async (): Promise<User | null> => {
    if (refreshSessionInFlight) return refreshSessionInFlight

    refreshSessionInFlight = (async () => {
      try {
        const refreshRes = await apiClient.post("/api/v1/auth/refresh", {})
        if (refreshRes && refreshRes.success && refreshRes.data?.accessToken) {
          const token = refreshRes.data.accessToken
          localStorage.setItem("jwt_token", token)
          return await syncUserFromServer()
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

  // apiClient dispatches this after its own silent, request-triggered token
  // refresh succeeds (see tryRefreshToken in api/client.ts) -- that refresh
  // only ever updated localStorage's token with no way to tell React about
  // it, so `user` here (and everything reading it -- role-based nav,
  // ProtectedRoute's allowedRoles check, permission-gated UI) could keep
  // showing a stale roles/permissions snapshot from initial login for the
  // entire lifetime of a long session, even after a token minted with a
  // genuinely different snapshot (e.g. an admin changed this account's
  // role/permissions mid-session) silently replaced it. Re-fetching here
  // keeps `user` truthful without forcing a full page reload.
  useEffect(() => {
    const handleSessionRefreshed = () => {
      syncUserFromServer()
    }
    window.addEventListener("auth:session-refreshed", handleSessionRefreshed)
    return () => window.removeEventListener("auth:session-refreshed", handleSessionRefreshed)
  }, [])

  const login = async (email: string, password: string): Promise<User | TwoFactorChallenge> => {
    const res = await apiClient.post("/api/v1/auth/login", { email, password })
    if (!res || !res.success || !res.data) {
      throw new Error(res?.message || "Invalid login response")
    }
    if (res.data.requiresTwoFactor) {
      return { requiresTwoFactor: true, pendingToken: res.data.pendingToken }
    }
    const { accessToken, user: loggedUser } = res.data
    localStorage.setItem("jwt_token", accessToken)
    localStorage.setItem("userRole", loggedUser.roles[0])
    setUser(loggedUser)
    return loggedUser
  }

  const verifyTwoFactor = async (pendingToken: string, code: string): Promise<User> => {
    const res = await apiClient.post("/api/v1/auth/2fa/verify", { pendingToken, code })
    if (!res || !res.success || !res.data) {
      throw new Error(res?.message || "Invalid two-factor response")
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
        verifyTwoFactor,
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
