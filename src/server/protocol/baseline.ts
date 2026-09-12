import type { LocalizedText } from '@/server/naming/types'

/**
 * Baseline content every new project starts from: the discipline catalogue,
 * the ISO 19650-2 code tables, seven naming conventions covering the whole
 * modelling surface, and the default RACI activities.
 */

export interface CodeTableSeed {
  key: string
  labels: LocalizedText
  values: Array<{ code: string; labels: LocalizedText }>
}

const t = (es: string, en: string, pt: string): LocalizedText => ({ es, en, pt })

export const DISCIPLINE_SEED = [
  { code: 'ARC', order: 1, color: '#d97706', labels: t('Arquitectura', 'Architecture', 'Arquitetura') },
  { code: 'STR', order: 2, color: '#0f766e', labels: t('Estructuras', 'Structures', 'Estruturas') },
  { code: 'MEP', order: 3, color: '#2563eb', labels: t('Instalaciones (MEP)', 'Building services (MEP)', 'Instalações (MEP)') },
  { code: 'HVA', order: 4, color: '#0891b2', labels: t('Climatización', 'HVAC', 'Climatização') },
  { code: 'ELE', order: 5, color: '#ca8a04', labels: t('Electricidad', 'Electrical', 'Eletricidade') },
  { code: 'PLU', order: 6, color: '#0284c7', labels: t('Fontanería y saneamiento', 'Plumbing and drainage', 'Canalizações e drenagem') },
  { code: 'CIV', order: 7, color: '#65a30d', labels: t('Obra civil', 'Civil works', 'Obra civil') },
  { code: 'LAN', order: 8, color: '#16a34a', labels: t('Paisajismo', 'Landscape', 'Paisagismo') },
  { code: 'INF', order: 9, color: '#7c3aed', labels: t('Infraestructura', 'Infrastructure', 'Infraestrutura') },
  { code: 'SUR', order: 10, color: '#64748b', labels: t('Topografía', 'Surveying', 'Topografia') },
  { code: 'FIR', order: 11, color: '#dc2626', labels: t('Protección contra incendios', 'Fire protection', 'Proteção contra incêndios') },
  { code: 'GEN', order: 12, color: '#475569', labels: t('General / coordinación', 'General / coordination', 'Geral / coordenação') },
]

export const CODE_TABLE_SEEDS: CodeTableSeed[] = [
  {
    key: 'ORIGINATOR',
    labels: t('Originador', 'Originator', 'Originador'),
    values: [],
  },
  {
    key: 'VOLUME',
    labels: t('Volumen o sistema', 'Volume or system', 'Volume ou sistema'),
    values: [
      { code: 'ZZ', labels: t('Todo el proyecto', 'Whole project', 'Todo o projeto') },
      { code: '01', labels: t('Volumen 01', 'Volume 01', 'Volume 01') },
      { code: '02', labels: t('Volumen 02', 'Volume 02', 'Volume 02') },
    ],
  },
  {
    key: 'LEVEL',
    labels: t('Nivel o localización', 'Level or location', 'Nível ou localização'),
    values: [
      { code: 'XX', labels: t('Todos los niveles', 'All levels', 'Todos os níveis') },
      { code: 'ZZ', labels: t('Varios niveles', 'Multiple levels', 'Vários níveis') },
      { code: 'B1', labels: t('Sótano 1', 'Basement 1', 'Cave 1') },
      { code: '00', labels: t('Planta baja', 'Ground floor', 'Piso térreo') },
      { code: '01', labels: t('Planta 1', 'Level 1', 'Piso 1') },
      { code: '02', labels: t('Planta 2', 'Level 2', 'Piso 2') },
    ],
  },
  {
    key: 'TYPE',
    labels: t('Tipo de contenedor', 'Container type', 'Tipo de contentor'),
    values: [
      { code: 'M3', labels: t('Modelo 3D', '3D model', 'Modelo 3D') },
      { code: 'M2', labels: t('Modelo 2D', '2D model', 'Modelo 2D') },
      { code: 'DR', labels: t('Plano', 'Drawing', 'Desenho') },
      { code: 'SH', labels: t('Tabla de planificación', 'Schedule', 'Tabela') },
      { code: 'SP', labels: t('Especificación', 'Specification', 'Especificação') },
      { code: 'RP', labels: t('Informe', 'Report', 'Relatório') },
      { code: 'CM', labels: t('Modelo federado', 'Federated model', 'Modelo federado') },
    ],
  },
  {
    key: 'ROLE',
    labels: t('Rol del originador', 'Originator role', 'Função do originador'),
    values: [
      { code: 'A', labels: t('Arquitectura', 'Architecture', 'Arquitetura') },
      { code: 'S', labels: t('Estructuras', 'Structures', 'Estruturas') },
      { code: 'M', labels: t('Mecánica', 'Mechanical', 'Mecânica') },
      { code: 'E', labels: t('Electricidad', 'Electrical', 'Eletricidade') },
      { code: 'P', labels: t('Salubridad', 'Public health', 'Salubridade') },
      { code: 'C', labels: t('Obra civil', 'Civil', 'Obra civil') },
      { code: 'L', labels: t('Paisajismo', 'Landscape', 'Paisagismo') },
      { code: 'Z', labels: t('General', 'General', 'Geral') },
    ],
  },
  {
    key: 'DISCIPLINE',
    labels: t('Disciplina', 'Discipline', 'Disciplina'),
    values: DISCIPLINE_SEED.map((discipline) => ({
      code: discipline.code,
      labels: discipline.labels,
    })),
  },
  {
    key: 'STATUS',
    labels: t('Código de estado (CDE)', 'Status code (CDE)', 'Código de estado (CDE)'),
    values: [
      { code: 'S0', labels: t('Trabajo en curso', 'Work in progress', 'Trabalho em curso') },
      { code: 'S1', labels: t('Compartido para coordinación', 'Shared for coordination', 'Partilhado para coordenação') },
      { code: 'S2', labels: t('Compartido para información', 'Shared for information', 'Partilhado para informação') },
      { code: 'S4', labels: t('Compartido para aprobación', 'Shared for approval', 'Partilhado para aprovação') },
      { code: 'A1', labels: t('Publicado y autorizado', 'Published and authorised', 'Publicado e autorizado') },
      { code: 'B1', labels: t('Parcialmente autorizado', 'Partially authorised', 'Parcialmente autorizado') },
    ],
  },
]

