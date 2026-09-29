import { NextResponse } from 'next/server'
import { dbLocaleToApp } from '@/i18n/locales'
import { appUrl } from '@/lib/app-url'
import { authenticateApi } from '@/server/revit/apiAuth'
import { loadStandard } from '@/server/revit/standardRepository'

export const dynamic = 'force-dynamic'

const API_VERSION = 1

/**
 * What the add-in calls when "Connect" is pressed: proves the address and the
 * token are right, and says which project the token belongs to.
 */
export async function GET(request: Request) {
  const auth = await authenticateApi(request, null)
  if (!auth.ok) return auth.response

  const { context } = auth
  // Loading the standard also records its current version, so the add-in
  // can show which rules it is about to use before syncing anything.
  const standard = await loadStandard(context.project.id)

  return NextResponse.json(
    {
      apiVersion: API_VERSION,
      server: 'Protocolo BIM',
      token: { name: context.tokenName, scopes: context.scopes },
      project: {
        id: context.project.id,
        code: context.project.code,
        name: context.project.name,
        organisation: context.project.orgName,
        baseLocale: dbLocaleToApp[context.project.baseLocale],
      },
      ruleSet: standard
        ? { version: standard.document.ruleSet.version, hash: standard.document.ruleSet.hash }
        : null,
      webUrl: `${appUrl()}/${dbLocaleToApp[context.project.baseLocale]}/p/${context.project.id}`,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
