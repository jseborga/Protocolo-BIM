'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import type { NamingActionState } from '@/server/naming/actions'

export function ToggleActive({
  isActive,
  onToggle,
}: {
  isActive: boolean
  onToggle: () => Promise<NamingActionState>
}) {
  const t = useTranslations('naming')
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<NamingActionState>({})

  return (
    <div>
      <button
        type="button"
        className="btn-ghost text-xs"
        disabled={pending}
        onClick={() => startTransition(async () => setState(await onToggle()))}
      >
        {isActive ? t('deactivate') : t('activate')}
      </button>
      {state.error ? (
        <p className="mt-1 text-xs text-red-600">
          {t(state.error, { count: state.detail ?? '', message: state.detail ?? '' })}
        </p>
      ) : null}
    </div>
  )
}
