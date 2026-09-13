import { escapeHtml } from '@/lib/markdown'
import type { MailMessage } from './index'

export interface InvitationEmailInput {
  to: string
  inviterName: string
  projectName: string
  projectCode: string
  roleLabel: string
  acceptUrl: string
  /** Pre-translated strings, so the invitation arrives in the reader's language. */
  strings: {
    subject: string
    heading: string
    body: string
    cta: string
    ignore: string
    expires: string
  }
}

/**
 * Invitation email. Deliberately plain HTML with inline styles: mail clients
 * strip stylesheets, and the message has to survive that.
 */
export function invitationEmail(input: InvitationEmailInput): MailMessage {
  const project = `${input.projectCode} — ${input.projectName}`

  const text = [
    input.strings.heading,
    '',
    input.strings.body,
    '',
    project,
    input.roleLabel,
    '',
    input.acceptUrl,
    '',
    input.strings.expires,
    input.strings.ignore,
  ].join('\n')

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
    <tr><td style="padding:28px;">
      <h1 style="margin:0 0 12px;font-size:18px;">${escapeHtml(input.strings.heading)}</h1>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#334155;">
        ${escapeHtml(input.strings.body)}
      </p>
      <table role="presentation" style="width:100%;margin:0 0 20px;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:6px 0;color:#64748b;width:38%;">Proyecto</td>
          <td style="padding:6px 0;font-weight:600;">${escapeHtml(project)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Rol</td>
          <td style="padding:6px 0;font-weight:600;">${escapeHtml(input.roleLabel)}</td>
        </tr>
      </table>
      <a href="${escapeHtml(input.acceptUrl)}"
         style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;
                padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">
        ${escapeHtml(input.strings.cta)}
      </a>
      <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
        ${escapeHtml(input.strings.expires)}<br />
        ${escapeHtml(input.strings.ignore)}
      </p>
    </td></tr>
  </table>
</body>
</html>`

  return { to: input.to, subject: input.strings.subject, html, text }
}
