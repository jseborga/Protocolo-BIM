import { dbLocaleToApp } from '@/i18n/locales'
import { appUrl } from '@/lib/app-url'
import { prisma } from '@/lib/prisma'
import { apiError, apiJson, authenticateApi } from '@/server/revit/apiAuth'
import { auditSubmissionSchema } from '@/server/revit/apiSchemas'
import { evaluateAudit } from '@/server/revit/audit'
import { MAX_STORED_FINDINGS, recordAudit } from '@/server/revit/auditRepository'
import { readJsonBody } from '@/server/revit/body'
import { createFindingRenderer, pickLocale } from '@/server/revit/messages'
import { loadStandard } from '@/server/revit/standardRepository'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** The response carries this many findings; the rest are on the web page. */
const MAX_RETURNED_FINDINGS = 5_000

const DEFAULT_PAGE = 20
const MAX_PAGE = 100

/**
 * The project's audits, newest first, a page at a time.
 *
 * Readable with either scope: a key that submits audits can follow up on
 * them, and a read-only key (a dashboard) can chart them.
 */
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const auth = await authenticateApi(request, ['standard:read', 'audit:write'], projectId)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const requested = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_PAGE) : DEFAULT_PAGE
  const cursor = url.searchParams.get('cursor')

  if (cursor) {
    // A cursor from another project (or none at all) is a client error, not
    // a silently empty page.
    const known = await prisma.auditRun.findFirst({ where: { id: cursor, projectId }, select: { id: true } })
    if (!known) return apiError(422, 'invalid_request', 'cursor: unknown')
  }

  const runs = await prisma.auditRun.findMany({
    where: { projectId },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      modelName: true,
      startedAt: true,
      ruleSetVersion: true,
      totalChecked: true,
      errorCount: true,
      warningCount: true,
      infoCount: true,
    },
  })

  const page = runs.slice(0, limit)
  const locale = pickLocale(request, dbLocaleToApp[auth.context.project.baseLocale])

  return apiJson(
    {
      runs: page.map((run) => ({
        id: run.id,
        modelName: run.modelName,
        startedAt: run.startedAt.toISOString(),
        ruleSetVersion: run.ruleSetVersion,
        checked: run.totalChecked,
        errors: run.errorCount,
        warnings: run.warningCount,
        infos: run.infoCount,
        webUrl: `${appUrl()}/${locale}/p/${projectId}/quality/${run.id}`,
      })),
      nextCursor: runs.length > limit ? page[page.length - 1]!.id : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/**
 * Record an audit of a model.
 *
 * The add-in reports facts; the judgement happens here, with the same engine
 * the web validator uses, against the rules current at the moment of the
 * request — so a stale sync cannot make a wrong name look right.
 */
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const auth = await authenticateApi(request, 'audit:write', projectId)
  if (!auth.ok) return auth.response

  const body = await readJsonBody(request)
  if (!body.ok) return apiError(body.status, body.error)

  const parsed = auditSubmissionSchema.safeParse(body.value)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return apiError(422, 'invalid_request', issue ? `${issue.path.join('.')}: ${issue.message}` : undefined)
  }

  const loaded = await loadStandard(projectId)
  if (!loaded) return apiError(404, 'not_found')

  const submission = parsed.data
  const evaluation = evaluateAudit(
    loaded.auditStandard,
    {
      model: { title: submission.model.title, isWorkshared: submission.model.isWorkshared },
      names: submission.names,
      sharedParameters: submission.sharedParameters,
      worksets: submission.worksets,
      projectInformation: submission.projectInformation,
    },
    // Only this many can be stored, so there is no point holding more.
    { maxNamingFindings: MAX_STORED_FINDINGS },
  )

  const currentVersion = loaded.document.ruleSet.version
  const { run, truncated } = await recordAudit({
    projectId,
    apiTokenId: auth.context.tokenId,
    createdById: auth.context.createdById,
    modelName: submission.model.title,
    ruleSetVersion: currentVersion,
    evaluation,
    metadata: {
      revitVersion: submission.model.revitVersion ?? null,
      revitBuild: submission.model.revitBuild ?? null,
      isWorkshared: submission.model.isWorkshared ?? null,
      clientRuleSetVersion: submission.ruleSetVersion ?? null,
      tokenName: auth.context.tokenName,
    },
  })

  const baseLocale = dbLocaleToApp[auth.context.project.baseLocale]
  const locale = pickLocale(request, baseLocale)
  const render = await createFindingRenderer(locale, loaded.conventions)
  const returned = evaluation.findings.slice(0, MAX_RETURNED_FINDINGS)

  return apiJson(
    {
      run: {
        id: run.id,
        modelName: run.modelName,
        startedAt: run.startedAt.toISOString(),
        ruleSetVersion: currentVersion,
        rulesChangedSinceSync:
          submission.ruleSetVersion !== undefined && submission.ruleSetVersion !== currentVersion,
      },
      summary: evaluation.summary,
      findings: returned.map(render),
      findingsTotal: evaluation.findingsTotal,
      findingsReturned: returned.length,
      findingsStored: Math.min(evaluation.findings.length, MAX_STORED_FINDINGS),
      truncated: truncated || returned.length < evaluation.findingsTotal,
      locale,
      webUrl: `${appUrl()}/${locale}/p/${projectId}/quality/${run.id}`,
    },
    { status: 201, headers: { 'Cache-Control': 'no-store', Location: `/api/v1/projects/${projectId}/audit-runs/${run.id}` } },
  )
}
