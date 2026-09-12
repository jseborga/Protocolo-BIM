/**
 * Check every stored naming convention against its own test cases.
 *
 * The application already refuses to activate a convention that disagrees with
 * its examples; this runs the same check across the whole database, which makes
 * it useful in CI after a migration or a bulk import.
 *
 *   npm run verify:naming
 */
import { PrismaClient } from '@prisma/client'
import { checkExamples, compileConvention, toSpec } from '../src/server/naming'

const prisma = new PrismaClient()

async function main() {
  const conventions = await prisma.namingConvention.findMany({
    include: {
      project: { select: { code: true } },
      fields: {
        orderBy: { order: 'asc' },
        include: { codeTable: { include: { values: { orderBy: { order: 'asc' } } } } },
      },
      examples: true,
    },
    orderBy: [{ projectId: 'asc' }, { key: 'asc' }],
  })

  let failures = 0

  for (const record of conventions) {
    let compiled
    try {
      compiled = compileConvention(toSpec(record))
    } catch (error) {
      failures += 1
      console.error(`FAIL ${record.project.code}/${record.key}: ${(error as Error).message}`)
      continue
    }

    const { passed, checks } = checkExamples(compiled, record.examples)
    const label = `${record.project.code}/${record.key}`.padEnd(22)
    console.log(`${passed ? 'ok  ' : 'FAIL'} ${label} ${compiled.mask}`)

    for (const check of checks.filter((entry) => !entry.passed)) {
      failures += 1
      console.error(
        `       ${check.sample} — expected ${check.shouldBeValid ? 'valid' : 'invalid'}, got ${
          check.actuallyValid ? 'valid' : 'invalid'
        }`,
      )
    }
  }

  console.log(`\n${conventions.length} conventions checked, ${failures} failure(s)`)
  if (failures > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
