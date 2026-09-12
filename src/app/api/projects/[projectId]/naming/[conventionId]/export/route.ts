import { NextResponse } from 'next/server'
import { resolveProjectAccess } from '@/server/authz'
import { checkExamples } from '@/server/naming'
import { loadConvention } from '@/server/naming/repository'

export const dynamic = 'force-dynamic'

/**
 * Machine-readable form of a naming convention.
 *
 * This is the shape the Revit add-in and the IFC auditor will consume in phase
 * 2, so it carries the compiled pattern and the allowed codes, not just the
 * definition the UI shows.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; conventionId: string }> },
) {
  const { projectId, conventionId } = await params
  const access = await resolveProjectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const loaded = await loadConvention(projectId, conventionId)
  if (!loaded) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { record, compiled, compileError } = loaded
  const examples = compiled ? checkExamples(compiled, record.examples) : null

  const payload = {
    project: { id: access.project.id, code: access.project.code, name: access.project.name },
    convention: {
      key: record.key,
      target: record.target,
      separator: record.separator,
      caseRule: record.caseRule,
      maxLength: record.maxLength,
      isActive: record.isActive,
      version: record.version,
      labels: record.labels,
      description: record.description,
    },
    compiled: compiled
      ? { mask: compiled.mask, pattern: compiled.regexSource, fields: compiled.fields }
      : null,
    compileError,
    examples: record.examples.map((example) => ({
      sample: example.sample,
      shouldBeValid: example.shouldBeValid,
      agrees: examples?.checks.find((check) => check.sample === example.sample)?.passed ?? null,
    })),
    generatedAt: new Date().toISOString(),
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${access.project.code}-naming-${record.key}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
