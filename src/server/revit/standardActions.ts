'use server'

import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { AppLocale } from '@/i18n/locales'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'
import { loadProjectConventions } from '@/server/naming/repository'
import { SHARED_PARAMETER_SEEDS } from '@/server/protocol/baseline'
import { judgeName } from './audit'
import { REVIT_CATEGORY_IDS, REVIT_DATA_TYPE_IDS, REVIT_PALETTE_GROUP_IDS } from './catalog'
import { createFindingRenderer } from './messages'

export interface StandardFormState {
  /** Translation key under the `parameters` namespace. */
  error?: string
  /** Naming error details for the offending name, already in the reader's language. */
  details?: string[]
  ok?: boolean
  /** What was submitted, to put back in the form when it is rejected. */
  values?: Record<string, string | string[]>
  /** Changes on every answer, so the form remounts with `values`. */
  submission?: number
}

/** Echo a rejected submission back, so nobody has to type it all again. */
function rejected(formData: FormData, state: Omit<StandardFormState, 'values' | 'submission'>): StandardFormState {
  const values: Record<string, string | string[]> = {}
  for (const key of new Set(formData.keys())) {
    if (key.startsWith('$')) continue // React's own action fields
    const all = formData.getAll(key).map(String)
    values[key] = key === 'categories' ? all : (all[0] ?? '')
  }
  return { ...state, values, submission: Date.now() }
}

function revalidate(locale: AppLocale, projectId: string) {
  revalidatePath(`/${locale}/p/${projectId}/parameters`)
}

async function guard(projectId: string) {
  const access = await requireProjectAccess(projectId)
  return access.can('naming:edit') ? access : null
}

/**
 * Names in the standard have to follow the project's own conventions: a
 * parameter library that breaks the PARAMETER convention would make every
 * model fail its audit on day one.
 */
async function checkName(
  locale: AppLocale,
  projectId: string,
  target: 'PARAMETER' | 'WORKSET',
  name: string,
): Promise<string[] | null> {
  const conventions = (await loadProjectConventions(projectId))
    .filter((entry) => entry.record.isActive && entry.compiled && entry.record.target === target)
    .map((entry) => entry.compiled!)
  if (conventions.length === 0) return null

  const verdict = judgeName(conventions, name)
  if (verdict.valid) return null

  const render = await createFindingRenderer(locale, conventions)
  return render({
    severity: 'ERROR',
    target,
    code: 'NAMING',
    ruleKey: `naming.${verdict.convention.key}`,
    params: {
      conventionKey: verdict.convention.key,
      mask: verdict.convention.mask,
      errors: verdict.errors,
    },
  }).details
}

const parameterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  group: z.string().trim().min(1).max(80),
  dataType: z.string().refine((value) => REVIT_DATA_TYPE_IDS.has(value)),
  paletteGroup: z.string().refine((value) => REVIT_PALETTE_GROUP_IDS.has(value)),
  isInstance: z.boolean(),
  required: z.boolean(),
  categories: z
    .array(z.string().refine((value) => REVIT_CATEGORY_IDS.has(value)))
    .min(1)
    .max(REVIT_CATEGORY_IDS.size),
  description: z.string().trim().max(500),
  ifcPset: z.string().trim().max(80),
  ifcProperty: z.string().trim().max(80),
})

function parseParameter(formData: FormData) {
  return parameterSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    group: String(formData.get('group') ?? ''),
    dataType: String(formData.get('dataType') ?? 'TEXT'),
    paletteGroup: String(formData.get('paletteGroup') ?? 'IDENTITY_DATA'),
    isInstance: formData.get('binding') !== 'TYPE',
    required: formData.get('required') !== null,
    categories: formData.getAll('categories').map(String),
    description: String(formData.get('description') ?? ''),
    ifcPset: String(formData.get('ifcPset') ?? ''),
    ifcProperty: String(formData.get('ifcProperty') ?? ''),
  })
}

type ParameterInput = z.infer<typeof parameterSchema>

function parseError(error: z.ZodError): string {
  return error.issues[0]?.path[0] === 'categories' ? 'noCategories' : 'invalid'
}

async function groupFor(projectId: string, name: string) {
  return (
    (await prisma.parameterGroupDef.findUnique({ where: { projectId_name: { projectId, name } } })) ??
    (await prisma.parameterGroupDef.create({
      data: { projectId, name, order: await prisma.parameterGroupDef.count({ where: { projectId } }) },
    }))
  )
}

/** The columns a form sets; the GUID is never among them. */
function parameterColumns(data: ParameterInput, groupId: string) {
  return {
    groupId,
    dataType: data.dataType,
    paletteGroup: data.paletteGroup,
    isInstance: data.isInstance,
    required: data.required,
    categories: data.categories,
    // Text entered in one language is stored for all three until translated.
    description: data.description
      ? ({ es: data.description, en: data.description, pt: data.description } as Prisma.InputJsonValue)
      : undefined,
    ifcPset: data.ifcPset || null,
    ifcProperty: data.ifcProperty || null,
  }
}

