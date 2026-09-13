'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { FormError } from '@/components/ui'
import type { AcceptState } from '@/server/team/invitations'

export function AcceptForm({ onAccept }: { onAccept: () => Promise<AcceptState> }) {
  const t = useTranslations('invite')
  const common = useTranslations('common')
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<AcceptState>({})

  return (
    <div className="space-y-3">
      <FormError>{state.error ? t(state.error) : null}</FormError>
      <button
        type="button"
        className="btn-primary w-full"
        disabled={pending}
        onClick={() => startTransition(async () => setState(await onAccept()))}
      >
        {pending ? common('loading') : t('accept')}
      </button>
    </div>
  )
}
