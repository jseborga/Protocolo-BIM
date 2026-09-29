import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { AuditEvaluation } from './audit'

/** Past this many, findings are counted in the summary but not stored one by one. */
export const MAX_STORED_FINDINGS = 10_000

export interface RecordAuditInput {
  projectId: string
  apiTokenId: string | null
  createdById: string | null
  modelName: string
  ruleSetVersion: number
  evaluation: AuditEvaluation
  metadata: Record<string, unknown>
}

export async function recordAudit(input: RecordAuditInput) {
  const { summary, findings } = input.evaluation
  const stored = findings.slice(0, MAX_STORED_FINDINGS)
  const truncated = findings.length > stored.length

  return prisma.$transaction(async (tx) => {
    const run = await tx.auditRun.create({
      data: {
        projectId: input.projectId,
        source: 'REVIT_ADDIN',
        modelName: input.modelName,
        ruleSetVersion: input.ruleSetVersion,
        apiTokenId: input.apiTokenId,
        createdById: input.createdById,
        finishedAt: new Date(),
        totalChecked: summary.checked,
        errorCount: summary.errors,
        warningCount: summary.warnings,
        infoCount: summary.infos,
        metadata: {
          ...input.metadata,
          summary,
          findingsTotal: findings.length,
          findingsStored: stored.length,
          truncated,
        } as unknown as Prisma.InputJsonValue,
      },
    })

    if (stored.length > 0) {
      await tx.auditFinding.createMany({
        data: stored.map((finding) => ({
          runId: run.id,
          severity: finding.severity,
          ruleKey: finding.ruleKey,
          target: finding.target,
          code: finding.code,
          params: finding.params as unknown as Prisma.InputJsonValue,
          elementId: finding.elementId ?? null,
          elementName: finding.elementName?.slice(0, 512) ?? null,
          category: finding.category ?? null,
        })),
      })
    }

    return { run, truncated }
  })
}
