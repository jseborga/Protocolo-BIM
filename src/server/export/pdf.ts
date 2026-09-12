import 'server-only'
import { chromium } from 'playwright'
import type { ExportDocument } from './document'
import { renderExportHtml } from './html'

/**
 * Render the protocol to PDF with headless Chromium.
 *
 * The browser only ever loads a string of HTML we generated ourselves — it
 * never navigates to a URL — so no credentials or network access are involved.
 */
export async function renderPdf(document: ExportDocument): Promise<Buffer> {
  const browser = await chromium.launch({
    // Set CHROMIUM_EXECUTABLE_PATH when the host already ships a Chromium
    // (containers, CI images) instead of the one Playwright downloads.
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(renderExportHtml(document), { waitUntil: 'load' })
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#64748b;padding:0 18mm;
          display:flex;justify-content:space-between;">
          <span>${escapeForTemplate(`${document.projectCode} · ${document.labels.title} · ${document.labels.version}`)}</span>
          <span class="pageNumber"></span>/<span class="totalPages"></span>
        </div>`,
      margin: { top: '22mm', bottom: '20mm', left: '0', right: '0' },
    })
  } finally {
    await browser.close()
  }
}

function escapeForTemplate(value: string): string {
  return value.replace(/[&<>"]/gu, (char) =>
    char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : '&quot;',
  )
}
