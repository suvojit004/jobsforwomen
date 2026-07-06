import { PrismaClient } from "@prisma/client"
import bcrypt from "bcrypt"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Starting Database Seeding...")

  // 1. Seed Roles
  const roles = [
    { name: "Candidate" },
    { name: "Recruiter" },
    { name: "Moderator" },
    { name: "Admin" },
    { name: "Super Admin" },
    { name: "Support Executive" },
  ]
  console.log("Seeding Roles...")
  const roleInstances: Record<string, any> = {}
  for (const role of roles) {
    const instance = await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: { name: role.name },
    })
    roleInstances[role.name] = instance
  }

  // 2. Seed Permissions
  const permissions = [
    { name: "create:job" },
    { name: "read:job" },
    { name: "update:job" },
    { name: "delete:job" },
    { name: "approve:job" },
    { name: "reject:job" },
    { name: "manage:users" },
    { name: "manage:companies" },
    { name: "manage:reports" },
    { name: "manage:notifications" },
    { name: "manage:features" },
    { name: "manage:roles" },
    { name: "manage:permissions" },
  ]
  console.log("Seeding Permissions...")
  const permissionInstances: Record<string, any> = {}
  for (const perm of permissions) {
    const instance = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: { name: perm.name },
    })
    permissionInstances[perm.name] = instance
  }

  // 3. Map Role Permissions (RBAC Matrix)
  console.log("Seeding Role-Permission Joins...")
  const rbacMappings: Record<string, string[]> = {
    "Candidate": ["read:job"],
    "Recruiter": ["create:job", "read:job", "update:job", "delete:job"],
    "Moderator": ["read:job", "approve:job", "reject:job", "manage:companies"],
    "Admin": [
      "create:job", "read:job", "update:job", "delete:job", "approve:job", "reject:job",
      "manage:users", "manage:companies", "manage:reports", "manage:notifications", "manage:features"
    ],
    "Super Admin": [
      "create:job", "read:job", "update:job", "delete:job", "approve:job", "reject:job",
      "manage:users", "manage:companies", "manage:reports", "manage:notifications", "manage:features",
      "manage:roles", "manage:permissions"
    ],
  }

  for (const [roleName, perms] of Object.entries(rbacMappings)) {
    const roleId = roleInstances[roleName]?.id
    if (!roleId) continue

    for (const permName of perms) {
      const permId = permissionInstances[permName]?.id
      if (!permId) continue

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId: permId },
        },
        update: {},
        create: { roleId, permissionId: permId },
      })
    }
  }

  // 4. Seed Departments
  const departments = [
    "IT & Software",
    "Marketing",
    "Design",
    "HR",
    "Customer Support",
    "Healthcare",
    "Finance",
  ]
  console.log("Seeding Departments...")
  const departmentInstances: Record<string, any> = {}
  for (const dep of departments) {
    const instance = await prisma.department.upsert({
      where: { name: dep },
      update: {},
      create: { name: dep },
    })
    departmentInstances[dep] = instance
  }

  // 5. Seed Industries
  const industries = [
    "Information Technology",
    "Marketing & Advertising",
    "Healthcare",
    "Human Resources",
    "Financial Services",
  ]
  console.log("Seeding Industries...")
  const industryInstances: Record<string, any> = {}
  for (const ind of industries) {
    const instance = await prisma.industry.upsert({
      where: { name: ind },
      update: {},
      create: { name: ind },
    })
    industryInstances[ind] = instance
  }

  // 6. Seed Feature Flags
  const flags = [
    { key: "chat_enabled", value: true, category: "Communication", description: "Enables realtime candidate-recruiter chat messages" },
    { key: "email_automation", value: true, category: "Communication", description: "Automates welcome and status updates mailing queues" },
    { key: "push_notifications", value: false, category: "Notifications", description: "Allows browser push alerts and notifications" },
    { key: "advanced_analytics", value: false, category: "Analytics", description: "Displays dynamic hiring conversion rates donut details" },
    { key: "experimental_sockets", value: true, category: "Experimental", description: "Toggles advanced multi-room typing listeners" },
    { key: "mfa_enforced", value: false, category: "Security", description: "Enforces two-factor registration check processes" },
  ]
  console.log("Seeding Feature Flags...")
  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: {
        key: flag.key,
        value: flag.value,
        category: flag.category,
        description: flag.description,
      },
    })
  }

  // 7. Seed Default Super Admin Account
  console.log("Seeding Super Admin User...")
  const superAdminRole = roleInstances["Super Admin"]
  const adminEmail = "admin@jobsforwomen.info"
  const passwordHash = await bcrypt.hash("admin123", 10)

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      roles: {
        create: {
          roleId: superAdminRole.id,
        },
      },
      adminProfile: {
        create: {
          fullName: "Admin User",
        },
      },
    },
  })

  // 8. Seed Companies & Recruiters (Matching Admin Dashboard Mockups)
  console.log("Seeding Companies & Recruiters...")
  const companiesList = [
    {
      name: "TechNova Solutions",
      website: "https://technova.io",
      location: "Bengaluru, IN",
      industry: "Information Technology",
      status: "pending" as const,
      benefits: ["Menstrual Leave Champion", "Flexible Hours", "Work From Home"],
      recruiter: {
        email: "rohit.mehta@technova.io",
        fullName: "Rohit Mehta",
        phone: "+91 98765 43210",
      },
    },
    {
      name: "Bright Future Tech",
      website: "https://brightfuture.tech",
      location: "Mumbai, IN",
      industry: "Information Technology",
      status: "pending" as const,
      benefits: ["Flexible Returnship", "Flexible Hours"],
      recruiter: {
        email: "sneha.reddy@brightfuture.com",
        fullName: "Sneha Reddy",
        phone: "+91 98765 00123",
      },
    },
    {
      name: "Digital Minds",
      website: "https://digitalminds.com",
      location: "Pune, IN",
      industry: "Information Technology",
      status: "pending" as const,
      benefits: ["Flexible Hours"],
      recruiter: {
        email: "arjun.nair@digitalminds.com",
        fullName: "Arjun Nair",
        phone: "+91 99887 76655",
      },
    },
    {
      name: "CodeCraft Solutions",
      website: "https://codecraft.io",
      location: "Hyderabad, IN",
      industry: "Information Technology",
      status: "approved" as const,
      benefits: ["Menstrual Leave Champion", "Work From Home"],
      recruiter: {
        email: "megha.joshi@codecraft.io",
        fullName: "Megha Joshi",
        phone: "+91 95556 67788",
      },
    },
    {
      name: "InnovateX Pvt. Ltd.",
      website: "https://innovatex.io",
      location: "Delhi NCR, IN",
      industry: "Information Technology",
      status: "approved" as const,
      benefits: ["Flexible Returnship", "Menstrual Leave Champion"],
      recruiter: {
        email: "vikram.singh@innovatex.io",
        fullName: "Vikram Singh",
        phone: "+91 94443 32211",
      },
    },
  ]

  for (const cData of companiesList) {
    const industryId = industryInstances[cData.industry]?.id
    if (!industryId) continue

    const company = await prisma.company.upsert({
      where: { name: cData.name },
      update: {},
      create: {
        name: cData.name,
        website: cData.website,
        location: cData.location,
        status: cData.status,
        industryId,
        benefits: {
          create: cData.benefits.map((b) => ({
            benefitName: b,
            verified: cData.status === "approved",
          })),
        },
      },
    })

    // Seed Recruiter User Linked to Company
    const recruiterRole = roleInstances["Recruiter"]
    const recPasswordHash = await bcrypt.hash("recruiter123", 10)
    
    await prisma.user.upsert({
      where: { email: cData.recruiter.email },
      update: {},
      create: {
        email: cData.recruiter.email,
        passwordHash: recPasswordHash,
        roles: {
          create: {
            roleId: recruiterRole.id,
          },
        },
        recruiterProfile: {
          create: {
            fullName: cData.recruiter.fullName,
            phone: cData.recruiter.phone,
            companyId: company.id,
            verified: cData.status === "approved",
          },
        },
      },
    })
  }

  console.log("🎉 Database Seeding Completed Successfully!")
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
