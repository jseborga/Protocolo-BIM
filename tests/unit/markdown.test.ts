import { describe, expect, it } from 'vitest'
import { markdownToPlainText, renderMarkdown } from '@/lib/markdown'

describe('renderMarkdown', () => {
  it('renders the Markdown a protocol actually uses', () => {
    const html = renderMarkdown('## Título\n\n- uno\n- dos\n\n**negrita** y *cursiva*')
    expect(html).toContain('<h2>Título</h2>')
    expect(html).toContain('<li>uno</li>')
    expect(html).toContain('<strong>negrita</strong>')
    expect(html).toContain('<em>cursiva</em>')
  })

  it('renders GitHub-flavoured tables', () => {
    const html = renderMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>A</th>')
    expect(html).toContain('<td>1</td>')
  })

  it('escapes raw HTML instead of passing it through', () => {
    const html = renderMarkdown('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes inline HTML attributes that could carry handlers', () => {
    const html = renderMarkdown('Texto <img src=x onerror="alert(1)"> final')
    expect(html).not.toContain('onerror="')
    expect(html).toContain('&lt;img')
  })

  it('drops javascript: links but keeps their text', () => {
    const html = renderMarkdown('[pulsa](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('pulsa')
  })

  it('drops data: image sources', () => {
    const html = renderMarkdown('![x](data:text/html;base64,PHNjcmlwdD4=)')
    expect(html).not.toContain('data:text/html')
  })

  it('keeps http links and marks them safe for external navigation', () => {
    const html = renderMarkdown('[ISO](https://www.iso.org)')
    expect(html).toContain('href="https://www.iso.org"')
    expect(html).toContain('rel="noopener noreferrer nofollow"')
  })

  it('keeps relative links', () => {
    expect(renderMarkdown('[anexo](/anexos/1.pdf)')).toContain('href="/anexos/1.pdf"')
  })

  it('returns an empty string for empty content', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown('   ')).toBe('')
  })
})

describe('markdownToPlainText', () => {
  it('strips markup and collapses whitespace', () => {
    expect(markdownToPlainText('## Título\n\n- **uno**\n- dos')).toBe('Título uno dos')
  })

  it('keeps the text of a link and drops its target', () => {
    expect(markdownToPlainText('ver [la norma](https://iso.org)')).toBe('ver la norma')
  })
})
