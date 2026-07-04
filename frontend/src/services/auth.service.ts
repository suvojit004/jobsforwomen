import { UserRole } from "@/constants/roles"
import type { User } from "@/types/user"

export class AuthService {
  private static mockUser: User = {
    id: "user-1",
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    role: UserRole.CANDIDATE,
  }

  static async getCurrentUser(): Promise<User> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.mockUser), 100)
    })
  }

  static async login(email: string, role: UserRole): Promise<User> {
    return new Promise((resolve) => {
      this.mockUser = {
        id: `user-${Date.now()}`,
        name: role === UserRole.RECRUITER ? "Anjali Rao" : "Priya Sharma",
        email,
        role,
      }
      setTimeout(() => resolve(this.mockUser), 150)
    })
  }

  static async logout(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 100)
    })
  }
}
export default AuthService
