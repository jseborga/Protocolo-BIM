import type { LocalizedText } from '@/server/naming/types'

export type SectionGenerator = 'PROJECT_INFO' | 'TEAM' | 'RACI' | 'SOFTWARE' | 'NAMING'

export interface TemplateSectionDef {
  key: string
  order: number
  kind: 'RICH_TEXT' | 'TABLE' | 'MATRIX' | 'GENERATED'
  isRequired: boolean
  /** Live project data injected when rendering and exporting. */
  generator?: SectionGenerator
  titles: LocalizedText
  guidance: LocalizedText
  defaultBody?: LocalizedText
}

/**
 * ISO 19650 BIM execution plan / protocol outline.
 *
 * Sections marked GENERATED are rendered from live project data (client,
 * team, RACI, software stack, naming conventions) rather than typed by hand,
 * which is what keeps the document and the rules from drifting apart.
 */
export const ISO19650_TEMPLATE: TemplateSectionDef[] = [
  {
    key: 'PURPOSE',
    order: 1,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Objeto y alcance del protocolo',
      en: 'Purpose and scope of the protocol',
      pt: 'Objeto e âmbito do protocolo',
    },
    guidance: {
      es: 'Para qué sirve este documento, a qué contratos y fases aplica y a quién obliga.',
      en: 'What this document is for, which contracts and stages it applies to, and who is bound by it.',
      pt: 'Para que serve este documento, a que contratos e fases se aplica e quem vincula.',
    },
  },
  {
    key: 'REFERENCES',
    order: 2,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Normas y documentos de referencia',
      en: 'Standards and reference documents',
      pt: 'Normas e documentos de referência',
    },
    guidance: {
      es: 'Normas aplicables (ISO 19650-1 a -5, EN 17412-1) y documentos contractuales relacionados.',
      en: 'Applicable standards (ISO 19650-1 to -5, EN 17412-1) and related contract documents.',
      pt: 'Normas aplicáveis (ISO 19650-1 a -5, EN 17412-1) e documentos contratuais relacionados.',
    },
    defaultBody: {
      es: '- ISO 19650-1: Conceptos y principios\n- ISO 19650-2: Fase de entrega de los activos\n- ISO 19650-3: Fase operativa de los activos\n- ISO 19650-4: Intercambio de información\n- ISO 19650-5: Enfoque de seguridad de la información\n- EN 17412-1: Nivel de necesidad de información',
      en: '- ISO 19650-1: Concepts and principles\n- ISO 19650-2: Delivery phase of the assets\n- ISO 19650-3: Operational phase of the assets\n- ISO 19650-4: Information exchange\n- ISO 19650-5: Security-minded approach\n- EN 17412-1: Level of information need',
      pt: '- ISO 19650-1: Conceitos e princípios\n- ISO 19650-2: Fase de entrega dos ativos\n- ISO 19650-3: Fase operacional dos ativos\n- ISO 19650-4: Intercâmbio de informação\n- ISO 19650-5: Abordagem de segurança da informação\n- EN 17412-1: Nível de necessidade de informação',
    },
  },
  {
    key: 'DEFINITIONS',
    order: 3,
    kind: 'RICH_TEXT',
    isRequired: false,
    titles: {
      es: 'Términos y abreviaturas',
      en: 'Terms and abbreviations',
      pt: 'Termos e abreviaturas',
    },
    guidance: {
      es: 'Glosario del proyecto. Define aquí los términos que el equipo interpreta de forma distinta.',
      en: 'Project glossary. Define here the terms the team reads differently.',
      pt: 'Glossário do projeto. Defina aqui os termos que a equipa interpreta de forma diferente.',
    },
  },
  {
    key: 'PROJECT_INFO',
    order: 4,
    kind: 'GENERATED',
    isRequired: true,
    generator: 'PROJECT_INFO',
    titles: {
      es: 'Información del proyecto y del cliente',
      en: 'Project and client information',
      pt: 'Informação do projeto e do cliente',
    },
    guidance: {
      es: 'Se genera a partir de los datos del proyecto y de la ficha de cliente.',
      en: 'Generated from the project data and the client record.',
      pt: 'Gerado a partir dos dados do projeto e da ficha de cliente.',
    },
  },
  {
    key: 'BIM_USES',
    order: 5,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Usos BIM y objetivos de información',
      en: 'BIM uses and information objectives',
      pt: 'Usos BIM e objetivos de informação',
    },
    guidance: {
      es: 'Para qué se va a usar el modelo: coordinación, mediciones, planificación 4D, operación. Cada uso condiciona el LOIN.',
      en: 'What the model will be used for: coordination, quantities, 4D planning, operation. Each use drives the LOIN.',
      pt: 'Para que será usado o modelo: coordenação, medições, planeamento 4D, operação. Cada uso condiciona o LOIN.',
    },
  },
  {
    key: 'EIR',
    order: 6,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Requisitos de información del designante (EIR)',
      en: "Appointing party's information requirements (EIR)",
      pt: 'Requisitos de informação da parte designante (EIR)',
    },
    guidance: {
      es: 'Qué información pide el cliente, con qué propósito y en qué hitos. Es la entrada del protocolo.',
      en: 'What information the client asks for, for what purpose and at which milestones. This is the protocol input.',
      pt: 'Que informação o cliente pede, com que propósito e em que marcos. É a entrada do protocolo.',
    },
  },
  {
    key: 'ORG_ROLES',
    order: 7,
    kind: 'GENERATED',
    isRequired: true,
    generator: 'TEAM',
    titles: {
      es: 'Organización, roles y responsabilidades',
      en: 'Organisation, roles and responsibilities',
      pt: 'Organização, funções e responsabilidades',
    },
    guidance: {
      es: 'Se genera a partir de las partes designadas y los miembros del equipo del proyecto.',
      en: 'Generated from the appointed parties and the project team members.',
      pt: 'Gerado a partir das partes designadas e dos membros da equipa do projeto.',
    },
  },
  {
    key: 'RACI',
    order: 8,
    kind: 'GENERATED',
    isRequired: false,
    generator: 'RACI',
    titles: {
      es: 'Matriz de responsabilidades (RACI)',
      en: 'Responsibility matrix (RACI)',
      pt: 'Matriz de responsabilidades (RACI)',
    },
    guidance: {
      es: 'Se genera a partir de la matriz RACI definida en la pestaña de equipo.',
      en: 'Generated from the RACI matrix defined in the team tab.',
      pt: 'Gerado a partir da matriz RACI definida no separador de equipa.',
    },
  },
  {
    key: 'COMPETENCE',
    order: 9,
    kind: 'RICH_TEXT',
    isRequired: false,
    titles: {
      es: 'Capacidad y competencia del equipo',
      en: 'Team capability and competence',
      pt: 'Capacidade e competência da equipa',
    },
    guidance: {
      es: 'Evaluación de capacidad y capacidad de recursos exigida por ISO 19650-2, y plan de formación si procede.',
      en: 'Capability and capacity assessment required by ISO 19650-2, plus a training plan if needed.',
      pt: 'Avaliação de capacidade e capacidade de recursos exigida pela ISO 19650-2, e plano de formação se aplicável.',
    },
  },
  {
    key: 'SOFTWARE',
    order: 10,
    kind: 'GENERATED',
    isRequired: true,
    generator: 'SOFTWARE',
    titles: {
      es: 'Software de modelado, versiones y formatos',
      en: 'Modelling software, versions and formats',
      pt: 'Software de modelação, versões e formatos',
    },
    guidance: {
      es: 'Se genera a partir del software declarado por disciplina. Fija versiones: mezclar versiones rompe la federación.',
      en: 'Generated from the software declared per discipline. Pin versions: mixing them breaks federation.',
      pt: 'Gerado a partir do software declarado por disciplina. Fixe versões: misturá-las quebra a federação.',
    },
  },
  {
    key: 'COORDINATES',
    order: 11,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Sistema de coordenadas, origen y unidades',
      en: 'Coordinate system, origin and units',
      pt: 'Sistema de coordenadas, origem e unidades',
    },
    guidance: {
      es: 'Punto base compartido, coordenadas topográficas, norte del proyecto y unidades. Sin esto la federación no cuadra.',
      en: 'Shared base point, survey coordinates, project north and units. Without this, federation does not line up.',
      pt: 'Ponto base partilhado, coordenadas topográficas, norte do projeto e unidades. Sem isto a federação não encaixa.',
    },
  },
  {
    key: 'MODEL_STRUCTURE',
    order: 12,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Estructura y segmentación de los modelos',
      en: 'Model structure and segmentation',
      pt: 'Estrutura e segmentação dos modelos',
    },
    guidance: {
      es: 'Cómo se divide la información en contenedores: por disciplina, volumen, nivel o zona, y cómo se federan.',
      en: 'How information is split into containers: by discipline, volume, level or zone, and how they are federated.',
      pt: 'Como a informação se divide em contentores: por disciplina, volume, nível ou zona, e como se federam.',
    },
  },
  {
    key: 'LOIN',
    order: 13,
    kind: 'TABLE',
    isRequired: true,
    titles: {
      es: 'Nivel de necesidad de información (LOIN)',
      en: 'Level of information need (LOIN)',
      pt: 'Nível de necessidade de informação (LOIN)',
    },
    guidance: {
      es: 'Por categoría de elemento y por hito: geometría, información alfanumérica y documentación. No basta con «LOD 300».',
      en: 'Per element category and milestone: geometry, alphanumerical information and documentation. "LOD 300" is not enough.',
      pt: 'Por categoria de elemento e por marco: geometria, informação alfanumérica e documentação. Não basta «LOD 300».',
    },
    defaultBody: {
      es: '| Categoría | Hito | Geometría | Información | Documentación |\n| --- | --- | --- | --- | --- |\n| Muros | Proyecto básico | Volumen genérico | Tipo, material | — |',
      en: '| Category | Milestone | Geometry | Information | Documentation |\n| --- | --- | --- | --- | --- |\n| Walls | Concept design | Generic volume | Type, material | — |',
      pt: '| Categoria | Marco | Geometria | Informação | Documentação |\n| --- | --- | --- | --- | --- |\n| Paredes | Projeto base | Volume genérico | Tipo, material | — |',
    },
  },
  {
    key: 'NAMING',
    order: 14,
    kind: 'GENERATED',
    isRequired: true,
    generator: 'NAMING',
    titles: {
      es: 'Nomenclatura de contenedores de información',
      en: 'Information container naming',
      pt: 'Nomenclatura de contentores de informação',
    },
    guidance: {
      es: 'Se genera a partir de las convenciones activas. Son las mismas reglas que verifican el complemento de Revit y el auditor IFC.',
      en: 'Generated from the active conventions. These are the very rules the Revit add-in and the IFC auditor check.',
      pt: 'Gerado a partir das convenções ativas. São as mesmas regras que o suplemento do Revit e o auditor IFC verificam.',
    },
  },
  {
    key: 'CDE',
    order: 15,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Entorno común de datos (CDE) y estados',
      en: 'Common data environment (CDE) and states',
      pt: 'Ambiente comum de dados (CDE) e estados',
    },
    guidance: {
      es: 'Plataforma, flujo de trabajo y transiciones entre Trabajo en curso, Compartido, Publicado y Archivado, con códigos de estado y revisión.',
      en: 'Platform, workflow and transitions between Work in progress, Shared, Published and Archived, with status and revision codes.',
      pt: 'Plataforma, fluxo de trabalho e transições entre Trabalho em curso, Partilhado, Publicado e Arquivado, com códigos de estado e revisão.',
    },
    defaultBody: {
      es: '| Estado | Código | Quién escribe | Quién lee | Salida |\n| --- | --- | --- | --- | --- |\n| Trabajo en curso | WIP | Equipo de tarea | Equipo de tarea | Revisión interna |\n| Compartido | S | Equipo de tarea | Equipo de entrega | Coordinación |\n| Publicado | A | Parte designada principal | Parte designante | Autorizado |\n| Archivado | AR | — | Auditoría | Registro |',
      en: '| State | Code | Who writes | Who reads | Output |\n| --- | --- | --- | --- | --- |\n| Work in progress | WIP | Task team | Task team | Internal review |\n| Shared | S | Task team | Delivery team | Coordination |\n| Published | A | Lead appointed party | Appointing party | Authorised |\n| Archived | AR | — | Audit | Record |',
      pt: '| Estado | Código | Quem escreve | Quem lê | Saída |\n| --- | --- | --- | --- | --- |\n| Trabalho em curso | WIP | Equipa de tarefa | Equipa de tarefa | Revisão interna |\n| Partilhado | S | Equipa de tarefa | Equipa de entrega | Coordenação |\n| Publicado | A | Parte designada principal | Parte designante | Autorizado |\n| Arquivado | AR | — | Auditoria | Registo |',
    },
  },
  {
    key: 'FOLDERS',
    order: 16,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Estructura de carpetas',
      en: 'Folder structure',
      pt: 'Estrutura de pastas',
    },
    guidance: {
      es: 'Árbol de carpetas del CDE y a qué estado pertenece cada rama. Debe seguir la convención de nomenclatura de carpetas.',
      en: 'CDE folder tree and which state each branch belongs to. It must follow the folder naming convention.',
      pt: 'Árvore de pastas do CDE e a que estado pertence cada ramo. Deve seguir a convenção de nomenclatura de pastas.',
    },
  },
  {
    key: 'PARAMETERS',
    order: 17,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Parámetros, propiedades y clasificación',
      en: 'Parameters, properties and classification',
      pt: 'Parâmetros, propriedades e classificação',
    },
    guidance: {
      es: 'Parámetros compartidos obligatorios, su GUID, el Pset IFC al que se mapean y el sistema de clasificación adoptado.',
      en: 'Mandatory shared parameters, their GUID, the IFC Pset they map to and the classification system adopted.',
      pt: 'Parâmetros partilhados obrigatórios, o seu GUID, o Pset IFC a que se mapeiam e o sistema de classificação adotado.',
    },
  },
  {
    key: 'FAMILIES',
    order: 18,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Familias, tipos y biblioteca de contenido',
      en: 'Families, types and content library',
      pt: 'Famílias, tipos e biblioteca de conteúdo',
    },
    guidance: {
      es: 'Reglas de creación de familias y tipos, biblioteca aprobada, y quién puede incorporar contenido nuevo.',
      en: 'Rules for authoring families and types, the approved library, and who may add new content.',
      pt: 'Regras de criação de famílias e tipos, biblioteca aprovada e quem pode incorporar conteúdo novo.',
    },
  },
  {
    key: 'SHEETS',
    order: 19,
    kind: 'RICH_TEXT',
    isRequired: false,
    titles: {
      es: 'Planos, vistas y presentación',
      en: 'Sheets, views and presentation',
      pt: 'Folhas, vistas e apresentação',
    },
    guidance: {
      es: 'Plantillas de vista, cajetín, escalas, convenciones gráficas y numeración de planos.',
      en: 'View templates, title block, scales, graphic conventions and sheet numbering.',
      pt: 'Modelos de vista, legenda, escalas, convenções gráficas e numeração de folhas.',
    },
  },
  {
    key: 'COORDINATION',
    order: 20,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Coordinación, federación e interferencias',
      en: 'Coordination, federation and clash management',
      pt: 'Coordenação, federação e interferências',
    },
    guidance: {
      es: 'Ciclo de federación, reuniones ICE, matriz de chequeo entre disciplinas con tolerancias y flujo de resolución.',
      en: 'Federation cycle, ICE meetings, discipline-vs-discipline clash matrix with tolerances and the resolution workflow.',
      pt: 'Ciclo de federação, reuniões ICE, matriz de verificação entre disciplinas com tolerâncias e fluxo de resolução.',
    },
  },
  {
    key: 'QA',
    order: 21,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Control de calidad y validación del modelo',
      en: 'Quality control and model validation',
      pt: 'Controlo de qualidade e validação do modelo',
    },
    guidance: {
      es: 'Qué se comprueba antes de compartir, con qué herramienta y quién firma. Aquí entra la auditoría automática de nomenclatura y parámetros.',
      en: 'What is checked before sharing, with which tool and who signs it off. This is where the automated naming and parameter audit fits.',
      pt: 'O que se verifica antes de partilhar, com que ferramenta e quem assina. Aqui entra a auditoria automática de nomenclatura e parâmetros.',
    },
  },
  {
    key: 'MIDP',
    order: 22,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Plan de entrega de información (TIDP y MIDP)',
      en: 'Information delivery planning (TIDP and MIDP)',
      pt: 'Plano de entrega de informação (TIDP e MIDP)',
    },
    guidance: {
      es: 'Qué contenedor entrega cada parte designada, en qué hito y con qué responsable. El MIDP agrega los TIDP.',
      en: 'Which container each appointed party delivers, at which milestone and with which responsible person. The MIDP aggregates the TIDPs.',
      pt: 'Que contentor entrega cada parte designada, em que marco e com que responsável. O MIDP agrega os TIDP.',
    },
  },
  {
    key: 'DELIVERABLES',
    order: 23,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Entregables y formatos de intercambio',
      en: 'Deliverables and exchange formats',
      pt: 'Entregáveis e formatos de intercâmbio',
    },
    guidance: {
      es: 'Qué se entrega en formato nativo, qué en IFC y con qué vista de modelo (MVD), y qué se considera el original contractual.',
      en: 'What is delivered natively, what in IFC and with which model view definition, and which one is the contractual original.',
      pt: 'O que se entrega em formato nativo, o que em IFC e com que vista de modelo, e o que é o original contratual.',
    },
  },
  {
    key: 'SECURITY',
    order: 24,
    kind: 'RICH_TEXT',
    isRequired: false,
    titles: {
      es: 'Seguridad de la información (ISO 19650-5)',
      en: 'Information security (ISO 19650-5)',
      pt: 'Segurança da informação (ISO 19650-5)',
    },
    guidance: {
      es: 'Clasificación de la información sensible, control de accesos, y qué no puede salir del CDE.',
      en: 'Classification of sensitive information, access control, and what must never leave the CDE.',
      pt: 'Classificação da informação sensível, controlo de acessos e o que não pode sair do CDE.',
    },
  },
  {
    key: 'IP',
    order: 25,
    kind: 'RICH_TEXT',
    isRequired: false,
    titles: {
      es: 'Propiedad intelectual y responsabilidad',
      en: 'Intellectual property and liability',
      pt: 'Propriedade intelectual e responsabilidade',
    },
    guidance: {
      es: 'De quién es el modelo, qué licencia de uso se concede y hasta dónde llega la responsabilidad sobre la información entregada.',
      en: 'Who owns the model, what licence of use is granted and how far liability for delivered information extends.',
      pt: 'De quem é o modelo, que licença de uso se concede e até onde vai a responsabilidade sobre a informação entregue.',
    },
  },
  {
    key: 'CHANGE_CONTROL',
    order: 26,
    kind: 'RICH_TEXT',
    isRequired: true,
    titles: {
      es: 'Control de cambios del protocolo',
      en: 'Protocol change control',
      pt: 'Controlo de alterações do protocolo',
    },
    guidance: {
      es: 'Quién puede proponer cambios, quién los aprueba y cómo se comunica una versión nueva al equipo.',
      en: 'Who may propose changes, who approves them and how a new version is communicated to the team.',
      pt: 'Quem pode propor alterações, quem as aprova e como se comunica uma nova versão à equipa.',
    },
  },
  {
    key: 'ANNEXES',
    order: 27,
    kind: 'RICH_TEXT',
    isRequired: false,
    titles: { es: 'Anexos', en: 'Annexes', pt: 'Anexos' },
    guidance: {
      es: 'Documentos adjuntos: plantillas, matrices detalladas y cualquier acuerdo específico del proyecto.',
      en: 'Attached documents: templates, detailed matrices and any project-specific agreement.',
      pt: 'Documentos anexos: modelos, matrizes detalhadas e qualquer acordo específico do projeto.',
    },
  },
]

export const GENERATED_SECTIONS = new Map<string, SectionGenerator>(
  ISO19650_TEMPLATE.filter((section) => section.generator).map((section) => [
    section.key,
    section.generator!,
  ]),
)

export const REQUIRED_SECTION_KEYS = ISO19650_TEMPLATE.filter(
  (section) => section.isRequired,
).map((section) => section.key)
