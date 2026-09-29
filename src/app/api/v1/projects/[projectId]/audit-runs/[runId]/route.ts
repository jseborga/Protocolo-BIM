import { NextResponse } from 'next/server'
import { dbLocaleToApp } from '@/i18n/locales'
import { appUrl } from '@/lib/app-url'
import { prisma } from '@/lib/prisma'
import { apiError, authenticateApi } from '@/server/revit/apiAuth'
import { createFindingRenderer, pickLocale } from '@/server/revit/messages'
import { loadStandard } from '@/server/revit/standardRepository'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; runId: string }> },
) {
  const { projectId, runId } = await params
  // Either scope: a key that submitted the run can read it back.
  const auth = await authenticateApi(request, ['standard:read', 'audit:write'], projectId)
  if (!auth.ok) return auth.response

  const run = await prisma.auditRun.findFirst({
    where: { id: runId, projectId },
    include: { findings: { orderBy: [{ severity: 'asc' }, { target: 'asc' }, { elementName: 'asc' }] } },
  })
  if (!run) return apiError(404, 'not_found')

  const loaded = await loadStandard(projectId)
  const locale = pickLocale(request, dbLocaleToApp[auth.context.project.baseLocale])
  const render = await createFindingRenderer(locale, loaded?.conventions ?? [])
  const metadata = (run.metadata ?? {}) as Record<string, unknown>

  return NextResponse.json(
    {
      run: {
        id: run.id,
        modelName: run.modelName,
        startedAt: run.startedAt.toISOString(),
        ruleSetVersion: run.ruleSetVersion,
      },
      summary: metadata.summary ?? null,
      findings: run.findings.map((finding) =>
        render({ ...finding, severity: finding.severity, params: finding.params }),
      ),
      truncated: Boolean(metadata.truncated),
      locale,
      webUrl: `${appUrl()}/${locale}/p/${projectId}/quality/${run.id}`,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
