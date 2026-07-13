// API Client wrapper mock for JobsForWomen - prepares for Axios and JWT token workflows.
export interface RequestConfig {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  headers?: Record<string, string>
  body?: any
}

// Global interceptors arrays
const requestInterceptors: Array<(config: RequestConfig) => RequestConfig> = []
const responseInterceptors: Array<{
  onSuccess?: (response: any) => any
  onError?: (error: any) => any
}> = []

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.error("❌ CRITICAL: The VITE_API_URL environment variable is missing from the production build configuration. Please specify the Render API endpoint.");
}

// Access tokens are short-lived (15m, see backend JWT_ACCESS_EXPIRY). Without
// this, every request made after the token expires fails with a bare 401 and
// the user has to manually reload the page to get a new one (which works only
// because AuthContext re-runs refreshSession() on mount).
//
// Single-flight refresh: `refreshInFlight` is the one in-progress refresh
// promise, shared by every concurrent caller. Only the *first* 401 actually
// fires a `POST /auth/refresh`; every other request that 401s while that's
// pending awaits the same promise (see `if (refreshInFlight) return
// refreshInFlight` below) instead of firing its own redundant refresh, and
// each caller then retries its own original request exactly once
// (`_isRetry` guards against a second retry, and `/api/v1/auth/refresh`
// itself is in AUTH_ENDPOINTS_NO_RETRY so it can never recursively trigger
// another refresh attempt on its own failure).
let refreshInFlight: Promise<boolean> | null = null

// Guards against dispatching the "session expired" event more than once per
// dead session -- several concurrent requests can all discover the failed
// refresh at roughly the same time (they all resolve from the same shared
// `refreshInFlight` promise), and without this they'd each independently
// clear storage / disconnect the socket / dispatch the event again.
let sessionExpiredDispatched = false

async function tryRefreshToken(baseURL: string): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${baseURL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })
      if (!res.ok) return false
      const data = await res.json()
      const token = data?.data?.accessToken
      if (!token) return false
      localStorage.setItem("jwt_token", token)
      // A new refresh succeeded, so any earlier "session expired" state no
      // longer applies -- allow it to fire again if a *future* refresh fails.
      sessionExpiredDispatched = false

      // Keep the Socket.IO connection authenticated with the freshly issued
      // access token. Without this, the socket keeps using the stale token
      // it connected with and gets disconnected by the server ("jwt
      // expired") independently of the REST session having just recovered.
      // Dynamic import avoids a hard import cycle between this generic API
      // client and the socket client (which itself doesn't depend on this
      // module, but keeps the two decoupled).
      try {
        const { updateSocketToken } = await import("./socket")
        updateSocketToken(token)
      } catch {
        // Socket module not reachable / no socket connected yet -- not fatal
        // to the REST refresh succeeding.
      }

      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

const AUTH_ENDPOINTS_NO_RETRY = [
  "/api/v1/auth/refresh",
  "/api/v1/auth/login",
  "/api/v1/auth/register/candidate",
  "/api/v1/auth/register/recruiter",
  "/api/v1/auth/logout",
]

// Called exactly once per dead session, right after a refresh attempt has
// genuinely failed (not on every bare 401 -- that's the distinction the
// previous version of this file got wrong: its response interceptor
// pattern-matched on `err.message.includes("401")` for *any* request and
// hard-redirected via `window.location.href` from inside a generic API
// client module, with no way for AuthContext to intervene, and no guard
// against firing repeatedly for concurrent in-flight requests.
//
// This module has no router access and shouldn't try to get one -- it just
// clears local auth state and tells the rest of the app the session is
// gone. AuthContext listens for this event and clears its `user` state;
// ProtectedRoute already declaratively redirects to /auth/login whenever
// `isAuthenticated` is false, so navigation stays owned by React Router /
// AuthContext instead of a raw `window.location` assignment that would
// yank the user off *any* page (including public ones) on *any* failing
// request.
function handleSessionExpired() {
  if (sessionExpiredDispatched) return
  sessionExpiredDispatched = true

  localStorage.removeItem("jwt_token")
  localStorage.removeItem("userRole")

  import("./socket")
    .then(({ disconnectSocket }) => disconnectSocket())
    .catch(() => {
      // Socket module unreachable -- nothing to disconnect.
    })

  window.dispatchEvent(new Event("auth:session-expired"))
}

