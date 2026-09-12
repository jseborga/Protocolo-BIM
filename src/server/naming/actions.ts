'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { redirect } from '@/i18n/navigation'
import type { AppLocale } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'
import { checkExamples } from './index'
import { loadConvention } from './repository'

export interface NamingActionState {
  /** Translation key under the `naming` namespace. */
  error?: string
  ok?: boolean
  detail?: string
}

function revalidate(locale: AppLocale, projectId: string, conventionId?: string) {
  revalidatePath(`/${locale}/p/${projectId}/naming`)
  if (conventionId) revalidatePath(`/${locale}/p/${projectId}/naming/${conventionId}`)
}

async function guard(projectId: string) {
  const access = await requireProjectAccess(projectId)
  return access.can('naming:edit') ? access : null
}

const conventionSchema = z.object({
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,24}$/u),
  target: z.enum([
    'FILE',
    'MODEL',
    'SHEET',
    'VIEW',
    'FOLDER',
    'FAMILY',
    'TYPE',
    'PARAMETER',
    'WORKSET',
    'LEVEL',
    'GRID',
  ]),
  separator: z.string().max(3),
  caseRule: z.enum(['ANY', 'UPPER', 'LOWER']),
  maxLength: z.number().int().min(1).max(500).nullable(),
  label: z.string().trim().min(1).max(120),
})

export async function createConventionAction(
  locale: AppLocale,
  projectId: string,
  _previous: NamingActionState,
  formData: FormData,
): Promise<NamingActionState> {
  const access = await guard(projectId)
  if (!access) return { error: 'compileError', detail: 'forbidden' }

  const maxLengthRaw = String(formData.get('maxLength') ?? '').trim()
  const parsed = conventionSchema.safeParse({
    key: String(formData.get('key') ?? ''),
    target: String(formData.get('target') ?? 'FILE'),
    separator: String(formData.get('separator') ?? '-'),
    caseRule: String(formData.get('caseRule') ?? 'UPPER'),
    maxLength: maxLengthRaw === '' ? null : Number(maxLengthRaw),
    label: String(formData.get('label') ?? ''),
  })
  if (!parsed.success) return { error: 'keyTaken' }

  const duplicate = await prisma.namingConvention.findUnique({
    where: { projectId_key: { projectId, key: parsed.data.key } },
  })
  if (duplicate) return { error: 'keyTaken' }

  const created = await prisma.namingConvention.create({
    data: {
      projectId,
      key: parsed.data.key,
      target: parsed.data.target,
      separator: parsed.data.separator,
      caseRule: parsed.data.caseRule,
      maxLength: parsed.data.maxLength,
      // A brand new convention starts inactive: it has no fields to check yet.
      isActive: false,
      labels: { es: parsed.data.label, en: parsed.data.label, pt: parsed.data.label },
    },
  })

  revalidate(locale, projectId)
  redirect({ href: `/p/${projectId}/naming/${created.id}`, locale })
  return { ok: true }
}

const fieldSchema = z.object({
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{1,16}$/u),
  label: z.string().trim().min(1).max(120),
  source: z.enum(['CODE_TABLE', 'FREE_TEXT', 'NUMERIC', 'DATE', 'REGEX']),
  codeTableId: z.string().nullable(),
  minLength: z.number().int().min(1).max(200).nullable(),
  maxLength: z.number().int().min(1).max(200).nullable(),
  pattern: z.string().max(300).nullable(),
  dateFormat: z.string().max(20).nullable(),
  required: z.boolean(),
  example: z.string().max(80).nullable(),
})

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim()
  return raw === '' ? null : Number(raw)
}

function optionalString(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? '').trim()
  return raw === '' ? null : raw
}

export async function addFieldAction(
  locale: AppLocale,
  projectId: string,
  conventionId: string,
  _previous: NamingActionState,
  formData: FormData,
): Promise<NamingActionState> {
  const access = await guard(projectId)
  if (!access) return { error: 'compileError', detail: 'forbidden' }

  const parsed = fieldSchema.safeParse({
    key: String(formData.get('key') ?? ''),
    label: String(formData.get('label') ?? ''),
    source: String(formData.get('source') ?? 'FREE_TEXT'),
    codeTableId: optionalString(formData.get('codeTableId')),
    minLength: optionalNumber(formData.get('minLength')),
    maxLength: optionalNumber(formData.get('maxLength')),
    pattern: optionalString(formData.get('pattern')),
    dateFormat: optionalString(formData.get('dateFormat')),
    required: formData.get('required') !== null,
    example: optionalString(formData.get('example')),
  })
  if (!parsed.success) return { error: 'compileError', detail: parsed.error.issues[0]?.message }

  const convention = await prisma.namingConvention.findFirst({
    where: { id: conventionId, projectId },
    include: { fields: true },
  })
  if (!convention) return { error: 'compileError', detail: 'not found' }

  if (convention.fields.some((field) => field.key === parsed.data.key)) {
    return { error: 'keyTaken' }
  }

  await prisma.namingField.create({
    data: {
      conventionId,
      order: convention.fields.length,
      key: parsed.data.key,
      labels: { es: parsed.data.label, en: parsed.data.label, pt: parsed.data.label },
      source: parsed.data.source,
      codeTableId: parsed.data.source === 'CODE_TABLE' ? parsed.data.codeTableId : null,
      minLength: parsed.data.minLength,
      maxLength: parsed.data.maxLength,
      pattern: parsed.data.source === 'REGEX' ? parsed.data.pattern : null,
      dateFormat: parsed.data.source === 'DATE' ? (parsed.data.dateFormat ?? 'YYYYMMDD') : null,
      required: parsed.data.required,
      example: parsed.data.example,
    },
  })

  revalidate(locale, projectId, conventionId)
  return { ok: true }
}

