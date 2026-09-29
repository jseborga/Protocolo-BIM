import { NextResponse } from 'next/server'
import { resolveProjectAccess } from '@/server/authz'
import { sharedParameterResponse } from '@/server/revit/sharedParameterResponse'
import { loadStandard } from '@/server/revit/standardRepository'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await resolveProjectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const loaded = await loadStandard(projectId)
  if (!loaded) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return sharedParameterResponse(loaded.document)
}
