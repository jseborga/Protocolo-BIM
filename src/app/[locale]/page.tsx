import { getTranslations, setRequestLocale } from 'next-intl/server'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { Card } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/server/auth'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: 'home' })
  const common = await getTranslations({ locale, namespace: 'common' })
  const user = await getCurrentUser()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">{common('appName')}</span>
        <div className="flex items-center gap-3">
          <LocaleSwitcher current={locale} />
          {user ? (
            <Link href="/projects" className="btn-primary">
              {common('appName')}
            </Link>
          ) : (
            <Link href="/login" className="btn-secondary">
              {t('cta')}
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <p className="muted text-xs font-semibold uppercase tracking-[0.2em]">
          {common('tagline')}
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight">
          {t('title')}
        </h1>
        <p className="muted mt-4 max-w-2xl text-base">{t('subtitle')}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={user ? '/projects' : '/register'} className="btn-primary">
            {user ? common('appName') : t('ctaRegister')}
          </Link>
          {!user ? (
            <Link href="/login" className="btn-secondary">
              {t('cta')}
            </Link>
          ) : null}
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {([1, 2, 3] as const).map((index) => (
            <Card key={index}>
              <h2 className="text-sm font-semibold">{t(`feature${index}Title`)}</h2>
              <p className="muted mt-2 text-sm">{t(`feature${index}Body`)}</p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
