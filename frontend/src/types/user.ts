import { UserRole } from "@/constants/roles"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
}
