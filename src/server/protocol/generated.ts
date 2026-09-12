import 'server-only'
import type { Locale } from '@prisma/client'
import { getTranslations } from 'next-intl/server'
import { dbLocaleToApp } from '@/i18n/routing'
import { localized } from '@/lib/localized'
import { prisma } from '@/lib/prisma'
import { compileConvention, toSpec } from '@/server/naming'
import type { SectionGenerator } from './template'

/**
 * Sections that are rendered from live project data instead of typed by hand.
 *
 * They produce Markdown, which means the editor preview, the PDF and the DOCX
 * all get them through the same path as authored prose — and the document can
 * never fall out of step with the data it describes.
 */
export async function renderGeneratedSection(
  generator: SectionGenerator,
  projectId: string,
  locale: Locale,
): Promise<string> {
  const app = dbLocaleToApp[locale]
  switch (generator) {
    case 'PROJECT_INFO':
      return renderProjectInfo(projectId, app)
    case 'TEAM':
      return renderTeam(projectId, app)
    case 'RACI':
      return renderRaci(projectId, app)
    case 'SOFTWARE':
      return renderSoftware(projectId, app)
    case 'NAMING':
      return renderNaming(projectId, app)
    default:
      return ''
  }
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return ''
  const escape = (cell: string) => cell.replace(/\|/gu, '\\|').replace(/\n/gu, ' ')
  return [
    `| ${headers.map(escape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((cell) => escape(cell || '—')).join(' | ')} |`),
  ].join('\n')
}

async function renderProjectInfo(projectId: string, locale: 'es' | 'en' | 'pt'): Promise<string> {
  const [project, t, clientLabels, projectLabels] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, include: { client: true, org: true } }),
    getTranslations({ locale, namespace: 'protocol' }),
    getTranslations({ locale, namespace: 'client' }),
    getTranslations({ locale, namespace: 'projects' }),
  ])
  if (!project) return ''

  const formatDate = (value: Date | null) =>
    value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value) : '—'

  const rows: string[][] = [
    [t('coverProject'), `${project.code} — ${project.name}`],
    [projectLabels('country'), [project.city, project.country].filter(Boolean).join(', ') || '—'],
    [projectLabels('address'), project.address ?? '—'],
    [projectLabels('startDate'), formatDate(project.startDate)],
    [projectLabels('endDate'), formatDate(project.endDate)],
    [t('coverStandard'), project.standard.replace(/_/gu, ' ')],
  ]

  if (project.client) {
    rows.push(
      [clientLabels('legalName'), project.client.legalName],
      [clientLabels('taxId'), project.client.taxId ?? '—'],
      [clientLabels('contactName'), project.client.contactName ?? '—'],
      [clientLabels('contactEmail'), project.client.contactEmail ?? '—'],
    )
  }

  return table([t('coverProject'), '—'], rows)
}