export async function deleteFieldAction(
  locale: AppLocale,
  projectId: string,
  conventionId: string,
  fieldId: string,
): Promise<void> {
  const access = await guard(projectId)
  if (!access) return

  await prisma.namingField.deleteMany({
    where: { id: fieldId, convention: { id: conventionId, projectId } },
  })

  // Keep the order contiguous so the mask reads correctly.
  const remaining = await prisma.namingField.findMany({
    where: { conventionId },
    orderBy: { order: 'asc' },
  })
  await prisma.$transaction(
    remaining.map((field, index) =>
      prisma.namingField.update({ where: { id: field.id }, data: { order: index } }),
    ),
  )

  revalidate(locale, projectId, conventionId)
}

export async function addExampleAction(
  locale: AppLocale,
  projectId: string,
  conventionId: string,
  _previous: NamingActionState,
  formData: FormData,
): Promise<NamingActionState> {
  const access = await guard(projectId)
  if (!access) return { error: 'compileError', detail: 'forbidden' }

  const sample = String(formData.get('sample') ?? '').trim()
  if (sample === '' || sample.length > 200) return { error: 'compileError' }

  await prisma.namingExample.create({
    data: {
      conventionId,
      sample,
      shouldBeValid: String(formData.get('shouldBeValid') ?? 'true') === 'true',
    },
  })

  revalidate(locale, projectId, conventionId)
  return { ok: true }
}

export async function deleteExampleAction(
  locale: AppLocale,
  projectId: string,
  conventionId: string,
  exampleId: string,
): Promise<void> {
  const access = await guard(projectId)
  if (!access) return

  await prisma.namingExample.deleteMany({
    where: { id: exampleId, convention: { id: conventionId, projectId } },
  })
  revalidate(locale, projectId, conventionId)
}

/**
 * Activate or deactivate a convention.
 *
 * Activation is refused when the convention cannot compile, or when any of its
 * test cases disagrees with the compiled rule. That is the whole point of
 * keeping the examples: a convention can never drift away from what the team
 * agreed it should accept and reject.
 */
export async function toggleConventionAction(
  locale: AppLocale,
  projectId: string,
  conventionId: string,
): Promise<NamingActionState> {
  const access = await guard(projectId)
  if (!access) return { error: 'compileError', detail: 'forbidden' }

  const loaded = await loadConvention(projectId, conventionId)
  if (!loaded) return { error: 'compileError', detail: 'not found' }

  if (loaded.record.isActive) {
    await prisma.namingConvention.update({
      where: { id: conventionId },
      data: { isActive: false },
    })
    revalidate(locale, projectId, conventionId)
    return { ok: true }
  }

  if (!loaded.compiled) {
    return { error: 'compileError', detail: loaded.compileError ?? '' }
  }

  const { passed, checks } = checkExamples(loaded.compiled, loaded.record.examples)
  if (!passed) {
    const failing = checks.filter((check) => !check.passed).length
    return { error: 'examplesFailed', detail: String(failing) }
  }

  await prisma.namingConvention.update({
    where: { id: conventionId },
    data: { isActive: true, version: { increment: 1 } },
  })

  revalidate(locale, projectId, conventionId)
  return { ok: true }
}

const codeTableSchema = z.object({
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,24}$/u),
  label: z.string().trim().min(1).max(120),
})

export async function createCodeTableAction(
  locale: AppLocale,
  projectId: string,
  _previous: NamingActionState,
  formData: FormData,
): Promise<NamingActionState> {
  const access = await guard(projectId)
  if (!access) return { error: 'compileError', detail: 'forbidden' }

  const parsed = codeTableSchema.safeParse({
    key: String(formData.get('key') ?? ''),
    label: String(formData.get('label') ?? ''),
  })
  if (!parsed.success) return { error: 'keyTaken' }

  const duplicate = await prisma.codeTable.findUnique({
    where: { projectId_key: { projectId, key: parsed.data.key } },
  })
  if (duplicate) return { error: 'keyTaken' }

  await prisma.codeTable.create({
    data: {
      projectId,
      key: parsed.data.key,
      labels: { es: parsed.data.label, en: parsed.data.label, pt: parsed.data.label },
    },
  })

  revalidate(locale, projectId)
  return { ok: true }
}

export async function addCodeValueAction(
  locale: AppLocale,
  projectId: string,
  _previous: NamingActionState,
  formData: FormData,
): Promise<NamingActionState> {
  const access = await guard(projectId)
  if (!access) return { error: 'compileError', detail: 'forbidden' }

  const tableId = String(formData.get('tableId') ?? '')
  const code = String(formData.get('code') ?? '').trim()
  const label = String(formData.get('label') ?? '').trim()
  if (!tableId || code === '' || code.length > 40) return { error: 'compileError' }

  const table = await prisma.codeTable.findFirst({
    where: { id: tableId, projectId },
    include: { _count: { select: { values: true } } },
  })
  if (!table) return { error: 'compileError' }

  const duplicate = await prisma.codeValue.findUnique({
    where: { tableId_code: { tableId, code } },
  })
  if (duplicate) return { error: 'keyTaken' }

  await prisma.codeValue.create({
    data: {
      tableId,
      code,
      order: table._count.values,
      labels: { es: label || code, en: label || code, pt: label || code },
    },
  })

  revalidate(locale, projectId)
  return { ok: true }
}

export async function deleteCodeValueAction(
  locale: AppLocale,
  projectId: string,
  valueId: string,
): Promise<void> {
  const access = await guard(projectId)
  if (!access) return

  await prisma.codeValue.deleteMany({
    where: { id: valueId, table: { projectId } },
  })
  revalidate(locale, projectId)
}
