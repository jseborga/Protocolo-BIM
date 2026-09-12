import { getTranslations } from 'next-intl/server'
import { Badge, EmptyState, Mono, PageHeader, SectionCard } from '@/components/ui'
import type { AppLocale } from '@/i18n/routing'
import { localized } from '@/lib/localized'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'
import {
  addMemberAction,
  addPartyAction,
  addSoftwareAction,
  removeMemberAction,
  removeSoftwareAction,
  saveRaciAction,
  type TeamActionState,
} from '@/server/team/actions'
import { AddMemberForm, AddPartyForm, AddSoftwareForm, RaciMatrix } from './TeamForms'

const PARTY_TONE = {
  APPOINTING: 'brand',
  LEAD_APPOINTED: 'green',
  APPOINTED: 'slate',
} as const

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>
}) {
  const { locale, projectId } = await params
  const access = await requireProjectAccess(projectId)
  const appLocale = locale as AppLocale

  const t = await getTranslations({ locale, namespace: 'team' })
  const roleLabels = await getTranslations({ locale, namespace: 'projectRole' })
  const partyLabels = await getTranslations({ locale, namespace: 'partyType' })
  const common = await getTranslations({ locale, namespace: 'common' })

  const [members, parties, disciplines, software, activities] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true, discipline: true, party: true, team: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.party.findMany({
      where: { projectId },
      include: { discipline: true },
      orderBy: { type: 'asc' },
    }),
    prisma.discipline.findMany({ orderBy: { order: 'asc' } }),
    prisma.softwareTool.findMany({
      where: { projectId },
      include: { discipline: true },
      orderBy: { order: 'asc' },
    }),
    prisma.raciActivity.findMany({
      where: { projectId },
      include: { assignments: true },
      orderBy: { order: 'asc' },
    }),
  ])

  const canManage = access.can('team:manage')

  const disciplineOptions = disciplines.map((discipline) => ({
    id: discipline.id,
    label: localized(discipline.labels, appLocale, discipline.code),
  }))

  const assignments: Record<string, string> = {}
  for (const activity of activities) {
    for (const assignment of activity.assignments) {
      if (assignment.projectRole) {
        assignments[`raci:${activity.id}:${assignment.projectRole}`] = assignment.letter
      }
    }
  }

  async function addMember(state: TeamActionState, formData: FormData) {
    'use server'
    return addMemberAction(appLocale, projectId, state, formData)
  }
  async function addParty(state: TeamActionState, formData: FormData) {
    'use server'
    return addPartyAction(appLocale, projectId, state, formData)
  }
  async function addSoftware(state: TeamActionState, formData: FormData) {
    'use server'
    return addSoftwareAction(appLocale, projectId, state, formData)
  }
  async function saveRaci(state: TeamActionState, formData: FormData) {
    'use server'
    return saveRaciAction(appLocale, projectId, state, formData)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <SectionCard title={t('parties')}>
        {parties.length === 0 ? (
          <EmptyState>{common('empty')}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{common('name')}</th>
                  <th>{common('role')}</th>
                  <th>{common('code')}</th>
                  <th>{common('discipline')}</th>
                  <th>{common('email')}</th>
                </tr>
              </thead>
              <tbody>
                {parties.map((party) => (
                  <tr key={party.id}>
                    <td className="font-medium">{party.name}</td>
                    <td>
                      <Badge tone={PARTY_TONE[party.type]}>{partyLabels(party.type)}</Badge>
                    </td>
                    <td>{party.code ? <Mono>{party.code}</Mono> : '—'}</td>
                    <td className="text-sm">
                      {party.discipline
                        ? localized(party.discipline.labels, appLocale, party.discipline.code)
                        : '—'}
                    </td>
                    <td className="muted text-xs">{party.contactEmail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManage ? (
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-medium">{t('addParty')}</summary>
            <div className="mt-4 rounded-lg border border-[color:var(--border)] p-4">
              <AddPartyForm action={addParty} disciplines={disciplineOptions} />
            </div>
          </details>
        ) : null}
      </SectionCard>

      <SectionCard title={t('members')}>
        {members.length === 0 ? (
          <EmptyState>{common('empty')}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{common('name')}</th>
                  <th>{common('role')}</th>
                  <th>{common('discipline')}</th>
                  <th>{t('parties')}</th>
                  {canManage ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <span className="font-medium">{member.user.name}</span>
                      <span className="muted ml-2 text-xs">{member.user.email}</span>
                    </td>
                    <td className="text-sm">{roleLabels(member.role)}</td>
                    <td className="text-sm">
                      {member.discipline
                        ? localized(member.discipline.labels, appLocale, member.discipline.code)
                        : '—'}
                    </td>
                    <td className="text-sm">{member.party?.name ?? '—'}</td>
                    {canManage ? (
                      <td>
                        <form
                          action={async () => {
                            'use server'
                            await removeMemberAction(appLocale, projectId, member.id)
                          }}
                        >
                          <button type="submit" className="btn-ghost text-xs">
                            {common('remove')}
                          </button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManage ? (
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-medium">{t('addMember')}</summary>
            <div className="mt-4 rounded-lg border border-[color:var(--border)] p-4">
              <AddMemberForm
                action={addMember}
                disciplines={disciplineOptions}
                parties={parties.map((party) => ({ id: party.id, label: party.name }))}
              />
            </div>
          </details>
        ) : null}
      </SectionCard>

      <SectionCard title={t('raci')} description={t('raciHint')}>
        {activities.length === 0 ? (
          <EmptyState>{common('empty')}</EmptyState>
        ) : (
          <RaciMatrix
            action={saveRaci}
            activities={activities.map((activity) => ({
              id: activity.id,
              label: localized(activity.labels, appLocale, activity.key),
            }))}
            assignments={assignments}
            readOnly={!canManage}
          />
        )}
      </SectionCard>

      <SectionCard title={t('software')}>
        {software.length === 0 ? (
          <EmptyState>{common('empty')}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{common('discipline')}</th>
                  <th>{common('name')}</th>
                  <th>{t('softwareVersion')}</th>
                  <th>{t('nativeFormat')}</th>
                  <th>{t('exchangeFormat')}</th>
                  <th>{t('purpose')}</th>
                  {canManage ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {software.map((tool) => (
                  <tr key={tool.id}>
                    <td className="text-sm">
                      {tool.discipline
                        ? localized(tool.discipline.labels, appLocale, tool.discipline.code)
                        : '—'}
                    </td>
                    <td className="font-medium">{tool.name}</td>
                    <td className="text-sm">{tool.version ?? '—'}</td>
                    <td>{tool.nativeFormat ? <Mono>{tool.nativeFormat}</Mono> : '—'}</td>
                    <td>{tool.exchangeFormat ? <Mono>{tool.exchangeFormat}</Mono> : '—'}</td>
                    <td className="muted text-sm">{tool.purpose ?? '—'}</td>
                    {canManage ? (
                      <td>
                        <form
                          action={async () => {
                            'use server'
                            await removeSoftwareAction(appLocale, projectId, tool.id)
                          }}
                        >
                          <button type="submit" className="btn-ghost text-xs">
                            {common('remove')}
                          </button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManage ? (
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-medium">{t('addSoftware')}</summary>
            <div className="mt-4 rounded-lg border border-[color:var(--border)] p-4">
              <AddSoftwareForm action={addSoftware} disciplines={disciplineOptions} />
            </div>
          </details>
        ) : null}
      </SectionCard>
    </div>
  )
}