export async function addSharedParameterAction(
  locale: AppLocale,
  projectId: string,
  _previous: StandardFormState,
  formData: FormData,
): Promise<StandardFormState> {
  const access = await guard(projectId)
  if (!access) return rejected(formData, { error: 'notAllowed' })

  const parsed = parseParameter(formData)
  if (!parsed.success) return rejected(formData, { error: parseError(parsed.error) })

  const data = parsed.data
  const existing = await prisma.sharedParameterDef.findUnique({
    where: { projectId_name: { projectId, name: data.name } },
  })
  if (existing) return rejected(formData, { error: 'duplicate' })

  const naming = await checkName(locale, projectId, 'PARAMETER', data.name)
  if (naming) return rejected(formData, { error: 'invalidName', details: naming })

  const group = await groupFor(projectId, data.group)
  await prisma.sharedParameterDef.create({
    data: {
      projectId,
      name: data.name,
      // A baseline parameter keeps its fixed GUID even if it was deleted and
      // added again: models that already carry it must still match.
      guid: SHARED_PARAMETER_SEEDS.find((seed) => seed.name === data.name)?.guid ?? crypto.randomUUID(),
      ...parameterColumns(data, group.id),
    },
  })

  revalidate(locale, projectId)
  return { ok: true, submission: Date.now() }
}

/**
 * Change a parameter in place. The name and the GUID stay: they are what
 * models already carry, and changing either would orphan the values stored
 * under the old one. A different name is a different parameter.
 */
export async function updateSharedParameterAction(
  locale: AppLocale,
  projectId: string,
  parameterId: string,
  _previous: StandardFormState,
  formData: FormData,
): Promise<StandardFormState> {
  const access = await guard(projectId)
  if (!access) return rejected(formData, { error: 'notAllowed' })

  const current = await prisma.sharedParameterDef.findFirst({ where: { id: parameterId, projectId } })
  if (!current) return rejected(formData, { error: 'invalid' })

  formData.set('name', current.name)
  const parsed = parseParameter(formData)
  if (!parsed.success) return rejected(formData, { error: parseError(parsed.error) })

  // The description changes in the language being edited only; the others
  // keep their translations.
  const descriptions = { ...((current.description ?? {}) as Record<string, string>) }
  if (parsed.data.description) descriptions[locale] = parsed.data.description
  else delete descriptions[locale]

  const group = await groupFor(projectId, parsed.data.group)
  await prisma.sharedParameterDef.update({
    where: { id: current.id },
    data: {
      ...parameterColumns(parsed.data, group.id),
      description: Object.keys(descriptions).length > 0 ? descriptions : Prisma.DbNull,
    },
  })

  revalidate(locale, projectId)
  return { ok: true, submission: Date.now() }
}

export async function deleteSharedParameterAction(
  locale: AppLocale,
  projectId: string,
  parameterId: string,
): Promise<void> {
  const access = await guard(projectId)
  if (!access) return
  await prisma.sharedParameterDef.deleteMany({ where: { id: parameterId, projectId } })
  revalidate(locale, projectId)
}

const worksetSchema = z.object({
  name: z.string().trim().min(2).max(120),
  disciplineId: z.string().nullable(),
  description: z.string().trim().max(300),
})

export async function addWorksetAction(
  locale: AppLocale,
  projectId: string,
  _previous: StandardFormState,
  formData: FormData,
): Promise<StandardFormState> {
  const access = await guard(projectId)
  if (!access) return rejected(formData, { error: 'notAllowed' })

  const parsed = worksetSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    disciplineId: String(formData.get('disciplineId') ?? '') || null,
    description: String(formData.get('description') ?? ''),
  })
  if (!parsed.success) return rejected(formData, { error: 'invalid' })

  const existing = await prisma.worksetDef.findUnique({
    where: { projectId_name: { projectId, name: parsed.data.name } },
  })
  if (existing) return rejected(formData, { error: 'duplicate' })

  const naming = await checkName(locale, projectId, 'WORKSET', parsed.data.name)
  if (naming) return rejected(formData, { error: 'invalidName', details: naming })

  await prisma.worksetDef.create({
    data: {
      projectId,
      name: parsed.data.name,
      disciplineId: parsed.data.disciplineId,
      description: parsed.data.description || null,
      order: await prisma.worksetDef.count({ where: { projectId } }),
    },
  })

  revalidate(locale, projectId)
  return { ok: true, submission: Date.now() }
}

export async function deleteWorksetAction(
  locale: AppLocale,
  projectId: string,
  worksetId: string,
): Promise<void> {
  const access = await guard(projectId)
  if (!access) return
  await prisma.worksetDef.deleteMany({ where: { id: worksetId, projectId } })
  revalidate(locale, projectId)
}
