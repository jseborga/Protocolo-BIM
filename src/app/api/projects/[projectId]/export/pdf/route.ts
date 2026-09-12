import { NextResponse } from 'next/server'
import { appLocaleToDb, type AppLocale, locales } from '@/i18n/routing'
import { resolveProjectAccess } from '@/server/authz'
import { buildExportDocument } from '@/server/export/document'
import { renderPdf } from '@/server/export/pdf'

export const dynamic = 'force-dynamic'
// Launching Chromium is well beyond the default serverless budget.
export const maxDuration = 120

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const access = await resolveProjectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const requested = new URL(request.url).searchParams.get('locale')
  const locale = locales.includes(requested as AppLocale)
    ? appLocaleToDb[requested as AppLocale]
    : access.project.baseLocale

  const document = await buildExportDocument(projectId, locale)
  if (!document) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const pdf = await renderPdf(document)
  const filename = `${document.projectCode}-protocolo-bim-v${document.versionLabel}-${locale.toLowerCase()}.pdf`

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
