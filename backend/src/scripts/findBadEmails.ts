/**
 * One-off diagnostic: lists every User whose stored email does not look like
 * a valid, single-@ address. Written after a production incident where a
 * malformed stored email caused SES to permanently reject an admin-triggered
 * password reset ("BadRequestException - Missing final '@domain'"), which
 * then silently died in the email dead-letter queue with no feedback to the
 * admin who triggered it. Read-only -- makes no changes.
 *
 * Usage: npx ts-node src/scripts/findBadEmails.ts
 */
import prisma from "../shared/database/db"

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, status: true } })
  const bad = users.filter((u) => !VALID_EMAIL.test(u.email))

  if (bad.length === 0) {
    console.log(`Checked ${users.length} users. No malformed email addresses found.`)
    return
  }

  console.log(`Checked ${users.length} users. Found ${bad.length} with a malformed email address:\n`)
  for (const u of bad) {
    console.log(`  id=${u.id}  status=${u.status}  email="${u.email}"`)
  }
  console.log(`\nFix these via Prisma Studio (npx prisma studio), then filter the User table by id.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
