/**
 * Reset the seeded demo organisation.
 *
 * The end-to-end suite writes to the demo project (it approves a protocol and
 * branches a new version), so it has to start from a known state to be
 * repeatable. Only the demo organisation is touched; its projects, protocols
 * and conventions go with it through the cascade, while the demo users survive
 * and are re-linked by the seed.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const removed = await prisma.organization.deleteMany({ where: { slug: 'estudio-demo' } })
  console.log(`demo organisation removed: ${removed.count}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
