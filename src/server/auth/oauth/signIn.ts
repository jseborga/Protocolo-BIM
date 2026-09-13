import 'server-only'
import { appLocaleToDb, type AppLocale } from '@/i18n/locales'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/server/auth/session'
import { decideLink, type IdentityClaims, type LinkRefusal } from './linking'
import type { OAuthProviderId } from './providers'

export type OAuthOutcome =
  | { ok: true; userId: string }
  | { ok: false; reason: LinkRefusal }

/**
 * Turn verified provider claims into a signed-in session, creating or linking
 * the account as `decideLink` dictates.
 */
export async function signInWithProvider(
  provider: OAuthProviderId,
  claims: IdentityClaims,
  locale: AppLocale,
  meta?: { userAgent?: string; ip?: string },
): Promise<OAuthOutcome> {
  const email = claims.email?.trim().toLowerCase()

  const [linked, existing] = await Promise.all([
    prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: claims.subject } },
      select: { userId: true },
    }),
    email
      ? prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true } })
      : Promise.resolve(null),
  ])

  const decision = decideLink({
    provider,
    claims,
    linkedUserId: linked?.userId ?? null,
    existingUser: existing,
  })

  if (decision.action === 'REFUSE') return { ok: false, reason: decision.reason }

  let userId: string

  if (decision.action === 'SIGN_IN') {
    userId = decision.userId
    await prisma.oAuthAccount.update({
      where: { provider_providerAccountId: { provider, providerAccountId: claims.subject } },
      data: { lastLoginAt: new Date(), email },
    })
  } else if (decision.action === 'LINK') {
    userId = decision.userId
    await prisma.$transaction([
      prisma.oAuthAccount.create({
        data: {
          userId,
          provider,
          providerAccountId: claims.subject,
          email,
          lastLoginAt: new Date(),
        },
      }),
      // Signing in through a provider that vouches for the address settles the
      // verification that a password-only registration never established.
      prisma.user.update({
        where: { id: userId },
        data: { emailVerified: new Date() },
      }),
    ])
  } else {
    const created = await prisma.user.create({
      data: {
        email: email!,
        emailVerified: new Date(),
        name: claims.name?.trim() || email!.split('@')[0]!,
        image: claims.picture,
        locale: appLocaleToDb[locale],
        oauthAccounts: {
          create: {
            provider,
            providerAccountId: claims.subject,
            email,
            lastLoginAt: new Date(),
          },
        },
      },
    })
    userId = created.id
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } })
  if (!user?.isActive) return { ok: false, reason: 'ACCOUNT_DISABLED' }

  await createSession(userId, meta)
  return { ok: true, userId }
}
