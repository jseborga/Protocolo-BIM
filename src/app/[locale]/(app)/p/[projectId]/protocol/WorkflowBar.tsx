'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { FormError } from '@/components/ui'
import type { ActionState } from '@/server/protocol/actions'

export function WorkflowBar({
  status,
  canEdit,
  canApprove,
  canCreateVersion,
  onChangeStatus,
  onCreateVersion,
}: {
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SUPERSEDED'
  canEdit: boolean
  canApprove: boolean
  canCreateVersion: boolean
  onChangeStatus: (target: 'IN_REVIEW' | 'APPROVED' | 'DRAFT') => Promise<ActionState>
  onCreateVersion: () => Promise<ActionState>
}) {
  const t = useTranslations('protocol')
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<ActionState>({})

  function run(task: () => Promise<ActionState>) {
    startTransition(async () => setState(await task()))
  }

  return (
    <div className="space-y-2">
      <FormError>
        {state.error
          ? state.error === 'requiredSectionsMissing'
            ? t('requiredSectionsMissing', { sections: state.sections ?? '' })
            : state.error.startsWith('errors.')
              ? null
              : t(state.error)
          : null}
      </FormError>
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && status === 'DRAFT' ? (
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={pending}
            onClick={() => run(() => onChangeStatus('IN_REVIEW'))}
          >
            {t('submitForReview')}
          </button>
        ) : null}

        {status === 'IN_REVIEW' && canEdit ? (
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={pending}
            onClick={() => run(() => onChangeStatus('DRAFT'))}
          >
            {t('backToDraft')}
          </button>
        ) : null}

        {status === 'IN_REVIEW' && canApprove ? (
          <button
            type="button"
            className="btn-primary text-xs"
            disabled={pending}
            onClick={() => run(() => onChangeStatus('APPROVED'))}
          >
            {t('approve')}
          </button>
        ) : null}

        {status === 'APPROVED' && canCreateVersion ? (
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={pending}
            onClick={() => run(onCreateVersion)}
            title={t('newVersionHint')}
          >
            {t('newVersion')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