export interface NamingFieldSeed {
  key: string
  order: number
  labels: LocalizedText
  source: 'CODE_TABLE' | 'FREE_TEXT' | 'NUMERIC' | 'DATE' | 'REGEX'
  codeTableKey?: string
  minLength?: number
  maxLength?: number
  pattern?: string
  dateFormat?: string
  required?: boolean
  example?: string
}

export interface NamingConventionSeed {
  key: string
  target:
    | 'FILE'
    | 'MODEL'
    | 'SHEET'
    | 'VIEW'
    | 'FOLDER'
    | 'FAMILY'
    | 'TYPE'
    | 'PARAMETER'
    | 'WORKSET'
    | 'LEVEL'
    | 'GRID'
  separator: string
  caseRule: 'ANY' | 'UPPER' | 'LOWER'
  maxLength?: number
  labels: LocalizedText
  description: LocalizedText
  fields: NamingFieldSeed[]
  examples: Array<{ sample: string; shouldBeValid: boolean }>
}

/**
 * Seven conventions covering everything the Revit add-in can inspect. Between
 * them they exercise all five field sources, which is also what makes them a
 * useful starting point for a team to adapt.
 */
export const NAMING_CONVENTION_SEEDS: NamingConventionSeed[] = [
  {
    key: 'FILE',
    target: 'FILE',
    separator: '-',
    caseRule: 'UPPER',
    maxLength: 120,
    labels: t('Contenedor de información', 'Information container', 'Contentor de informação'),
    description: t(
      'Nomenclatura ISO 19650-2 para archivos y modelos entregados al CDE.',
      'ISO 19650-2 naming for files and models delivered to the CDE.',
      'Nomenclatura ISO 19650-2 para ficheiros e modelos entregues ao CDE.',
    ),
    fields: [
      { key: 'PRJ', order: 0, labels: t('Proyecto', 'Project', 'Projeto'), source: 'REGEX', pattern: '[A-Z0-9]{2,10}', example: 'EDI' },
      { key: 'ORG', order: 1, labels: t('Originador', 'Originator', 'Originador'), source: 'CODE_TABLE', codeTableKey: 'ORIGINATOR', example: 'JSE' },
      { key: 'VOL', order: 2, labels: t('Volumen', 'Volume', 'Volume'), source: 'CODE_TABLE', codeTableKey: 'VOLUME', example: 'ZZ' },
      { key: 'LVL', order: 3, labels: t('Nivel', 'Level', 'Nível'), source: 'CODE_TABLE', codeTableKey: 'LEVEL', example: '00' },
      { key: 'TYP', order: 4, labels: t('Tipo', 'Type', 'Tipo'), source: 'CODE_TABLE', codeTableKey: 'TYPE', example: 'M3' },
      { key: 'ROL', order: 5, labels: t('Rol', 'Role', 'Função'), source: 'CODE_TABLE', codeTableKey: 'ROLE', example: 'A' },
      { key: 'NUM', order: 6, labels: t('Número', 'Number', 'Número'), source: 'NUMERIC', minLength: 4, maxLength: 4, example: '0001' },
    ],
    examples: [
      { sample: 'EDI-JSE-ZZ-00-M3-A-0001', shouldBeValid: true },
      { sample: 'EDI-JSE-99-00-M3-A-0001', shouldBeValid: false },
      { sample: 'EDI-JSE-ZZ-00-M3-A-1', shouldBeValid: false },
    ],
  },
  {
    key: 'SHEET',
    target: 'SHEET',
    separator: '-',
    caseRule: 'UPPER',
    maxLength: 60,
    labels: t('Plano', 'Sheet', 'Folha'),
    description: t(
      'Numeración de planos por disciplina, nivel y orden.',
      'Sheet numbering by discipline, level and sequence.',
      'Numeração de folhas por disciplina, nível e sequência.',
    ),
    fields: [
      { key: 'DIS', order: 0, labels: t('Disciplina', 'Discipline', 'Disciplina'), source: 'CODE_TABLE', codeTableKey: 'DISCIPLINE', example: 'ARC' },
      { key: 'LVL', order: 1, labels: t('Nivel', 'Level', 'Nível'), source: 'CODE_TABLE', codeTableKey: 'LEVEL', example: '00' },
      { key: 'NUM', order: 2, labels: t('Número', 'Number', 'Número'), source: 'NUMERIC', minLength: 3, maxLength: 3, example: '001' },
    ],
    examples: [
      { sample: 'ARC-00-001', shouldBeValid: true },
      { sample: 'ARQ-00-001', shouldBeValid: false },
    ],
  },
  {
    key: 'VIEW',
    target: 'VIEW',
    separator: '_',
    caseRule: 'ANY',
    maxLength: 80,
    labels: t('Vista', 'View', 'Vista'),
    description: t(
      'Vistas del modelo, ordenadas por disciplina y nivel para que el navegador sea legible.',
      'Model views, ordered by discipline and level so the browser stays readable.',
      'Vistas do modelo, ordenadas por disciplina e nível para que o navegador seja legível.',
    ),
    fields: [
      { key: 'DIS', order: 0, labels: t('Disciplina', 'Discipline', 'Disciplina'), source: 'CODE_TABLE', codeTableKey: 'DISCIPLINE', example: 'ARC' },
      { key: 'LVL', order: 1, labels: t('Nivel', 'Level', 'Nível'), source: 'CODE_TABLE', codeTableKey: 'LEVEL', example: '00' },
      { key: 'DESC', order: 2, labels: t('Descripción', 'Description', 'Descrição'), source: 'FREE_TEXT', minLength: 3, maxLength: 40, example: 'Planta general' },
    ],
    examples: [
      { sample: 'ARC_00_Planta general', shouldBeValid: true },
      { sample: 'ARC_00_Pl', shouldBeValid: false },
    ],
  },
  {
    key: 'FAMILY',
    target: 'FAMILY',
    separator: '_',
    caseRule: 'ANY',
    maxLength: 80,
    labels: t('Familia', 'Family', 'Família'),
    description: t(
      'Familias cargables de Revit: disciplina, categoría funcional y descripción.',
      'Revit loadable families: discipline, functional category and description.',
      'Famílias carregáveis do Revit: disciplina, categoria funcional e descrição.',
    ),
    fields: [
      { key: 'DIS', order: 0, labels: t('Disciplina', 'Discipline', 'Disciplina'), source: 'CODE_TABLE', codeTableKey: 'DISCIPLINE', example: 'ARC' },
      { key: 'CAT', order: 1, labels: t('Categoría', 'Category', 'Categoria'), source: 'FREE_TEXT', minLength: 3, maxLength: 24, example: 'Puerta' },
      { key: 'DESC', order: 2, labels: t('Descripción', 'Description', 'Descrição'), source: 'FREE_TEXT', minLength: 3, maxLength: 40, example: 'Batiente simple' },
    ],
    examples: [
      { sample: 'ARC_Puerta_Batiente simple', shouldBeValid: true },
      { sample: 'Puerta_Batiente simple', shouldBeValid: false },
    ],
  },
  {
    key: 'PARAMETER',
    target: 'PARAMETER',
    separator: '_',
    caseRule: 'ANY',
    maxLength: 60,
    labels: t('Parámetro', 'Parameter', 'Parâmetro'),
    description: t(
      'Parámetros compartidos: prefijo de disciplina y nombre en PascalCase.',
      'Shared parameters: discipline prefix and a PascalCase name.',
      'Parâmetros partilhados: prefixo de disciplina e nome em PascalCase.',
    ),
    fields: [
      { key: 'DIS', order: 0, labels: t('Disciplina', 'Discipline', 'Disciplina'), source: 'CODE_TABLE', codeTableKey: 'DISCIPLINE', example: 'GEN' },
      { key: 'NAME', order: 1, labels: t('Nombre', 'Name', 'Nome'), source: 'REGEX', pattern: '[A-Z][A-Za-z0-9]{2,39}', example: 'CodigoClasificacion' },
    ],
    examples: [
      { sample: 'GEN_CodigoClasificacion', shouldBeValid: true },
      { sample: 'GEN_codigo clasificacion', shouldBeValid: false },
    ],
  },
  {
    key: 'WORKSET',
    target: 'WORKSET',
    separator: '_',
    caseRule: 'ANY',
    maxLength: 60,
    labels: t('Subproyecto', 'Workset', 'Subprojeto'),
    description: t(
      'Subproyectos de Revit alineados con la segmentación de modelos.',
      'Revit worksets aligned with the model segmentation.',
      'Subprojetos do Revit alinhados com a segmentação de modelos.',
    ),
    fields: [
      { key: 'DIS', order: 0, labels: t('Disciplina', 'Discipline', 'Disciplina'), source: 'CODE_TABLE', codeTableKey: 'DISCIPLINE', example: 'STR' },
      { key: 'ZONE', order: 1, labels: t('Zona', 'Zone', 'Zona'), source: 'FREE_TEXT', minLength: 2, maxLength: 20, example: 'Torre A' },
      { key: 'ELEM', order: 2, labels: t('Elemento', 'Element', 'Elemento'), source: 'FREE_TEXT', minLength: 3, maxLength: 24, required: false, example: 'Pilares' },
    ],
    examples: [
      { sample: 'STR_Torre A_Pilares', shouldBeValid: true },
      { sample: 'STR_Torre A', shouldBeValid: true },
      { sample: 'XXX_Torre A_Pilares', shouldBeValid: false },
    ],
  },
  {
    key: 'FOLDER',
    target: 'FOLDER',
    separator: '_',
    caseRule: 'ANY',
    maxLength: 60,
    labels: t('Carpeta', 'Folder', 'Pasta'),
    description: t(
      'Carpetas del CDE numeradas para que el orden alfabético sea el orden lógico.',
      'CDE folders numbered so alphabetical order matches logical order.',
      'Pastas do CDE numeradas para que a ordem alfabética seja a ordem lógica.',
    ),
    fields: [
      { key: 'NUM', order: 0, labels: t('Orden', 'Order', 'Ordem'), source: 'NUMERIC', minLength: 2, maxLength: 2, example: '01' },
      { key: 'NAME', order: 1, labels: t('Nombre', 'Name', 'Nome'), source: 'FREE_TEXT', minLength: 3, maxLength: 40, example: 'Trabajo en curso' },
    ],
    examples: [
      { sample: '01_Trabajo en curso', shouldBeValid: true },
      { sample: '1_Trabajo en curso', shouldBeValid: false },
    ],
  },
]

