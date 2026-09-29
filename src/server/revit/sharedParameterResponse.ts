import 'server-only'
import { NextResponse } from 'next/server'
import { encodeSharedParameterFile, renderSharedParameterText } from './sharedParameterFile'
import type { StandardDocument } from './standard'

/** The shared parameter file for a project, as a download. */
export function sharedParameterResponse(document: StandardDocument): NextResponse {
  const text = renderSharedParameterText(
    document.sharedParameters.parameters.map((parameter) => ({
      guid: parameter.guid,
      name: parameter.name,
      group: parameter.group,
      dataType: parameter.dataType,
      description: parameter.description,
    })),
  )

  const filename = `${document.project.code}-parametros-compartidos-v${document.ruleSet.version}.txt`
  return new NextResponse(new Uint8Array(encodeSharedParameterFile(text)), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-16le',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
