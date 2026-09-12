import { getTranslations } from 'next-intl/server'
import { Card, PageHeader } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { dbLocaleToApp, type AppLocale } from '@/i18n/routing'
import { getCurrentUser } from '@/server/auth'
import { createProjectAction, type ProjectFormState } from '@/server/projects/actions'
import { NewProjectForm } from './NewProjectForm'

export default async function NewProjectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const user = (await getCurrentUser())!
  const t = await getTranslations({ locale, namespace: 'projects' })
  const common = await getTranslations({ locale, namespace: 'common' })

  async function action(state: ProjectFormState, formData: FormData) {
    'use server'
    return createProjectAction(locale as AppLocale, state, formData)
  }

  const organisations = user.memberships.map((membership) => ({
    id: membership.orgId,
    name: membership.org.name,
  }))

  return (
    <>
      <PageHeader
        title={t('new')}
        actions={
          <Link href="/projects" className="btn-secondary">
            {common('back')}
          </Link>
        }
      />
      <Card className="max-w-2xl">
        <NewProjectForm
          action={action}
          organisations={organisations}
          defaultLocale={dbLocaleToApp[user.locale]}
        />
      </Card>
    </>
  )
}
