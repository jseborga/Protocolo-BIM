import { apiError, authenticateApi } from '@/server/revit/apiAuth'
import { sharedParameterResponse } from '@/server/revit/sharedParameterResponse'
import { loadStandard } from '@/server/revit/standardRepository'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const auth = await authenticateApi(request, 'standard:read', projectId)
  if (!auth.ok) return auth.response

  const loaded = await loadStandard(projectId)
  if (!loaded) return apiError(404, 'not_found')

  return sharedParameterResponse(loaded.document)
}
