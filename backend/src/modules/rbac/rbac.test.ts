import request from "supertest"

// Mock Prisma DB Operations inline in factory
jest.mock("../../shared/database/db", () => {
  const localPrismaMock = {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    role: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    permission: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    rolePermission: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    userRole: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    candidateProfile: { findUnique: jest.fn() },
    recruiterProfile: { findUnique: jest.fn() },
    job: { findUnique: jest.fn() },
    application: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (callback) => await callback(localPrismaMock)),
  }
  return {
    ...localPrismaMock,
    prisma: localPrismaMock,
    default: localPrismaMock,
    __esModule: true,
  }
})

// Mock Redis Caching operations inline in factory
jest.mock("../../shared/utils/redis", () => {
  const localRedisMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  }
  return {
    ...localRedisMock,
    redis: localRedisMock,
    default: localRedisMock,
    __esModule: true,
  }
})

import app from "../../app"
import jwt from "jsonwebtoken"
import env from "../../shared/config/env"
import { UserStatus } from "@prisma/client"
import { PermissionCacheManager } from "../../shared/utils/permissionCache"
import prisma from "../../shared/database/db"
import redis from "../../shared/utils/redis"

const mockPrisma = prisma as any
const mockRedis = redis as any

describe("Role-Based Access Control Integration Tests (Phase 4)", () => {
  let adminToken: string
  let candidateToken: string

  beforeEach(() => {
    jest.clearAllMocks()

    adminToken = jwt.sign(
      { userId: "admin-id", email: "admin@jobsforwomen.info", roles: ["Admin", "Super Admin"], permissions: ["manage:roles", "manage:permissions", "manage:users"] },
      env.JWT_ACCESS_SECRET
    )

    candidateToken = jwt.sign(
      { userId: "candidate-id", email: "candidate@email.com", roles: ["Candidate"], permissions: ["read:job"] },
      env.JWT_ACCESS_SECRET
    )

    // Standard Redis mock implementation to avoid DB calls for authorization tokens
    mockRedis.get.mockImplementation(async (key: string) => {
      if (key.includes("admin-id")) {
        return JSON.stringify(["manage:roles", "manage:permissions", "manage:users"])
      }
      if (key.includes("candidate-id")) {
        return JSON.stringify(["read:job"])
      }
      return null
    })

    // This router now runs requireActiveUser on every request (previously
    // it only checked permissions) -- default every user.findUnique lookup
    // to an Active account so that check passes regardless of which id it's
    // queried with, unless a test overrides it below for its own purposes.
    mockPrisma.user.findUnique.mockImplementation(async (args: any) => ({
      id: args.where.id,
      status: UserStatus.Active,
    }))
  })

  describe("RBAC Permissions CRUD APIs", () => {
    it("should allow Admin with manage:roles to retrieve roles", async () => {
      mockPrisma.role.findMany.mockResolvedValue([
        { id: "role-1", name: "Candidate", permissions: [] },
      ])

      const res = await request(app)
        .get("/api/v1/rbac/roles")
        .set("Authorization", `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.roles).toHaveLength(1)
    })

    it("should deny a Candidate (non-admin-tier) from retrieving roles", async () => {
      // GET /roles is deliberately requireRole(ADMIN_TIER_ROLES), not
      // requirePermission -- viewing the matrix has always been open to
      // every admin-tier role (Moderator/Support Executive included, even
      // though they don't hold manage:roles), so the 403 for a Candidate
      // comes from the role-tier check, not a permission check.
      const res = await request(app)
        .get("/api/v1/rbac/roles")
        .set("Authorization", `Bearer ${candidateToken}`)

      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain("Insufficient role credentials")
    })

    it("should invalidate all permission caches upon assigning permissions to role", async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ id: "role-1", name: "Candidate" })
      mockPrisma.rolePermission.findMany.mockResolvedValue([])
      mockPrisma.rolePermission.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.rolePermission.createMany.mockResolvedValue({ count: 1 })
      mockRedis.keys.mockResolvedValue(["user:permissions:user1"])

      const res = await request(app)
        .post("/api/v1/rbac/roles/role-1/permissions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          permissionIds: ["8eb89078-4395-46f9-aa1b-9457d9b9a674"],
        })

      expect(res.status).toBe(200)
      expect(mockRedis.del).toHaveBeenCalledWith("user:permissions:user1")
    })
  })

  describe("Permission caching using Redis", () => {
    it("should read permissions from Redis cache if available", async () => {
      // Override mock implementation for this test case
      mockRedis.get.mockResolvedValue(JSON.stringify(["read:job", "manage:job"]))

      const perms = await PermissionCacheManager.getUserPermissions("user-123")

      expect(perms).toEqual(["read:job", "manage:job"])
      expect(mockRedis.get).toHaveBeenCalledWith("user:permissions:user-123")
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
    })

    it("should query database and set Redis cache on cache miss", async () => {
      // Override mock implementation to return null for user-123 cache miss
      mockRedis.get.mockImplementation(async (key: string) => {
        if (key.includes("user-123")) return null
        return JSON.stringify(["manage:roles"]) // keep admin key working
      })

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        roles: [
          {
            role: {
              permissions: [
                { permission: { name: "read:job" } },
              ],
            },
          },
        ],
      })

      const perms = await PermissionCacheManager.getUserPermissions("user-123")

      expect(perms).toEqual(["read:job"])
      expect(mockRedis.set).toHaveBeenCalledWith("user:permissions:user-123", JSON.stringify(["read:job"]), "EX", 86400)
    })
  })

  describe("Status Access Guards & Ownership", () => {
    it("should invalidate specific user cache when assign roles to user", async () => {
      // Covers both requireActiveUser's lookup on the operator (adminToken)
      // and RbacService.assignRolesToUser's own lookup on the target user --
      // the mock doesn't discriminate by id, so it needs to satisfy both:
      // Active status for the former, a truthy record for the latter.
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", status: UserStatus.Active })
      mockPrisma.userRole.findMany.mockResolvedValue([])
      mockPrisma.userRole.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.userRole.createMany.mockResolvedValue({ count: 1 })

      const res = await request(app)
        .post("/api/v1/rbac/users/user-1/roles")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          roleIds: ["9cb89078-4395-46f9-aa1b-9457d9b9a712"],
        })

      expect(res.status).toBe(200)
      expect(mockRedis.del).toHaveBeenCalledWith("user:permissions:user-1")
    })
  })
})
