import { appUrl } from '@/lib/app-url'
import { apiJson } from '@/server/revit/apiAuth'
import { buildOpenApiDocument } from '@/server/revit/openapi'

export const dynamic = 'force-dynamic'

/** Public: the contract holds no project data, and tools fetch it without a key. */
export function GET() {
  return apiJson(buildOpenApiDocument(appUrl()), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  })
}
