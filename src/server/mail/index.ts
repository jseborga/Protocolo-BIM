import 'server-only'

export type MailTransport = 'resend' | 'smtp' | 'none'

export interface MailMessage {
  to: string
  subject: string
  html: string
  text: string
}

export interface MailResult {
  delivered: boolean
  transport: MailTransport
  error?: string
}

function fromAddress(): string {
  return process.env.MAIL_FROM?.trim() || 'Protocolo BIM <no-reply@localhost>'
}

/** Which transport is configured, if any. */
export function mailTransport(): MailTransport {
  if (process.env.RESEND_API_KEY?.trim()) return 'resend'
  if (process.env.SMTP_URL?.trim()) return 'smtp'
  return 'none'
}

async function sendWithResend(message: MailMessage): Promise<MailResult> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  })

  if (!response.ok) {
    return { delivered: false, transport: 'resend', error: `HTTP ${response.status}` }
  }
  return { delivered: true, transport: 'resend' }
}

async function sendWithSmtp(message: MailMessage): Promise<MailResult> {
  const { createTransport } = await import('nodemailer')
  const transport = createTransport(process.env.SMTP_URL!.trim())
  await transport.sendMail({
    from: fromAddress(),
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  })
  return { delivered: true, transport: 'smtp' }
}

/**
 * Send a transactional message.
 *
 * A deployment without mail configured is a normal state, not a failure: the
 * message is logged and the caller is told nothing was delivered, so the
 * interface can offer the invitation link to copy by hand instead.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const transport = mailTransport()

  try {
    if (transport === 'resend') return await sendWithResend(message)
    if (transport === 'smtp') return await sendWithSmtp(message)
  } catch (error) {
    return { delivered: false, transport, error: (error as Error).message }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[mail] no transport configured — would send to ${message.to}: ${message.subject}`)
  }
  return { delivered: false, transport: 'none' }
}
