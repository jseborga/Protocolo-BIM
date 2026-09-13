/**
 * Grant or revoke platform-level access from the server.
 *
 * The platform role is separate from organisation and project roles: it gates
 * the back office, not project content. There is deliberately no way to grant
 * it from the web interface, so the first administrator is always made by
 * somebody with access to the server.
 *
 *   npx tsx scripts/set-platform-role.ts ana@estudio.test ADMIN
 */
import { PlatformRole, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [email, role] = process.argv.slice(2)

  if (!email || !role) {
    console.error('Usage: tsx scripts/set-platform-role.ts <email> <USER|SUPPORT|ADMIN>')
    process.exit(1)
  }

  if (!Object.values(PlatformRole).includes(role as PlatformRole)) {
    console.error(`Unknown role "${role}". Expected one of: ${Object.values(PlatformRole).join(', ')}`)
    process.exit(1)
  }

  const user = await prisma.user.update({
    where: { email: email.trim().toLowerCase() },
    data: { platformRole: role as PlatformRole },
    select: { email: true, name: true, platformRole: true },
  })

  console.log(`${user.name} <${user.email}> → ${user.platformRole}`)
}

main()
  .catch((error) => {
    if ((error as { code?: string }).code === 'P2025') {
      console.error('No account with that email.')
      process.exit(1)
    }
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
