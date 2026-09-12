import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { Link } from '@/i18n/navigation'

export default async function AuthLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          {t('appName')}
        </Link>
        <LocaleSwitcher current={locale} />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