// Configure client instance
export const apiClient = {
  // Pre-configured BASE URL placeholder
  defaults: {
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
    headers: {
      "Content-Type": "application/json",
    },
  },

  // Register request interceptor
  interceptRequest(interceptor: (config: RequestConfig) => RequestConfig) {
    requestInterceptors.push(interceptor)
  },

  // Register response interceptor
  interceptResponse(onSuccess?: (res: any) => any, onError?: (err: any) => any) {
    responseInterceptors.push({ onSuccess, onError })
  },

  // Send request pipeline
  async request<T = any>(endpoint: string, options: RequestConfig = {}, _isRetry = false): Promise<T> {
    let config: RequestConfig = {
      method: options.method || "GET",
      headers: { ...this.defaults.headers, ...options.headers },
      body: options.body,
    }

    // Apply all request interceptors (e.g. inject JWT tokens)
    requestInterceptors.forEach((interceptor) => {
      config = interceptor(config)
    })

    const url = `${this.defaults.baseURL}${endpoint}`

    try {
      if (config.body instanceof FormData && config.headers) {
        delete config.headers["Content-Type"]
      }

      const response = await fetch(url, {
        method: config.method,
        headers: config.headers,
        body: (config.method !== "GET" && config.body)
          ? (config.body instanceof FormData ? config.body : JSON.stringify(config.body))
          : undefined,
        credentials: "include",
      })

      if (response.status === 401 && !_isRetry && !AUTH_ENDPOINTS_NO_RETRY.includes(endpoint)) {
        const refreshed = await tryRefreshToken(this.defaults.baseURL)
        if (refreshed) {
          return this.request<T>(endpoint, options, true)
        }
        // Refresh genuinely failed (not just "not logged in yet" -- this
        // endpoint isn't one of the silent auth-bootstrap calls, since those
        // are excluded by the AUTH_ENDPOINTS_NO_RETRY check above). The
        // session is dead; handle it exactly once here.
        handleSessionExpired()
      }

      if (!response.ok) {
        const httpError: any = new Error(`HTTP error! Status: ${response.status}`)
        httpError.status = response.status
        httpError.endpoint = endpoint
        throw httpError
      }

      const data = await response.json()

      // Apply all success response interceptors
      let processedData = data
      responseInterceptors.forEach((interceptor) => {
        if (interceptor.onSuccess) {
          processedData = interceptor.onSuccess(processedData)
        }
      })

      return processedData as T
    } catch (error: any) {
      // Apply all error response interceptors (e.g. token refresh, unauthorized page redirection)
      let processedError = error
      responseInterceptors.forEach((interceptor) => {
        if (interceptor.onError) {
          processedError = interceptor.onError(processedError)
        }
      })
      throw processedError
    }
  },

  async get<T = any>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", headers })
  },

  async post<T = any>(endpoint: string, body: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: "POST", body, headers })
  },

  async put<T = any>(endpoint: string, body: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: "PUT", body, headers })
  },

  async delete<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE", body, headers })
  },
}

// 1. Inject JWT Request interceptor placeholder
apiClient.interceptRequest((config) => {
  const token = localStorage.getItem("jwt_token")
  if (token && config.headers) {
    config.headers["Authorization"] = `Bearer ${token}`
  }
  return config
})

// 2. Session-expiry handling now happens precisely where the refresh
// actually fails (see `handleSessionExpired()` call inside `request()`
// above), not here. This used to be a generic response interceptor that
// pattern-matched `err.message.includes("401")` for *any* request and
// hard-redirected via `window.location.href = "/auth/login"` directly --
// which fired repeatedly for every concurrent failing request, and bypassed
// AuthContext/React Router entirely (a raw `window.location` assignment
// does a full page reload, and has no way to respect the "user was on a
// public page" exception AuthContext already knows about via
// `isAuthenticated`). Kept as a no-op passthrough so any interceptors
// registered elsewhere in the future still get a place to plug in.
apiClient.interceptResponse((res) => res)

export default apiClient
