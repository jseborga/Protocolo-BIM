import 'server-only'
import { dbLocaleToApp } from '@/i18n/routing'
import { escapeHtml, renderMarkdown } from '@/lib/markdown'
import type { ExportDocument } from './document'

/**
 * Print stylesheet for the PDF. Kept separate from the app's Tailwind build so
 * the exported document looks like a document, not like a web page.
 */
const PRINT_CSS = `
  @page { size: A4; margin: 22mm 18mm 20mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10.5pt; line-height: 1.5; color: #0f172a; margin: 0;
  }
  .cover { height: 235mm; display: flex; flex-direction: column; justify-content: center;
    page-break-after: always; }
  .cover .eyebrow { font-size: 9pt; letter-spacing: .18em; text-transform: uppercase; color: #64748b; }
  .cover h1 { font-size: 26pt; line-height: 1.15; margin: 12pt 0 4pt; }
  .cover h2 { font-size: 14pt; font-weight: 400; color: #334155; margin: 0 0 28pt; }
  .cover dl { display: grid; grid-template-columns: 34mm 1fr; gap: 5pt 10pt; font-size: 10pt;
    border-top: 1px solid #cbd5e1; padding-top: 12pt; }
  .cover dt { color: #64748b; }
  .cover dd { margin: 0; font-weight: 500; }
  .toc { page-break-after: always; }
  .toc h2, .section h2 { font-size: 13pt; margin: 0 0 10pt; }
  .toc ol { padding-left: 16pt; font-size: 10pt; }
  .toc li { margin-bottom: 3pt; }
  .section { page-break-inside: auto; margin-bottom: 16pt; }
  .section h2 { border-bottom: 1px solid #cbd5e1; padding-bottom: 4pt; page-break-after: avoid; }
  .section .num { color: #64748b; font-weight: 400; margin-right: 6pt; }
  .body h3 { font-size: 11pt; margin: 12pt 0 4pt; page-break-after: avoid; }
  .body p { margin: 0 0 7pt; }
  .body ul, .body ol { margin: 0 0 7pt; padding-left: 16pt; }
  .body li { margin-bottom: 2pt; }
  .body table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; font-size: 8.5pt; }
  .body th, .body td { border: .5pt solid #94a3b8; padding: 3pt 5pt; text-align: left;
    vertical-align: top; }
  .body th { background: #f1f5f9; font-weight: 600; }
  .body code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 9pt;
    background: #f1f5f9; padding: 1pt 3pt; border-radius: 2pt; }
  .body a { color: #1d4ed8; }
  .empty { color: #94a3b8; font-style: italic; }
  .fallback { color: #92400e; font-size: 8pt; }
`

export function renderExportHtml(document: ExportDocument): string {
  const formatter = new Intl.DateTimeFormat(dbLocaleToApp[document.locale], { dateStyle: 'long' })

  const cover = `
    <section class="cover">
      <p class="eyebrow">${escapeHtml(document.standard)}</p>
      <h1>${escapeHtml(document.labels.title)}</h1>
      <h2>${escapeHtml(document.projectName)}</h2>
      <dl>
        <dt>${escapeHtml(document.labels.project)}</dt>
        <dd>${escapeHtml(document.projectCode)} — ${escapeHtml(document.projectName)}</dd>
        ${
          document.clientName
            ? `<dt>${escapeHtml(document.labels.client)}</dt><dd>${escapeHtml(document.clientName)}</dd>`
            : ''
        }
        <dt>${escapeHtml(document.labels.standard)}</dt>
        <dd>${escapeHtml(document.standard)}</dd>
        <dt>${escapeHtml(document.labels.status)}</dt>
        <dd>${escapeHtml(document.labels.version)} · ${escapeHtml(document.statusLabel)}</dd>
        <dt>${escapeHtml(document.labels.date)}</dt>
        <dd>${escapeHtml(formatter.format(document.date))}</dd>
      </dl>
    </section>`

  const toc = `
    <section class="toc">
      <h2>${escapeHtml(document.labels.contents)}</h2>
      <ol>
        ${document.sections.map((section) => `<li>${escapeHtml(section.title)}</li>`).join('\n')}
      </ol>
    </section>`

  const body = document.sections
    .map(
      (section, index) => `
      <section class="section">
        <h2><span class="num">${index + 1}.</span>${escapeHtml(section.title)}</h2>
        <div class="body">
          ${
            section.body.trim()
              ? renderMarkdown(section.body)
              : '<p class="empty">—</p>'
          }
        </div>
      </section>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="${dbLocaleToApp[document.locale]}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(`${document.projectCode} — ${document.labels.title}`)}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
${cover}
${toc}
${body}
</body>
</html>`
}
