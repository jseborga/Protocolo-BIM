import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { Link, redirect } from '@/i18n/navigation'
import type { AppLocale } from '@/i18n/routing'
import { getCurrentUser } from '@/server/auth'
import { logoutAction } from '@/server/auth/actions'

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await getCurrentUser()
  if (!user) redirect({ href: '/login', locale })

  const common = await getTranslations({ locale, namespace: 'common' })

  async function signOut() {
    'use server'
    await logoutAction(locale as AppLocale)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/projects" className="text-sm font-semibold tracking-tight">
            {common('appName')}
          </Link>
          <div className="flex items-center gap-3">
            <span className="muted hidden text-xs sm:inline">{user!.name}</span>
            <LocaleSwitcher current={locale} />
            <form action={signOut}>
              <button type="submit" className="btn-ghost text-xs">
                {common('logout')}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
    </div>
  )
}
