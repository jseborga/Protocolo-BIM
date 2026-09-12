import { renderMarkdown } from '@/lib/markdown'

/**
 * Renders protocol prose. The HTML comes from `renderMarkdown`, which escapes
 * raw HTML and restricts link schemes, so nothing authored in a section can
 * inject markup here.
 */
export function Markdown({ source, className = '' }: { source: string; className?: string }) {
  const html = renderMarkdown(source)
  if (!html) return null
  return (
    <div
      className={`prose-protocol ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
