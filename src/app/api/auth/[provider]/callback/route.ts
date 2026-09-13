import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { defaultLocale, locales, type AppLocale } from '@/i18n/locales'
import {
  clearTransaction,
  completeOAuth,
  readTransaction,
  signInWithProvider,
  type OAuthProviderId,
} from '@/server/auth/oauth'

export const dynamic = 'force-dynamic'

const PROVIDERS: OAuthProviderId[] = ['google', 'microsoft']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  const url = new URL(request.url)

  if (!PROVIDERS.includes(provider as OAuthProviderId)) {
    return NextResponse.json({ error: 'unknown_provider' }, { status: 404 })
  }

  const transaction = await readTransaction()
  await clearTransaction()

  const locale: AppLocale = locales.includes(transaction?.locale as AppLocale)
    ? (transaction!.locale as AppLocale)
    : defaultLocale
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/${locale}/login?error=${reason}`, url.origin))

  // No transaction, a mismatched provider, or the person declining at the
  // provider all land here; none of them should look like a working sign-in.
  if (!transaction || transaction.provider !== provider) return fail('state')
  if (url.searchParams.get('error')) return fail('cancelled')

  let claims
  try {
    claims = await completeOAuth(transaction, url)
  } catch {
    return fail('exchange')
  }
  if (!claims) return fail('exchange')

  const store = await headers()
  const outcome = await signInWithProvider(provider as OAuthProviderId, claims, locale, {
    userAgent: store.get('user-agent')?.slice(0, 250) ?? undefined,
    ip: store.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
  })

  if (!outcome.ok) return fail(outcome.reason.toLowerCase())

  return NextResponse.redirect(new URL(`/${locale}${transaction.next}`, url.origin))
}
