import { NextResponse } from 'next/server'
import { defaultLocale, locales, type AppLocale } from '@/i18n/locales'
import { beginOAuth, type OAuthProviderId } from '@/server/auth/oauth'
import { safeNextPath } from '@/server/auth/redirects'

export const dynamic = 'force-dynamic'

const PROVIDERS: OAuthProviderId[] = ['google', 'microsoft']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  if (!PROVIDERS.includes(provider as OAuthProviderId)) {
    return NextResponse.json({ error: 'unknown_provider' }, { status: 404 })
  }

  const url = new URL(request.url)
  const requested = url.searchParams.get('locale')
  const locale: AppLocale = locales.includes(requested as AppLocale)
    ? (requested as AppLocale)
    : defaultLocale

  // Destinations are kept without the locale prefix throughout, so the same
  // value works for a server action redirect and for this one.
  const next = safeNextPath(url.searchParams.get('next'), '/projects')

  const authorizationUrl = await beginOAuth(provider as OAuthProviderId, locale, next)
  if (!authorizationUrl) {
    return NextResponse.redirect(new URL(`/${locale}/login?error=provider`, url.origin))
  }

  return NextResponse.redirect(authorizationUrl)
}