export const RACI_ACTIVITY_SEEDS = [
  { key: 'PROTOCOL_DEFINITION', order: 1, labels: t('Definir y mantener el protocolo BIM', 'Define and maintain the BIM protocol', 'Definir e manter o protocolo BIM') },
  { key: 'NAMING_COMPLIANCE', order: 2, labels: t('Cumplir la nomenclatura acordada', 'Comply with the agreed naming', 'Cumprir a nomenclatura acordada') },
  { key: 'MODEL_AUTHORING', order: 3, labels: t('Modelar la disciplina', 'Author the discipline model', 'Modelar a disciplina') },
  { key: 'MODEL_FEDERATION', order: 4, labels: t('Federar los modelos', 'Federate the models', 'Federar os modelos') },
  { key: 'CLASH_RESOLUTION', order: 5, labels: t('Resolver interferencias', 'Resolve clashes', 'Resolver interferências') },
  { key: 'QUALITY_AUDIT', order: 6, labels: t('Auditar la calidad del modelo', 'Audit model quality', 'Auditar a qualidade do modelo') },
  { key: 'CDE_PUBLICATION', order: 7, labels: t('Publicar en el CDE', 'Publish to the CDE', 'Publicar no CDE') },
  { key: 'DELIVERY_APPROVAL', order: 8, labels: t('Aprobar la entrega de información', 'Approve the information delivery', 'Aprovar a entrega de informação') },
]
