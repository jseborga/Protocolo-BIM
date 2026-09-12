'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useMemo, useState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { FormError } from '@/components/ui'
import { renderMarkdown } from '@/lib/markdown'
import type { ActionState } from '@/server/protocol/actions'

const TOOLBAR = [
  { key: '## ', label: 'H2', block: true },
  { key: '### ', label: 'H3', block: true },
  { key: '**', label: 'B', wrap: true },
  { key: '*', label: 'I', wrap: true },
  { key: '- ', label: '•', block: true },
  { key: '1. ', label: '1.', block: true },
] as const

export function SectionEditor({
  action,
  sectionId,
  initialTitle,
  initialBody,
  readOnly,
  readOnlyReason,
  languageName,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  sectionId: string
  initialTitle: string
  initialBody: string
  readOnly: boolean
  readOnlyReason?: string
  languageName: string
}) {
  const t = useTranslations('protocol')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<ActionState, FormData>(action, {})
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [showPreview, setShowPreview] = useState(false)

  // Switching section swaps the content under the same mounted editor.
  useEffect(() => {
    setTitle(initialTitle)
    setBody(initialBody)
  }, [sectionId, initialTitle, initialBody])

  const preview = useMemo(() => renderMarkdown(body), [body])

  function insert(token: (typeof TOOLBAR)[number]) {
    const textarea = document.getElementById('section-body') as HTMLTextAreaElement | null
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = body.slice(start, end)

    const next =
      'wrap' in token && token.wrap
        ? `${body.slice(0, start)}${token.key}${selected || 'texto'}${token.key}${body.slice(end)}`
        : `${body.slice(0, start)}${token.key}${selected}${body.slice(end)}`

    setBody(next)
    requestAnimationFrame(() => textarea.focus())
  }

  if (readOnly) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {readOnlyReason}
        </p>
        <h3 className="text-base font-semibold">{initialTitle}</h3>
        <div className="prose-protocol" dangerouslySetInnerHTML={{ __html: renderMarkdown(initialBody) }} />
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="sectionId" value={sectionId} />
      <FormError>{state.error && state.error !== 'errors.forbidden' ? t(state.error, { sections: state.sections ?? '' }) : state.error ? state.error : null}</FormError>

      <div>
        <label className="label" htmlFor="section-title">
          {t('sectionTitle')} · {languageName}
        </label>
        <input
          id="section-title"
          name="title"
          className="field font-medium"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={200}
        />
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label className="label mb-0" htmlFor="section-body">
            {t('body')}
          </label>
          <div className="flex items-center gap-1">
            {TOOLBAR.map((token) => (
              <button
                key={token.label}
                type="button"
                onClick={() => insert(token)}
                className="rounded px-2 py-1 font-mono text-xs hover:bg-[color:var(--surface-sunken)]"
                title={token.label}
              >
                {token.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowPreview((value) => !value)}
              className="btn-ghost text-xs"
            >
              {common('preview')}
            </button>
          </div>
        </div>

        <div className={showPreview ? 'grid gap-3 lg:grid-cols-2' : ''}>
          <textarea
            id="section-body"
            name="body"
            className="field min-h-[22rem] font-mono text-[13px] leading-relaxed"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={60_000}
          />
          {showPreview ? (
            <div
              className="min-h-[22rem] overflow-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4"
            >
              <div className="prose-protocol" dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          ) : null}
        </div>
        <p className="muted mt-1 text-xs">{t('bodyHint')}</p>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel={common('saving')}>{common('save')}</SubmitButton>
        {state.ok ? <span className="text-xs text-emerald-600">{common('saved')}</span> : null}
      </div>
    </form>
  )
}
