/**
 * Version diffing for protocol documents.
 *
 * Prose is stored as Markdown precisely so that comparing two versions is a
 * line diff rather than an HTML tree comparison.
 */

export type LineType = 'CONTEXT' | 'ADDED' | 'REMOVED'

export interface DiffLine {
  type: LineType
  text: string
}

export type SectionDiffStatus = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED'

export interface SectionSnapshot {
  key: string
  title: string
  body: string
  order: number
}

export interface SectionDiff {
  key: string
  title: string
  status: SectionDiffStatus
  titleChanged: boolean
  previousTitle?: string
  lines: DiffLine[]
  addedCount: number
  removedCount: number
}

export interface ProtocolDiff {
  sections: SectionDiff[]
  hasChanges: boolean
  addedSections: number
  removedSections: number
  modifiedSections: number
}

function toLines(body: string): string[] {
  const trimmed = (body ?? '').replace(/\r\n/gu, '\n').trimEnd()
  return trimmed === '' ? [] : trimmed.split('\n')
}

/**
 * Longest common subsequence table, then a walk back through it.
 * Sections are short enough that the quadratic table is not a concern.
 */
export function diffLines(before: string[], after: string[]): DiffLine[] {
  const rows = before.length
  const cols = after.length
  const table: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0))

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i]![j] =
        before[i] === after[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!)
    }
  }

  const lines: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      lines.push({ type: 'CONTEXT', text: before[i]! })
      i += 1
      j += 1
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      lines.push({ type: 'REMOVED', text: before[i]! })
      i += 1
    } else {
      lines.push({ type: 'ADDED', text: after[j]! })
      j += 1
    }
  }
  while (i < rows) {
    lines.push({ type: 'REMOVED', text: before[i]! })
    i += 1
  }
  while (j < cols) {
    lines.push({ type: 'ADDED', text: after[j]! })
    j += 1
  }
  return lines
}

/** Compare two versions of a protocol, section by section, in one locale. */
export function diffProtocols(
  before: SectionSnapshot[],
  after: SectionSnapshot[],
): ProtocolDiff {
  const beforeByKey = new Map(before.map((section) => [section.key, section]))
  const afterByKey = new Map(after.map((section) => [section.key, section]))

  const keys = [...new Set([...before, ...after].map((section) => section.key))].sort((a, b) => {
    const orderA = afterByKey.get(a)?.order ?? beforeByKey.get(a)?.order ?? 0
    const orderB = afterByKey.get(b)?.order ?? beforeByKey.get(b)?.order ?? 0
    return orderA - orderB || a.localeCompare(b)
  })

  const sections: SectionDiff[] = keys.map((key) => {
    const previous = beforeByKey.get(key)
    const current = afterByKey.get(key)

    if (!previous && current) {
      const lines = toLines(current.body).map<DiffLine>((text) => ({ type: 'ADDED', text }))
      return {
        key,
        title: current.title,
        status: 'ADDED',
        titleChanged: false,
        lines,
        addedCount: lines.length,
        removedCount: 0,
      }
    }

    if (previous && !current) {
      const lines = toLines(previous.body).map<DiffLine>((text) => ({ type: 'REMOVED', text }))
      return {
        key,
        title: previous.title,
        status: 'REMOVED',
        titleChanged: false,
        lines,
        addedCount: 0,
        removedCount: lines.length,
      }
    }

    const lines = diffLines(toLines(previous!.body), toLines(current!.body))
    const addedCount = lines.filter((line) => line.type === 'ADDED').length
    const removedCount = lines.filter((line) => line.type === 'REMOVED').length
    const titleChanged = previous!.title !== current!.title

    return {
      key,
      title: current!.title,
      status: addedCount + removedCount > 0 || titleChanged ? 'MODIFIED' : 'UNCHANGED',
      titleChanged,
      previousTitle: titleChanged ? previous!.title : undefined,
      lines,
      addedCount,
      removedCount,
    }
  })

  const changed = sections.filter((section) => section.status !== 'UNCHANGED')
  return {
    sections,
    hasChanges: changed.length > 0,
    addedSections: sections.filter((section) => section.status === 'ADDED').length,
    removedSections: sections.filter((section) => section.status === 'REMOVED').length,
    modifiedSections: sections.filter((section) => section.status === 'MODIFIED').length,
  }
}
