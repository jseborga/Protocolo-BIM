/**
 * Revit shared parameter file, written the way Revit itself writes it.
 *
 * Format established from files Revit produced and from Autodesk's own
 * generators: UTF-16 LE with a byte order mark, CRLF line endings, tab
 * separated, a META 2/1 block, integer group ids, and the ten PARAM columns
 * ending in HIDEWHENNOVALUE. The BOM matters: without it Revit assumes ANSI and
 * mangles accented names such as "Identificación".
 *
 * The add-in does not rely on this file — it has Revit create the definitions
 * through the API — but a team configuring Revit by hand can load it directly.
 */

import { REVIT_DATA_TYPES } from './catalog'

export interface FileParameter {
  guid: string
  name: string
  group: string
  dataType: string
  description: string
  visible?: boolean
  userModifiable?: boolean
  hideWhenNoValue?: boolean
}

/** Revit's tooltip limit. */
const MAX_DESCRIPTION = 250

/** Tabs and line breaks would split a field; Revit escapes breaks the same way. */
function field(value: string): string {
  return value.replace(/\t/gu, ' ').replace(/\r\n|\r|\n/gu, '&#xD&#xA').trim()
}

function fileTypeFor(dataType: string): string {
  return REVIT_DATA_TYPES.find((type) => type.id === dataType)?.fileType ?? 'TEXT'
}

export function renderSharedParameterText(parameters: FileParameter[]): string {
  const groups = [...new Set(parameters.map((parameter) => parameter.group))].sort((a, b) =>
    a.localeCompare(b),
  )
  const groupId = new Map(groups.map((name, index) => [name, index + 1]))

  const lines = [
    '# This is a Revit shared parameter file.',
    '# Do not edit manually.',
    '*META\tVERSION\tMINVERSION',
    'META\t2\t1',
    '*GROUP\tID\tNAME',
    ...groups.map((name) => `GROUP\t${groupId.get(name)}\t${field(name)}`),
    '*PARAM\tGUID\tNAME\tDATATYPE\tDATACATEGORY\tGROUP\tVISIBLE\tDESCRIPTION\tUSERMODIFIABLE\tHIDEWHENNOVALUE',
    ...[...parameters]
      .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
      .map((parameter) =>
        [
          'PARAM',
          parameter.guid.toLowerCase(),
          field(parameter.name),
          fileTypeFor(parameter.dataType),
          '',
          String(groupId.get(parameter.group)),
          parameter.visible === false ? '0' : '1',
          field(parameter.description).slice(0, MAX_DESCRIPTION),
          parameter.userModifiable === false ? '0' : '1',
          parameter.hideWhenNoValue ? '1' : '0',
        ].join('\t'),
      ),
  ]

  return `${lines.join('\r\n')}\r\n`
}

/** UTF-16 LE bytes with the FF FE byte order mark Revit writes. */
export function encodeSharedParameterFile(text: string): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')])
}
