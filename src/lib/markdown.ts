import { Marked, type RendererObject, type Tokens } from 'marked'

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (char) => HTML_ESCAPES[char]!)
}

/** Only these schemes may appear in a link or image produced from Markdown. */
function safeHref(href: string): string | null {
  const trimmed = href.trim()
  if (trimmed === '') return null
  if (/^(?:https?:|mailto:|tel:)/iu.test(trimmed)) return trimmed
  // Relative links stay allowed; everything else (javascript:, data:, vbscript:)
  // is dropped rather than rendered.
  if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed)) return null
  return trimmed
}

/**
 * Markdown renderer for protocol prose.
 *
 * Protocol content is written by authenticated project members, but a member
 * is not a reason to trust raw HTML: inline and block HTML are escaped rather
 * than passed through, and link targets are restricted to safe schemes. This
 * is the only place protocol text becomes HTML, so it is the only place that
 * has to get this right.
 */
const renderer: RendererObject = {
  html({ text }: Tokens.HTML | Tokens.Tag): string {
    return escapeHtml(text)
  },
  link({ href, title, tokens }: Tokens.Link): string {
    const safe = safeHref(href)
    const text = this.parser.parseInline(tokens)
    if (!safe) return text
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
    return `<a href="${escapeHtml(safe)}"${titleAttr} rel="noopener noreferrer nofollow" target="_blank">${text}</a>`
  },
  image({ href, title, text }: Tokens.Image): string {
    const safe = safeHref(href)
    if (!safe) return escapeHtml(text)
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
    return `<img src="${escapeHtml(safe)}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy" />`
  },
}

const markdown = new Marked({ gfm: true, breaks: true, async: false, renderer })

export function renderMarkdown(source: string): string {
  if (!source?.trim()) return ''
  return markdown.parse(source, { async: false }) as string
}

/** Plain text version, used for search snippets and DOCX fallbacks. */
export function markdownToPlainText(source: string): string {
  return (source ?? '')
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/[*_~`>#|-]/gu, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim()
}
