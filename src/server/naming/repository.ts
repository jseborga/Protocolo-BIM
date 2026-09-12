import 'server-only'
import { prisma } from '@/lib/prisma'
import { compileConvention } from './compile'
import { toSpec } from './fromRecord'
import type { CompiledConvention } from './types'

const conventionInclude = {
  fields: {
    orderBy: { order: 'asc' },
    include: { codeTable: { include: { values: { orderBy: { order: 'asc' } } } } },
  },
  examples: { orderBy: { sample: 'asc' } },
} as const

export type ConventionRecord = Awaited<
  ReturnType<typeof prisma.namingConvention.findFirstOrThrow<{ include: typeof conventionInclude }>>
>

export interface LoadedConvention {
  record: ConventionRecord
  compiled: CompiledConvention | null
  /** Set when the stored definition cannot be compiled into a rule. */
  compileError: string | null
}

function compileSafely(record: ConventionRecord): LoadedConvention {
  try {
    return { record, compiled: compileConvention(toSpec(record)), compileError: null }
  } catch (error) {
    return { record, compiled: null, compileError: (error as Error).message }
  }
}

export async function loadProjectConventions(projectId: string): Promise<LoadedConvention[]> {
  const records = await prisma.namingConvention.findMany({
    where: { projectId },
    include: conventionInclude,
    orderBy: [{ target: 'asc' }, { key: 'asc' }],
  })
  return records.map(compileSafely)
}

export async function loadConvention(
  projectId: string,
  conventionId: string,
): Promise<LoadedConvention | null> {
  const record = await prisma.namingConvention.findFirst({
    where: { id: conventionId, projectId },
    include: conventionInclude,
  })
  return record ? compileSafely(record) : null
}
