import { getTranslations } from 'next-intl/server'
import { Card, PageHeader } from '@/components/ui'
import { requireProjectAccess } from '@/server/authz'

export default async function Phase2Page({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>
}) {
  const { locale, projectId } = await params
  await requireProjectAccess(projectId)

  const nav = await getTranslations({ locale, namespace: 'nav' })
  const t = await getTranslations({ locale, namespace: 'phase2' })

  return (
    <>
      <PageHeader title={nav('quality')} subtitle={t('title')} />
      <Card className="max-w-2xl">
        <p className="text-sm">{t('quality')}</p>
        <p className="muted mt-3 text-xs">{t('plannedNote')}</p>
      </Card>
    </>
  )
}
