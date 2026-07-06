export interface UserPayload {
  userId: string
  email: string
  roles: string[]
  permissions: string[]
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload
    }
  }
}
