import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui'
import { Link } from '@/i18n/navigation'

export default async function NotFound() {
  const t = await getTranslations('errors')

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-md text-center">
        <h1 className="text-lg font-semibold">{t('notFound')}</h1>
        <p className="muted mt-2 text-sm">{t('notFoundBody')}</p>
        <Link href="/projects" className="btn-primary mt-5">
          {t('goHome')}
        </Link>
      </Card>
    </div>
  )
}
