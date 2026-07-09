import { useAuth as useContextAuth } from "@/contexts/AuthContext"

export function useAuth() {
  return useContextAuth()
}

export default useAuth
