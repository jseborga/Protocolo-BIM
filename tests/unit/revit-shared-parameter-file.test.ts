import { describe, expect, it } from 'vitest'
import {
  encodeSharedParameterFile,
  renderSharedParameterText,
} from '@/server/revit/sharedParameterFile'

const parameters = [
  {
    guid: 'FC784E56-AF94-41FE-8358-65EF033A949B',
    name: 'GEN_CodigoClasificacion',
    group: 'Identificación',
    dataType: 'TEXT',
    description: 'Código de clasificación',
  },
  {
    guid: 'f025fad4-3929-4c6f-96eb-79b73073c4ee',
    name: 'GEN_EstadoCDE',
    group: 'Gestión de la información',
    dataType: 'YESNO',
    description: 'Línea uno\nLínea\tdos',
  },
  {
    guid: '9e53249a-c708-46d2-99fd-ad058dd4bbf0',
    name: 'GEN_Notas',
    group: 'Identificación',
    dataType: 'MULTILINE_TEXT',
    description: '',
  },
]

describe('shared parameter file', () => {
  const text = renderSharedParameterText(parameters)
  const lines = text.split('\r\n')

  it('starts with the header Revit writes', () => {
    expect(lines.slice(0, 5)).toEqual([
      '# This is a Revit shared parameter file.',
      '# Do not edit manually.',
      '*META\tVERSION\tMINVERSION',
      'META\t2\t1',
      '*GROUP\tID\tNAME',
    ])
  })

  it('numbers groups from 1 and references them from each parameter', () => {
    expect(lines).toContain('GROUP\t1\tGestión de la información')
    expect(lines).toContain('GROUP\t2\tIdentificación')
    const estado = lines.find((line) => line.includes('GEN_EstadoCDE'))!.split('\t')
    expect(estado[5]).toBe('1')
  })

  it('writes the ten PARAM columns, ending in HIDEWHENNOVALUE', () => {
    const header = lines.find((line) => line.startsWith('*PARAM'))!.split('\t')
    expect(header).toEqual([
      '*PARAM', 'GUID', 'NAME', 'DATATYPE', 'DATACATEGORY', 'GROUP',
      'VISIBLE', 'DESCRIPTION', 'USERMODIFIABLE', 'HIDEWHENNOVALUE',
    ])
    for (const line of lines.filter((entry) => entry.startsWith('PARAM\t'))) {
      expect(line.split('\t')).toHaveLength(10)
    }
  })

  it('uses the legacy DATATYPE names, not ForgeTypeId strings', () => {
    const types = lines.filter((line) => line.startsWith('PARAM\t')).map((line) => line.split('\t')[3])
    expect(types.sort()).toEqual(['MULTILINETEXT', 'TEXT', 'YESNO'])
    expect(text).not.toContain('autodesk.spec')
  })

  it('lower-cases GUIDs as Revit does', () => {
    expect(text).toContain('fc784e56-af94-41fe-8358-65ef033a949b')
    expect(text).not.toContain('FC784E56')
  })

  it('keeps tabs and line breaks inside a description from splitting the row', () => {
    const estado = lines.find((line) => line.includes('GEN_EstadoCDE'))!.split('\t')
    expect(estado).toHaveLength(10)
    expect(estado[7]).toBe('Línea uno&#xD&#xALínea dos')
  })

  it('ends every line, including the last, with CRLF', () => {
    expect(text.endsWith('\r\n')).toBe(true)
    expect(text.replace(/\r\n/gu, '')).not.toMatch(/[\r\n]/u)
  })

  it('encodes as UTF-16 LE with a byte order mark, so accents survive', () => {
    const bytes = encodeSharedParameterFile(text)
    expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xfe])
    expect(bytes.subarray(2).toString('utf16le')).toBe(text)
    expect(bytes.subarray(2).toString('utf16le')).toContain('Identificación')
  })
})
