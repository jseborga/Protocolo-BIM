import { NextResponse } from 'next/server'
import { appUrl } from '@/lib/app-url'
import { buildOpenApiDocument } from '@/server/revit/openapi'

export const dynamic = 'force-dynamic'

/** Public: the contract holds no project data, and tools fetch it without a key. */
export function GET() {
  return NextResponse.json(buildOpenApiDocument(appUrl()), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  })
}
