import { PrismaClient } from "@prisma/client"
import bcrypt from "bcrypt"

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  if (args.length < 3) {
    console.log("Usage: npx ts-node src/database/create-admin.ts <email> <password> <fullName>")
    process.exit(1)
  }

  const [email, password, fullName] = args

  console.log(`Creating Admin: ${email} (${fullName})...`)

  // 1. Get or create Role
  let role = await prisma.role.findUnique({
    where: { name: "Super Admin" }
  })

  if (!role) {
    role = await prisma.role.create({
      data: { name: "Super Admin" }
    })
    console.log("Created Role: Super Admin")
  }

  // 2. Hash password
  const passwordHash = await bcrypt.hash(password, 10)

  // 3. Upsert User
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      status: "Active"
    },
    create: {
      email,
      passwordHash,
      status: "Active",
      roles: {
        create: {
          roleId: role.id
        }
      },
      adminProfile: {
        create: {
          fullName
        }
      }
    }
  })

  console.log("🎉 Success! Admin user has been created/updated with ID:", user.id)
}

main()
  .catch((e) => {
    console.error("❌ Error creating admin:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
