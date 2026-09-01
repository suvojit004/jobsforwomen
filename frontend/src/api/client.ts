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

// Single-flight token refresh: `refreshInFlight` is the one in-progress
// refresh promise, shared by every concurrent caller so only the first 401
// fires a real `POST /auth/refresh`; everyone else awaits the same promise
// and then retries their own request exactly once (`_isRetry` guards
// against a second retry).
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
      // Dynamic import avoids a hard import cycle with the socket client.
      try {
        const { updateSocketToken } = await import("./socket")
        updateSocketToken(token)
      } catch {
        // Socket module not reachable / no socket connected yet -- not fatal
        // to the REST refresh succeeding.
      }

      // This silent, request-triggered refresh only ever updated
      // localStorage's token -- unlike AuthContext's own refreshSession()
      // (which runs on page load), it never told React about the new token,
      // so `AuthContext.user` (roles/permissions, displayed throughout the
      // UI and read by ProtectedRoute's role checks) kept whatever was set
      // at initial login/mount indefinitely, even after this silent refresh
      // picked up a genuinely different roles/permissions snapshot (e.g. an
      // admin changed this account's role while the session was open). No
      // router access from this module, so -- same pattern as
      // handleSessionExpired below -- dispatch an event and let AuthContext
      // own the actual re-fetch/setUser.
      window.dispatchEvent(new Event("auth:session-refreshed"))

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
// genuinely failed. This module has no router access -- it just clears
// local auth state and dispatches an event; AuthContext listens and clears
// its `user` state, and ProtectedRoute redirects declaratively, so
// navigation stays owned by React Router instead of a raw
// `window.location` assignment.
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
        // Parse the real error body (shared/utils/response.ts's sendError())
        // best-effort, since a non-JSON error page is still possible.
        let data: any = null
        try {
          data = await response.json()
        } catch {
          // Not valid JSON -- fall back to the generic status-code message.
        }

        // errorHandler.ts's ZodError branch always sends a generic
        // "Validation failed" top-level message, with the actual field
        // reason only in `errors` (Zod's flattened fieldErrors). Surface the
        // real field message here so every `toast.error(err.message)` call
        // site gets it automatically.
        let message = data?.message || `HTTP error! Status: ${response.status}`
        if (data?.errors && typeof data.errors === "object" && !Array.isArray(data.errors)) {
          const fieldMessages = Object.values(data.errors)
            .flat()
            .filter((m): m is string => typeof m === "string" && m.length > 0)
          if (fieldMessages.length > 0) {
            message = fieldMessages.join(" ")
          }
        }

        const httpError: any = new Error(message)
        httpError.status = response.status
        httpError.endpoint = endpoint
        httpError.errors = data?.errors
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

// Session-expiry handling happens precisely where the refresh actually
// fails (`handleSessionExpired()` inside `request()` above), not here.
// Kept as a no-op passthrough so future interceptors have a place to plug
// in without a raw `window.location` redirect bypassing React Router.
apiClient.interceptResponse((res) => res)

export default apiClient
