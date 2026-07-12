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
// because AuthContext re-runs refreshSession() on mount). This dedupes
// concurrent 401s into a single refresh call and retries the original
// request once it succeeds.
let refreshInFlight: Promise<boolean> | null = null

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
      }

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
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

// 2. Handle unauthorized response interceptor
// By the time an error reaches here, request() has already tried a silent
// token refresh + one retry for 401s (see tryRefreshToken above). If we're
// still seeing a 401, the session is genuinely dead (refresh token expired,
// revoked, or user was blocked/suspended) -- send them to login instead of
// leaving the page silently broken.
apiClient.interceptResponse(
  (res) => res,
  (err) => {
    if (err.message?.includes("401")) {
      console.warn("Authentication failure detected, redirecting to login...")
      localStorage.removeItem("jwt_token")
      localStorage.removeItem("userRole")
      const path = window.location.pathname
      if (!path.startsWith("/auth/")) {
        window.location.href = "/auth/login"
      }
    }
    return Promise.reject(err)
  }
)

export default apiClient
