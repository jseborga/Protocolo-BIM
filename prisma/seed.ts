import { PrismaClient, type Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { DISCIPLINE_SEED } from '../src/server/protocol/baseline'
import { ISO19650_TEMPLATE } from '../src/server/protocol/template'
import { provisionProject } from '../src/server/protocol/provision'

const prisma = new PrismaClient()

const DEMO_PASSWORD = 'demo1234'

/**
 * The catalogue (disciplines and the ISO 19650 template) is setup data every
 * installation needs, and re-running it is harmless because it upserts. The
 * demo organisation is not: a real deployment must not be given a fake project,
 * so it only appears when explicitly asked for.
 */
const SEED_DEMO = process.env.SEED_DEMO === 'true'

async function seedDisciplines() {
  for (const discipline of DISCIPLINE_SEED) {
    await prisma.discipline.upsert({
      where: { code: discipline.code },
      update: {
        labels: discipline.labels as Prisma.InputJsonValue,
        color: discipline.color,
        order: discipline.order,
      },
      create: {
        code: discipline.code,
        labels: discipline.labels as Prisma.InputJsonValue,
        color: discipline.color,
        order: discipline.order,
      },
    })
  }
  console.log(`  disciplines: ${DISCIPLINE_SEED.length}`)
}

async function seedTemplate() {
  const template = await prisma.protocolTemplate.upsert({
    where: { key: 'ISO_19650_BASE' },
    update: {},
    create: {
      key: 'ISO_19650_BASE',
      scope: 'GLOBAL',
      standard: 'ISO_19650',
      version: '1.0',
      labels: {
        es: 'Protocolo BIM ISO 19650',
        en: 'ISO 19650 BIM protocol',
        pt: 'Protocolo BIM ISO 19650',
      },
      description: {
        es: 'Plantilla base con las secciones exigidas por ISO 19650 partes 1 a 5.',
        en: 'Baseline template with the sections required by ISO 19650 parts 1 to 5.',
        pt: 'Modelo base com as secções exigidas pela ISO 19650 partes 1 a 5.',
      },
    },
  })

  for (const section of ISO19650_TEMPLATE) {
    await prisma.templateSection.upsert({
      where: { templateId_key: { templateId: template.id, key: section.key } },
      update: {
        order: section.order,
        kind: section.kind,
        isRequired: section.isRequired,
        titles: section.titles as Prisma.InputJsonValue,
        guidance: section.guidance as Prisma.InputJsonValue,
        defaultBody: (section.defaultBody ?? null) as Prisma.InputJsonValue,
      },
      create: {
        templateId: template.id,
        key: section.key,
        order: section.order,
        kind: section.kind,
        isRequired: section.isRequired,
        titles: section.titles as Prisma.InputJsonValue,
        guidance: section.guidance as Prisma.InputJsonValue,
        defaultBody: (section.defaultBody ?? null) as Prisma.InputJsonValue,
      },
    })
  }
  console.log(`  template sections: ${ISO19650_TEMPLATE.length}`)
}

async function seedDemo() {
  const existing = await prisma.organization.findUnique({ where: { slug: 'estudio-demo' } })
  if (existing) {
    console.log('  demo organisation already present, skipping')
    return
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)

  const org = await prisma.organization.create({
    data: { slug: 'estudio-demo', name: 'Estudio Seborga', country: 'BO', defaultLocale: 'ES' },
  })

  const people = [
    { email: 'ana@demo.test', name: 'Ana Ribeiro', locale: 'ES' as const, orgRole: 'OWNER' as const, projectRole: 'INFORMATION_MANAGER' as const, discipline: 'GEN', jobTitle: 'Information manager' },
    { email: 'bruno@demo.test', name: 'Bruno Costa', locale: 'PT' as const, orgRole: 'MEMBER' as const, projectRole: 'BIM_COORDINATOR' as const, discipline: 'STR', jobTitle: 'Coordenador BIM' },
    { email: 'carla@demo.test', name: 'Carla Mendes', locale: 'EN' as const, orgRole: 'MEMBER' as const, projectRole: 'BIM_MODELLER' as const, discipline: 'ARC', jobTitle: 'BIM modeller' },
    { email: 'diego@demo.test', name: 'Diego Salas', locale: 'ES' as const, orgRole: 'MEMBER' as const, projectRole: 'CLIENT' as const, discipline: 'GEN', jobTitle: 'Dirección de proyecto' },
  ]

  // Upserted rather than created: users outlive an organisation, so re-running
  // the seed after removing the demo org must not trip the unique email.
  const users = new Map<string, string>()
  for (const person of people) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: { name: person.name, passwordHash, locale: person.locale, jobTitle: person.jobTitle },
      create: {
        email: person.email,
        name: person.name,
        passwordHash,
        locale: person.locale,
        jobTitle: person.jobTitle,
      },
    })
    await prisma.membership.upsert({
      where: { userId_orgId: { userId: user.id, orgId: org.id } },
      update: { role: person.orgRole },
      create: { userId: user.id, orgId: org.id, role: person.orgRole },
    })
    users.set(person.email, user.id)
  }

  const ana = users.get('ana@demo.test')!
  const disciplines = new Map(
    (await prisma.discipline.findMany()).map((discipline) => [discipline.code, discipline.id]),
  )

  const project = await prisma.project.create({
    data: {
      orgId: org.id,
      code: 'EDI',
      name: 'Edificio Corporativo Alameda',
      description:
        'Edificio de oficinas de 12 plantas con dos sótanos de aparcamiento. Proyecto piloto del protocolo BIM corporativo.',
      status: 'ACTIVE',
      baseLocale: 'ES',
      enabledLocales: ['ES', 'EN', 'PT'],
      country: 'BO',
      city: 'Santa Cruz de la Sierra',
      address: 'Av. San Martín 1234',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2028-06-30'),
      client: {
        create: {
          legalName: 'Inmobiliaria Alameda S.A.',
          tradeName: 'Alameda',
          taxId: '1023456789',
          contactName: 'Diego Salas',
          contactEmail: 'diego@demo.test',
          contactPhone: '+591 3 123 4567',
          address: 'Av. San Martín 1200',
          city: 'Santa Cruz de la Sierra',
          country: 'BO',
        },
      },
    },
  })

  const parties = await Promise.all([
    prisma.party.create({
      data: {
        projectId: project.id,
        name: 'Inmobiliaria Alameda S.A.',
        type: 'APPOINTING',
        code: 'ALA',
        contactName: 'Diego Salas',
        contactEmail: 'diego@demo.test',
      },
    }),
    prisma.party.create({
      data: {
        projectId: project.id,
        name: 'Estudio Seborga',
        type: 'LEAD_APPOINTED',
        code: 'JSE',
        contactName: 'Ana Ribeiro',
        contactEmail: 'ana@demo.test',
        disciplineId: disciplines.get('ARC'),
      },
    }),
    prisma.party.create({
      data: {
        projectId: project.id,
        name: 'Estructuras del Sur Ltda.',
        type: 'APPOINTED',
        code: 'EDS',
        contactName: 'Bruno Costa',
        contactEmail: 'bruno@demo.test',
        disciplineId: disciplines.get('STR'),
      },
    }),
  ])

  const teams = await Promise.all([
    prisma.team.create({
      data: {
        projectId: project.id,
        name: 'Equipo de Arquitectura',
        disciplineId: disciplines.get('ARC'),
        leadId: users.get('carla@demo.test'),
      },
    }),
    prisma.team.create({
      data: {
        projectId: project.id,
        name: 'Equipo de Estructuras',
        disciplineId: disciplines.get('STR'),
        leadId: users.get('bruno@demo.test'),
      },
    }),
    prisma.team.create({
      data: {
        projectId: project.id,
        name: 'Equipo de Instalaciones',
        disciplineId: disciplines.get('MEP'),
      },
    }),
  ])

  const teamByDiscipline: Record<string, string> = {
    ARC: teams[0]!.id,
    STR: teams[1]!.id,
    MEP: teams[2]!.id,
  }

  for (const person of people) {
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: users.get(person.email)!,
        role: person.projectRole,
        disciplineId: disciplines.get(person.discipline),
        teamId: teamByDiscipline[person.discipline] ?? null,
        partyId:
          person.projectRole === 'CLIENT'
            ? parties[0]!.id
            : person.discipline === 'STR'
              ? parties[2]!.id
              : parties[1]!.id,
        jobTitle: person.jobTitle,
      },
    })
  }

  const software = [
    { name: 'Autodesk Revit', version: '2025', discipline: 'ARC', purpose: 'Modelado de arquitectura', nativeFormat: 'RVT', exchangeFormat: 'IFC 4 Reference View' },
    { name: 'Autodesk Revit', version: '2025', discipline: 'STR', purpose: 'Modelado estructural', nativeFormat: 'RVT', exchangeFormat: 'IFC 4 Reference View' },
    { name: 'Autodesk Revit', version: '2025', discipline: 'MEP', purpose: 'Modelado de instalaciones', nativeFormat: 'RVT', exchangeFormat: 'IFC 4 Reference View' },
    { name: 'Autodesk Navisworks Manage', version: '2025', discipline: 'GEN', purpose: 'Federación y detección de interferencias', nativeFormat: 'NWD', exchangeFormat: 'BCF 2.1' },
    { name: 'Solibri Office', version: '2025', discipline: 'GEN', purpose: 'Validación de reglas y calidad del modelo', nativeFormat: 'SMC', exchangeFormat: 'BCF 2.1' },
    { name: 'Autodesk Civil 3D', version: '2025', discipline: 'CIV', purpose: 'Urbanización y movimiento de tierras', nativeFormat: 'DWG', exchangeFormat: 'IFC 4x3' },
  ]

  for (const [index, tool] of software.entries()) {
    await prisma.softwareTool.create({
      data: {
        projectId: project.id,
        disciplineId: disciplines.get(tool.discipline),
        name: tool.name,
        version: tool.version,
        purpose: tool.purpose,
        nativeFormat: tool.nativeFormat,
        exchangeFormat: tool.exchangeFormat,
        order: index,
      },
    })
  }

  const { protocolId } = await prisma.$transaction(async (tx) =>
    provisionProject(tx, {
      projectId: project.id,
      projectCode: project.code,
      organisationName: org.name,
      baseLocale: 'ES',
      enabledLocales: ['ES', 'EN', 'PT'],
      createdById: ana,
      // Originator codes come from the appointed parties, which is what the
      // file naming convention actually refers to.
      originators: parties
        .filter((party) => party.code)
        .map((party) => ({ code: party.code!, label: party.name })),
    }),
  )

  // A few RACI assignments so the matrix is not empty on first load.
  const activities = new Map(
    (await prisma.raciActivity.findMany({ where: { projectId: project.id } })).map((activity) => [
      activity.key,
      activity.id,
    ]),
  )
  const raci: Array<[string, Prisma.RaciAssignmentCreateManyInput]> = [
    ['PROTOCOL_DEFINITION', { activityId: '', projectRole: 'INFORMATION_MANAGER', letter: 'A' }],
    ['PROTOCOL_DEFINITION', { activityId: '', projectRole: 'BIM_MANAGER', letter: 'R' }],
    ['NAMING_COMPLIANCE', { activityId: '', projectRole: 'BIM_MODELLER', letter: 'R' }],
    ['NAMING_COMPLIANCE', { activityId: '', projectRole: 'BIM_COORDINATOR', letter: 'A' }],
    ['MODEL_AUTHORING', { activityId: '', projectRole: 'BIM_MODELLER', letter: 'R' }],
    ['MODEL_FEDERATION', { activityId: '', projectRole: 'BIM_COORDINATOR', letter: 'R' }],
    ['CLASH_RESOLUTION', { activityId: '', projectRole: 'BIM_COORDINATOR', letter: 'R' }],
    ['CLASH_RESOLUTION', { activityId: '', projectRole: 'BIM_MODELLER', letter: 'C' }],
    ['QUALITY_AUDIT', { activityId: '', projectRole: 'INFORMATION_MANAGER', letter: 'A' }],
    ['CDE_PUBLICATION', { activityId: '', projectRole: 'INFORMATION_MANAGER', letter: 'R' }],
    ['DELIVERY_APPROVAL', { activityId: '', projectRole: 'CLIENT', letter: 'A' }],
    ['DELIVERY_APPROVAL', { activityId: '', projectRole: 'INFORMATION_MANAGER', letter: 'R' }],
  ]
  await prisma.raciAssignment.createMany({
    data: raci
      .filter(([key]) => activities.has(key))
      .map(([key, assignment]) => ({ ...assignment, activityId: activities.get(key)! })),
  })

  // Demo prose: Spanish everywhere it matters, English only on two sections so
  // the translation gauge shows a realistic partial state.
  const prose: Array<{ key: string; es: string; en?: string }> = [
    {
      key: 'PURPOSE',
      es: 'Este protocolo establece los requisitos de generación, intercambio y aprobación de información del proyecto Edificio Corporativo Alameda, y es de obligado cumplimiento para todas las partes designadas desde la fase de proyecto básico hasta la entrega de la información del activo.\n\nSustituye a cualquier acuerdo verbal previo sobre nomenclatura, formatos o flujos de trabajo.',
      en: 'This protocol sets out the requirements for producing, exchanging and approving information on the Alameda Corporate Building project. It is binding on every appointed party from concept design through to asset information handover.\n\nIt supersedes any previous verbal agreement on naming, formats or workflows.',
    },
    {
      key: 'BIM_USES',
      es: 'Usos BIM acordados para este proyecto:\n\n- **Coordinación espacial** entre arquitectura, estructuras e instalaciones, con ciclo quincenal de federación.\n- **Mediciones y presupuesto** a partir del modelo, con parámetros de clasificación obligatorios.\n- **Planificación 4D** de la fase de estructura.\n- **Información del activo** para el mantenimiento del edificio, en formato IFC 4.',
      en: 'Agreed BIM uses for this project:\n\n- **Spatial coordination** between architecture, structures and services, on a fortnightly federation cycle.\n- **Quantities and cost** taken from the model, with mandatory classification parameters.\n- **4D planning** of the structural phase.\n- **Asset information** for building maintenance, in IFC 4 format.',
    },
    {
      key: 'EIR',
      es: 'La parte designante requiere:\n\n1. Modelo federado en cada hito contractual, en formato nativo e IFC 4 Reference View.\n2. Parámetros de clasificación y de mantenimiento cumplimentados en todos los elementos del sistema de envolvente y de instalaciones.\n3. Informe de auditoría de nomenclatura y parámetros en cada entrega, con cero incidencias de severidad alta.\n4. Entrega de la información del activo 30 días antes de la recepción provisional.',
    },
    {
      key: 'COORDINATES',
      es: 'Sistema de referencia: **UTM zona 20S, datum WGS 84**.\n\n- Punto base compartido: esquina suroeste del eje A-1, coordenadas E 480.250,000 / N 8.035.120,000 / Z +416,500.\n- Norte del proyecto girado 17° respecto al norte real.\n- Unidades: milímetros para modelado, metros para topografía.\n\nTodos los modelos se entregan con el punto base compartido sin desplazar y el origen interno coincidente.',
    },
    {
      key: 'MODEL_STRUCTURE',
      es: 'La información se segmenta en contenedores por disciplina y por volumen:\n\n| Contenedor | Disciplina | Volumen | Responsable |\n| --- | --- | --- | --- |\n| EDI-JSE-ZZ-XX-M3-A-0001 | Arquitectura | Todo el edificio | Equipo de Arquitectura |\n| EDI-EDS-ZZ-XX-M3-S-0001 | Estructuras | Todo el edificio | Equipo de Estructuras |\n| EDI-JSE-ZZ-XX-M3-M-0001 | Instalaciones | Todo el edificio | Equipo de Instalaciones |\n\nEl modelo federado lo mantiene el coordinador BIM y no se modela sobre él.',
    },
    {
      key: 'COORDINATION',
      es: 'Ciclo de coordinación quincenal:\n\n1. **Martes**: cada disciplina publica su modelo en estado Compartido (S1).\n2. **Miércoles**: el coordinador BIM federa y ejecuta la matriz de interferencias.\n3. **Jueves**: reunión ICE de 90 minutos sobre el modelo federado.\n4. **Viernes**: se emiten las incidencias en BCF con responsable y fecha límite.\n\nTolerancias: 0 mm entre estructura e instalaciones, 25 mm entre arquitectura e instalaciones.',
    },
    {
      key: 'QA',
      es: 'Antes de compartir cualquier modelo, la parte designada ejecuta la auditoría de la plataforma y adjunta el informe:\n\n- Nomenclatura de archivo, familias, tipos, vistas y subproyectos conforme a las convenciones activas.\n- Parámetros compartidos obligatorios cumplimentados.\n- Sin elementos fuera del punto base compartido.\n- Sin advertencias críticas de Revit sin justificar.\n\nUn modelo con incidencias de severidad alta no puede pasar a estado Compartido.',
    },
    {
      key: 'CHANGE_CONTROL',
      es: 'Cualquier parte puede proponer un cambio comentando la sección afectada. El gestor de la información evalúa la propuesta, y si procede crea una versión nueva del protocolo en estado Borrador.\n\nUna versión sólo pasa a Aprobado con la conformidad del gestor de la información y de la parte designante. La versión aprobada anterior queda marcada como Sustituida y permanece accesible para auditoría.',
    },
  ]

  const sections = await prisma.protocolSection.findMany({ where: { protocolId } })
  const sectionByKey = new Map(sections.map((section) => [section.key, section.id]))

  for (const entry of prose) {
    const sectionId = sectionByKey.get(entry.key)
    if (!sectionId) continue
    await prisma.sectionContent.update({
      where: { sectionId_locale: { sectionId, locale: 'ES' } },
      data: { body: entry.es, updatedById: ana },
    })
    if (entry.en) {
      await prisma.sectionContent.update({
        where: { sectionId_locale: { sectionId, locale: 'EN' } },
        data: { body: entry.en, updatedById: ana },
      })
    }
  }

  await prisma.sectionComment.create({
    data: {
      sectionId: sectionByKey.get('COORDINATION')!,
      userId: users.get('bruno@demo.test')!,
      body: 'A tolerância de 0 mm entre estrutura e instalações é demasiado exigente para as passagens de tubagem. Proponho 10 mm.',
    },
  })

  console.log(`  demo project: ${project.code} — ${project.name}`)
  console.log(`  users: ${people.map((person) => person.email).join(', ')} (password: ${DEMO_PASSWORD})`)
}

async function main() {
  console.log('Seeding Protocolo BIM…')
  await seedDisciplines()
  await seedTemplate()

  if (SEED_DEMO) {
    await seedDemo()
  } else {
    console.log('  demo data skipped (set SEED_DEMO=true to create it)')
  }

  console.log('Done.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
