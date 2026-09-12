'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'

const TABS = [
  { key: 'dashboard', segment: '' },
  { key: 'protocol', segment: '/protocol' },
  { key: 'team', segment: '/team' },
  { key: 'naming', segment: '/naming' },
  { key: 'folders', segment: '/folders', phase2: true },
  { key: 'parameters', segment: '/parameters', phase2: true },
  { key: 'deliverables', segment: '/deliverables', phase2: true },
  { key: 'quality', segment: '/quality', phase2: true },
  { key: 'settings', segment: '/settings' },
] as const

export function ProjectNav({ projectId }: { projectId: string }) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const base = `/p/${projectId}`

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-[color:var(--border)]">
      {TABS.map((tab) => {
        const href = `${base}${tab.segment}`
        const active = tab.segment === '' ? pathname === base : pathname.startsWith(href)
        return (
          <Link
            key={tab.key}
            href={href}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
              active
                ? 'border-brand-600 font-medium text-brand-700 dark:text-brand-300'
                : 'border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]'
            }`}
          >
            {t(tab.key)}
            {'phase2' in tab && tab.phase2 ? (
              <span className="muted ml-1.5 rounded bg-[color:var(--surface-sunken)] px-1 py-0.5 text-[10px] uppercase">
                {t('comingSoon')}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
