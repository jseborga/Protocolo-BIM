import { NextResponse } from 'next/server'
import { apiError, apiJson, authenticateApi } from '@/server/revit/apiAuth'
import { etagFor } from '@/server/revit/standard'
import { loadStandard } from '@/server/revit/standardRepository'

export const dynamic = 'force-dynamic'

/**
 * The project standard the add-in applies and audits against.
 *
 * Answers 304 when the add-in already holds the current version, so syncing
 * an unchanged standard costs one round trip and no payload.
 */
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const auth = await authenticateApi(request, 'standard:read', projectId)
  if (!auth.ok) return auth.response

  const loaded = await loadStandard(projectId)
  if (!loaded) return apiError(404, 'not_found')

  const { document } = loaded
  const etag = etagFor(document.ruleSet.version, document.ruleSet.hash)
  const headers = { ETag: etag, 'Cache-Control': 'private, no-cache' }

  if (matchesEtag(request.headers.get('if-none-match'), etag)) {
    return new NextResponse(null, { status: 304, headers })
  }

  return apiJson(document, { headers })
}

/** RFC 9110 weak comparison over a list, so `W/"…"` and `a, b` forms match too. */
function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false
  return header
    .split(',')
    .map((candidate) => candidate.trim().replace(/^W\//u, ''))
    .some((candidate) => candidate === etag || candidate === '*')
}
