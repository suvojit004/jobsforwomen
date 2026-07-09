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
  async request<T = any>(endpoint: string, options: RequestConfig = {}): Promise<T> {
    let config: RequestConfig = {
      method: "GET",
      headers: { ...this.defaults.headers, ...options.headers },
      body: options.body,
    }

    // Apply all request interceptors (e.g. inject JWT tokens)
    requestInterceptors.forEach((interceptor) => {
      config = interceptor(config)
    })

    const url = `${this.defaults.baseURL}${endpoint}`
    
    try {
      const response = await fetch(url, {
        method: config.method,
        headers: config.headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        credentials: "include",
      })

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

  async delete<T = any>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE", headers })
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

// 2. Handle unauthorized response interceptor placeholder
apiClient.interceptResponse(
  (res) => res,
  (err) => {
    if (err.message?.includes("401") || err.message?.includes("403")) {
      console.warn("Authentication failure detected, redirecting...")
      // e.g. window.location.href = "/unauthorized"
    }
    return Promise.reject(err)
  }
)

export default apiClient