async function renderTeam(projectId: string, locale: 'es' | 'en' | 'pt'): Promise<string> {
  const [parties, members, teamLabels, roleLabels, partyLabels, common] = await Promise.all([
    prisma.party.findMany({ where: { projectId }, include: { discipline: true }, orderBy: { type: 'asc' } }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true, discipline: true, party: true, team: true },
      orderBy: { role: 'asc' },
    }),
    getTranslations({ locale, namespace: 'team' }),
    getTranslations({ locale, namespace: 'projectRole' }),
    getTranslations({ locale, namespace: 'partyType' }),
    getTranslations({ locale, namespace: 'common' }),
  ])

  const partyTable = table(
    [common('name'), common('role'), common('code'), common('discipline')],
    parties.map((party) => [
      party.name,
      partyLabels(party.type),
      party.code ?? '—',
      party.discipline ? localized(party.discipline.labels, locale, party.discipline.code) : '—',
    ]),
  )

  const memberTable = table(
    [common('name'), common('role'), common('discipline'), teamLabels('parties')],
    members.map((member) => [
      member.user.name,
      roleLabels(member.role),
      member.discipline ? localized(member.discipline.labels, locale, member.discipline.code) : '—',
      member.party?.name ?? '—',
    ]),
  )

  return [
    parties.length > 0 ? `### ${teamLabels('parties')}\n\n${partyTable}` : '',
    members.length > 0 ? `### ${teamLabels('members')}\n\n${memberTable}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function renderRaci(projectId: string, locale: 'es' | 'en' | 'pt'): Promise<string> {
  const [activities, teamLabels, roleLabels] = await Promise.all([
    prisma.raciActivity.findMany({
      where: { projectId },
      include: { assignments: { include: { team: true, discipline: true } } },
      orderBy: { order: 'asc' },
    }),
    getTranslations({ locale, namespace: 'team' }),
    getTranslations({ locale, namespace: 'projectRole' }),
  ])

  const roles = [
    'INFORMATION_MANAGER',
    'BIM_MANAGER',
    'BIM_COORDINATOR',
    'BIM_MODELLER',
    'REVIEWER',
    'CLIENT',
  ] as const

  const used = roles.filter((role) =>
    activities.some((activity) =>
      activity.assignments.some((assignment) => assignment.projectRole === role),
    ),
  )
  if (used.length === 0) return ''

  return table(
    [teamLabels('activity'), ...used.map((role) => roleLabels(role))],
    activities.map((activity) => [
      localized(activity.labels, locale, activity.key),
      ...used.map(
        (role) =>
          activity.assignments
            .filter((assignment) => assignment.projectRole === role)
            .map((assignment) => assignment.letter)
            .join(', ') || '—',
      ),
    ]),
  )
}

async function renderSoftware(projectId: string, locale: 'es' | 'en' | 'pt'): Promise<string> {
  const [tools, teamLabels, common] = await Promise.all([
    prisma.softwareTool.findMany({
      where: { projectId },
      include: { discipline: true },
      orderBy: { order: 'asc' },
    }),
    getTranslations({ locale, namespace: 'team' }),
    getTranslations({ locale, namespace: 'common' }),
  ])

  return table(
    [
      common('discipline'),
      common('name'),
      teamLabels('softwareVersion'),
      teamLabels('nativeFormat'),
      teamLabels('exchangeFormat'),
      teamLabels('purpose'),
    ],
    tools.map((tool) => [
      tool.discipline ? localized(tool.discipline.labels, locale, tool.discipline.code) : '—',
      tool.name,
      tool.version ?? '—',
      tool.nativeFormat ?? '—',
      tool.exchangeFormat ?? '—',
      tool.purpose ?? '—',
    ]),
  )
}

async function renderNaming(projectId: string, locale: 'es' | 'en' | 'pt'): Promise<string> {
  const [conventions, namingLabels, targetLabels, sourceLabels, common] = await Promise.all([
    prisma.namingConvention.findMany({
      where: { projectId, isActive: true },
      include: {
        fields: {
          orderBy: { order: 'asc' },
          include: { codeTable: { include: { values: { orderBy: { order: 'asc' } } } } },
        },
        examples: true,
      },
      orderBy: { target: 'asc' },
    }),
    getTranslations({ locale, namespace: 'naming' }),
    getTranslations({ locale, namespace: 'namingTarget' }),
    getTranslations({ locale, namespace: 'fieldSource' }),
    getTranslations({ locale, namespace: 'common' }),
  ])

  const blocks = conventions.map((record) => {
    let mask = record.key
    try {
      mask = compileConvention(toSpec(record)).mask
    } catch {
      // A convention that cannot compile still appears, without its mask.
    }

    const fieldTable = table(
      [common('code'), common('name'), namingLabels('codeValues'), common('example')],
      record.fields.map((field) => [
        field.key,
        localized(field.labels, locale, field.key),
        field.codeTable
          ? field.codeTable.values.map((value) => value.code).join(', ')
          : (field.pattern ?? sourceLabels(field.source)),
        field.example ?? '—',
      ]),
    )

    const valid = record.examples.filter((example) => example.shouldBeValid).map((example) => example.sample)

    return [
      `### ${targetLabels(record.target)} — ${localized(record.labels, locale, record.key)}`,
      localized(record.description, locale, ''),
      `\`${mask}\``,
      fieldTable,
      valid.length > 0 ? `${common('example')}: ${valid.map((sample) => `\`${sample}\``).join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
  })

  return blocks.join('\n\n')
}
