'use client'

import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import type { ActionState } from '@/server/protocol/actions'

export function CommentBox({
  action,
  sectionId,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  sectionId: string
}) {
  const t = useTranslations('protocol')
  const [, formAction] = useActionState<ActionState, FormData>(action, {})

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="sectionId" value={sectionId} />
      <textarea
        name="body"
        rows={2}
        required
        maxLength={4000}
        className="field text-sm"
        placeholder={t('addComment')}
      />
      <SubmitButton className="btn-secondary text-xs">{t('postComment')}</SubmitButton>
    </form>
  )
}
