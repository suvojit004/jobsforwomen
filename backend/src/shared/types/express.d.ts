export interface UserPayload {
  userId: string
  email: string
  roles: string[]
  permissions: string[]
  // See TokenPayload in shared/utils/token.ts -- optional, only present on
  // tokens minted after sessionTimeout.middleware.ts was introduced.
  sessionId?: string
  // See TokenPayload in shared/utils/token.ts -- optional, only present on
  // tokens minted after Force Two-Factor enforcement was introduced.
  twoFactorEnabled?: boolean
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload
    }
  }
}
