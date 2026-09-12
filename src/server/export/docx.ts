import 'server-only'
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { Marked, type Token, type Tokens } from 'marked'
import { dbLocaleToApp } from '@/i18n/routing'
import type { ExportDocument } from './document'

const lexer = new Marked({ gfm: true, breaks: true })

/**
 * Convert the inline part of a Markdown token into styled runs.
 *
 * Only the inline features protocol prose actually uses are mapped; anything
 * else degrades to plain text rather than being dropped.
 */
function inlineRuns(
  tokens: Token[] | undefined,
  style: { bold?: boolean; italics?: boolean } = {},
): Array<TextRun | ExternalHyperlink> {
  if (!tokens) return []

  return tokens.flatMap((token): Array<TextRun | ExternalHyperlink> => {
    switch (token.type) {
      case 'strong':
        return inlineRuns((token as Tokens.Strong).tokens, { ...style, bold: true })
      case 'em':
        return inlineRuns((token as Tokens.Em).tokens, { ...style, italics: true })
      case 'codespan':
        return [new TextRun({ text: (token as Tokens.Codespan).text, font: 'Consolas', ...style })]
      case 'br':
        return [new TextRun({ break: 1 })]
      case 'link': {
        const link = token as Tokens.Link
        const runs = inlineRuns(link.tokens, { ...style })
        return /^https?:/iu.test(link.href)
          ? [new ExternalHyperlink({ children: runs as TextRun[], link: link.href })]
          : runs
      }
      case 'text':
      case 'escape':
        return [new TextRun({ text: (token as Tokens.Text).text, ...style })]
      default:
        return 'raw' in token && typeof token.raw === 'string'
          ? [new TextRun({ text: token.raw, ...style })]
          : []
    }
  })
}

function listParagraphs(token: Tokens.List): Paragraph[] {
  return token.items.map(
    (item) =>
      new Paragraph({
        children: inlineRuns(item.tokens?.flatMap((child) =>
          child.type === 'text' ? ((child as Tokens.Text).tokens ?? [child]) : [child],
        )),
        bullet: token.ordered ? undefined : { level: 0 },
        numbering: token.ordered ? { reference: 'protocol-ordered', level: 0 } : undefined,
        spacing: { after: 40 },
      }),
  )
}

function tableFrom(token: Tokens.Table): Table {
  const header = new TableRow({
    tableHeader: true,
    children: token.header.map(
      (cell) =>
        new TableCell({
          shading: { fill: 'F1F5F9' },
          children: [new Paragraph({ children: inlineRuns(cell.tokens, { bold: true }) })],
        }),
    ),
  })

  const rows = token.rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({ children: [new Paragraph({ children: inlineRuns(cell.tokens) })] }),
        ),
      }),
  )

  return new Table({ rows: [header, ...rows], width: { size: 100, type: WidthType.PERCENTAGE } })
}

function markdownToDocx(source: string): Array<Paragraph | Table> {
  if (!source.trim()) return []

  return lexer.lexer(source).flatMap((token): Array<Paragraph | Table> => {
    switch (token.type) {
      case 'heading': {
        const heading = token as Tokens.Heading
        return [
          new Paragraph({
            children: inlineRuns(heading.tokens),
            heading: heading.depth <= 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4,
            spacing: { before: 160, after: 60 },
          }),
        ]
      }
      case 'paragraph':
        return [
          new Paragraph({
            children: inlineRuns((token as Tokens.Paragraph).tokens),
            spacing: { after: 100 },
          }),
        ]
      case 'list':
        return listParagraphs(token as Tokens.List)
      case 'table':
        return [tableFrom(token as Tokens.Table), new Paragraph({ text: '', spacing: { after: 80 } })]
      case 'code':
        return [
          new Paragraph({
            children: [new TextRun({ text: (token as Tokens.Code).text, font: 'Consolas', size: 18 })],
            spacing: { after: 100 },
          }),
        ]
      case 'blockquote':
        return [
          new Paragraph({
            children: inlineRuns((token as Tokens.Blockquote).tokens),
            indent: { left: 400 },
            spacing: { after: 100 },
          }),
        ]
      case 'space':
      case 'hr':
        return []
      default:
        return 'raw' in token && typeof token.raw === 'string' && token.raw.trim()
          ? [new Paragraph({ text: token.raw.trim(), spacing: { after: 100 } })]
          : []
    }
  })
}

/** Render the protocol as a Word document, from the same model the PDF uses. */
export async function renderDocx(document: ExportDocument): Promise<Buffer> {
  const formatter = new Intl.DateTimeFormat(dbLocaleToApp[document.locale], { dateStyle: 'long' })

  const cover: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: document.standard.toUpperCase(), color: '64748B', size: 18 })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: document.labels.title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: document.projectName, size: 28, color: '334155' })],
      spacing: { after: 400 },
    }),
  ]

  const metadata: Array<[string, string]> = [
    [document.labels.project, `${document.projectCode} — ${document.projectName}`],
    ...(document.clientName ? ([[document.labels.client, document.clientName]] as Array<[string, string]>) : []),
    [document.labels.standard, document.standard],
    [document.labels.status, `${document.labels.version} · ${document.statusLabel}`],
    [document.labels.date, formatter.format(document.date)],
  ]

  const metadataTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: metadata.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({ children: [new TextRun({ text: label, color: '64748B' })] }),
              ],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: value, bold: true })] })],
            }),
          ],
        }),
    ),
  })

  const body = document.sections.flatMap((section, index) => [
    new Paragraph({
      text: `${index + 1}. ${section.title}`,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 120 },
    }),
    ...(section.body.trim()
      ? markdownToDocx(section.body)
      : [
          new Paragraph({
            children: [new TextRun({ text: '—', color: '94A3B8', italics: true })],
          }),
        ]),
  ])

  const file = new Document({
    creator: document.organisation,
    title: `${document.projectCode} — ${document.labels.title}`,
    description: document.projectName,
    numbering: {
      config: [
        {
          reference: 'protocol-ordered',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 720, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [{ children: [...cover, metadataTable, ...body] }],
  })

  return Packer.toBuffer(file)
}
