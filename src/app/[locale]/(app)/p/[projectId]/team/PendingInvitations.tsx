'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

export interface PendingInvitation {
  id: string
  email: string
  roleLabel: string
  invitedBy: string
  createdAt: string
}

/**
 * Pending invitations, with a way to reissue the link.
 *
 * The stored token is hashed, so a link that was never delivered cannot be
 * read back — it has to be replaced, and that is what this offers.
 */
export function PendingInvitations({
  invitations,
  onRegenerate,
  onRevoke,
}: {
  invitations: PendingInvitation[]
  onRegenerate: (invitationId: string) => Promise<{ url?: string; error?: string }>
  onRevoke: (invitationId: string) => Promise<void>
}) {
  const t = useTranslations('team')
  const common = useTranslations('common')
  const [pending, startTransition] = useTransition()
  const [links, setLinks] = useState<Record<string, string>>({})

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>{common('email')}</th>
            <th>{common('role')}</th>
            <th>{common('createdAt')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {invitations.map((invitation) => (
            <tr key={invitation.id}>
              <td className="text-sm">
                {invitation.email}
                {links[invitation.id] ? (
                  <p
                    data-testid="invite-link"
                    className="mt-1 break-all rounded border border-[color:var(--border)] bg-[color:var(--surface-sunken)] p-2 font-mono text-xs"
                  >
                    {links[invitation.id]}
                  </p>
                ) : null}
              </td>
              <td className="text-sm">{invitation.roleLabel}</td>
              <td className="muted text-xs">
                {invitation.createdAt} · {invitation.invitedBy}
              </td>
              <td className="whitespace-nowrap">
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await onRegenerate(invitation.id)
                      if (result.url) {
                        setLinks((current) => ({ ...current, [invitation.id]: result.url! }))
                      }
                    })
                  }
                >
                  {t('newLink')}
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  disabled={pending}
                  onClick={() => startTransition(async () => onRevoke(invitation.id))}
                >
                  {t('revoke')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
