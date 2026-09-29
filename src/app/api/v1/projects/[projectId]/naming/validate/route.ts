import { NextResponse } from 'next/server'
import { dbLocaleToApp } from '@/i18n/locales'
import { apiError, authenticateApi } from '@/server/revit/apiAuth'
import { namingValidateRequestSchema } from '@/server/revit/apiSchemas'
import { judgeName } from '@/server/revit/audit'
import { readJsonBody } from '@/server/revit/body'
import { createFindingRenderer, pickLocale } from '@/server/revit/messages'
import { loadStandard } from '@/server/revit/standardRepository'

export const dynamic = 'force-dynamic'

/**
 * Check names against the active conventions, without recording anything.
 * Used by a client (the Revit add-in, a script) to check a name before
 * renaming an element to it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const auth = await authenticateApi(request, 'standard:read', projectId)
  if (!auth.ok) return auth.response

  const body = await readJsonBody(request)
  if (!body.ok) return apiError(body.status, body.error)

  const parsed = namingValidateRequestSchema.safeParse(body.value)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return apiError(422, 'invalid_request', issue ? `${issue.path.join('.')}: ${issue.message}` : undefined)
  }

  const loaded = await loadStandard(projectId)
  if (!loaded) return apiError(404, 'not_found')

  const locale = pickLocale(request, dbLocaleToApp[auth.context.project.baseLocale])
  const render = await createFindingRenderer(locale, loaded.conventions)

  const results = parsed.data.items.map((item) => {
    const conventions = loaded.conventions.filter((convention) => convention.target === item.target)
    if (conventions.length === 0) {
      return { ...item, checked: false, valid: null, conventionKey: null, errors: [], messages: [] }
    }

    const verdict = judgeName(conventions, item.name)
    if (verdict.valid) {
      return { ...item, checked: true, valid: true, conventionKey: null, errors: [], messages: [] }
    }

    const rendered = render({
      severity: 'ERROR',
      target: item.target,
      code: 'NAMING',
      ruleKey: `naming.${verdict.convention.key}`,
      params: {
        conventionKey: verdict.convention.key,
        mask: verdict.convention.mask,
        errors: verdict.errors,
      },
    })
    return {
      ...item,
      checked: true,
      valid: false,
      conventionKey: verdict.convention.key,
      errors: verdict.errors,
      messages: rendered.details,
    }
  })

  return NextResponse.json(
    { ruleSet: loaded.document.ruleSet, locale, results },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
