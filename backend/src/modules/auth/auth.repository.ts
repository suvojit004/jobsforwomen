import prisma from "../../shared/database/db"
import { UserStatus } from "@prisma/client"

export class AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        candidateProfile: true,
        recruiterProfile: {
          include: {
            company: true,
          },
        },
        adminProfile: true,
      },
    })
  }

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        candidateProfile: true,
        recruiterProfile: {
          include: {
            company: true,
          },
        },
        adminProfile: true,
      },
    })
  }

  async createCandidateUser(email: string, passwordHash: string | null, fullName: string, status: UserStatus) {
    const candidateRole = await prisma.role.findUnique({
      where: { name: "Candidate" },
    })

    if (!candidateRole) {
      throw new Error("Candidate role not seeded in database")
    }

    return prisma.user.create({
      data: {
        email,
        passwordHash,
        status,
        roles: {
          create: {
            roleId: candidateRole.id,
          },
        },
        candidateProfile: {
          create: {
            fullName,
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        candidateProfile: true,
      },
    })
  }

  async createRecruiterUser(
    email: string,
    passwordHash: string | null,
    fullName: string,
    phone: string,
    companyName: string,
    website: string,
    location: string,
    industryName: string,
    status: UserStatus
  ) {
    const recruiterRole = await prisma.role.findUnique({
      where: { name: "Recruiter" },
    })

    if (!recruiterRole) {
      throw new Error("Recruiter role not seeded in database")
    }

    const industry = await prisma.industry.upsert({
      where: { name: industryName },
      update: {},
      create: { name: industryName },
    })

    const company = await prisma.company.create({
      data: {
        name: companyName,
        website,
        location,
        status: "pending",
        industryId: industry.id,
      },
    })

    return prisma.user.create({
      data: {
        email,
        passwordHash,
        status,
        roles: {
          create: {
            roleId: recruiterRole.id,
          },
        },
        recruiterProfile: {
          create: {
            fullName,
            phone,
            companyId: company.id,
            verified: false,
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        recruiterProfile: {
          include: {
            company: true,
          },
        },
      },
    })
  }

  async createEmailVerification(email: string, token: string, expiresAt: Date) {
    return prisma.emailVerification.upsert({
      where: { email },
      update: { token, expiresAt, verifiedAt: null },
      create: { email, token, expiresAt },
    })
  }

  async createPasswordReset(email: string, token: string, expiresAt: Date) {
    return prisma.passwordReset.create({
      data: { email, token, expiresAt },
    })
  }

  async findValidPasswordReset(token: string) {
    return prisma.passwordReset.findFirst({
      where: { token, usedAt: null },
    })
  }

  async markPasswordResetUsed(id: string) {
    return prisma.passwordReset.update({
      where: { id },
      data: { usedAt: new Date() },
    })
  }

  async invalidatePendingPasswordResets(email: string) {
    return prisma.passwordReset.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    })
  }

  async updateUserPassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })
  }

  // Every profile/session/token/etc relation on User is declared with
  // onDelete: Cascade in schema.prisma, so deleting the User row removes the
  // account's data in one real, atomic operation -- not a soft "simulated" flag.
  async deleteUserAccount(userId: string) {
    return prisma.user.delete({ where: { id: userId } })
  }

  async findEmailVerification(token: string) {
    return prisma.emailVerification.findUnique({
      where: { token },
    })
  }

  async deleteEmailVerification(id: string) {
    return prisma.emailVerification.delete({
      where: { id },
    })
  }

  async updateUserStatus(userId: string, status: UserStatus) {
    return prisma.user.update({
      where: { id: userId },
      data: { status },
    })
  }

  // 2FA enrollment is two steps: this stores the (encrypted) secret without
  // flipping twoFactorEnabled -- the account isn't protected by it yet, only
  // "pending confirmation" that the user can actually produce valid codes
  // from it. See AuthService.startTwoFactorEnrollment/confirmTwoFactorEnrollment.
  async setPendingTwoFactorSecret(userId: string, encryptedSecret: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: encryptedSecret },
    })
  }

  async enableTwoFactor(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    })
  }

  async disableTwoFactor(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    })
  }

  async createSession(userId: string, ipAddress: string, userAgent: string, deviceType: string | null) {
    return prisma.session.create({
      data: {
        userId,
        ipAddress,
        userAgent,
        deviceType,
      },
    })
  }

  async findSessionsByUserId(userId: string) {
    return prisma.session.findMany({
      where: { userId, revoked: false },
      orderBy: { createdAt: "desc" },
    })
  }

  async deleteSessionById(id: string, userId: string) {
    return prisma.session.updateMany({
      where: { id, userId },
      data: { revoked: true },
    })
  }

  async deleteOtherSessions(activeSessionId: string, userId: string) {
    return prisma.session.updateMany({
      where: {
        userId,
        id: { not: activeSessionId },
      },
      data: { revoked: true },
    })
  }

  async createRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
    userAgent?: string,
    ipAddress?: string,
    sessionId?: string
  ) {
    return prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
        userAgent,
        ipAddress,
        sessionId,
      },
    })
  }

  async findRefreshToken(token: string) {
    return prisma.refreshToken.findUnique({
      where: { token },
    })
  }

  async revokeRefreshToken(token: string) {
    return prisma.refreshToken.update({
      where: { token },
      data: { revoked: true },
    })
  }

  async findOAuthAccount(provider: string, providerUserId: string) {
    return prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: { provider, providerUserId },
      },
      include: {
        user: true,
      },
    })
  }

  async createOAuthAccount(userId: string, provider: string, providerUserId: string) {
    return prisma.oAuthAccount.create({
      data: {
        userId,
        provider,
        providerUserId,
      },
    })
  }

  async findInvitation(token: string) {
    return prisma.invitation.findUnique({
      where: { token },
      include: {
        role: true,
        // Needed so AuthService.getInvitationDetails can greet the invited
        // person with the actual company name ("You've been invited to join
        // Acme Corp") -- team invitations always carry a companyId (see
        // recruiter.service.ts's inviteColleague), but this stayed optional
        // at the schema level since Invitation is reused generically.
        company: true,
      },
    })
  }

  async acceptInvitation(id: string) {
    return prisma.invitation.update({
      where: { id },
      data: { acceptedAt: new Date() },
    })
  }

  async createInvitedUser(email: string, passwordHash: string | null, fullName: string, roleId: string, companyId?: string | null) {
    const role = await prisma.role.findUnique({ where: { id: roleId } })
    const isRecruiter = role?.name === "Recruiter"

    const data: any = {
      email,
      passwordHash,
      status: "Active",
      roles: {
        create: {
          roleId,
        },
      },
    }

    if (isRecruiter && companyId) {
      data.recruiterProfile = {
        create: {
          fullName,
          companyId,
          verified: true,
        }
      }
    } else {
      data.adminProfile = {
        create: {
          fullName,
        }
      }
    }

    return prisma.user.create({
      data,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        adminProfile: true,
        recruiterProfile: true,
      },
    })
  }
}

export default AuthRepository
