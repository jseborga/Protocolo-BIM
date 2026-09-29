import type { LocalizedText } from '@/server/naming/types'

/**
 * Revit vocabulary shared by the server and the add-in.
 *
 * Every identifier here is a real member of the Revit 2026 API — BuiltInCategory,
 * SpecTypeId, GroupTypeId — and the add-in's build compiles a file referencing
 * each one, so a typo fails the build instead of failing on a user's machine.
 */

const t = (es: string, en: string, pt: string): LocalizedText => ({ es, en, pt })

export interface RevitCategory {
  /** BuiltInCategory member name. */
  id: string
  group: 'ARCHITECTURE' | 'STRUCTURE' | 'MEP' | 'SITE' | 'DOCUMENTATION' | 'SPACES'
  labels: LocalizedText
}

/** Categories a shared parameter can be bound to from the web. */
export const REVIT_CATEGORIES: RevitCategory[] = [
  { id: 'OST_Walls', group: 'ARCHITECTURE', labels: t('Muros', 'Walls', 'Paredes') },
  { id: 'OST_Doors', group: 'ARCHITECTURE', labels: t('Puertas', 'Doors', 'Portas') },
  { id: 'OST_Windows', group: 'ARCHITECTURE', labels: t('Ventanas', 'Windows', 'Janelas') },
  { id: 'OST_Floors', group: 'ARCHITECTURE', labels: t('Suelos', 'Floors', 'Pisos') },
  { id: 'OST_Roofs', group: 'ARCHITECTURE', labels: t('Cubiertas', 'Roofs', 'Coberturas') },
  { id: 'OST_Ceilings', group: 'ARCHITECTURE', labels: t('Techos', 'Ceilings', 'Tetos') },
  { id: 'OST_Stairs', group: 'ARCHITECTURE', labels: t('Escaleras', 'Stairs', 'Escadas') },
  { id: 'OST_StairsRailing', group: 'ARCHITECTURE', labels: t('Barandillas', 'Railings', 'Guarda-corpos') },
  { id: 'OST_Columns', group: 'ARCHITECTURE', labels: t('Pilares arquitectónicos', 'Architectural columns', 'Pilares arquitetónicos') },
  { id: 'OST_CurtainWallPanels', group: 'ARCHITECTURE', labels: t('Paneles de muro cortina', 'Curtain panels', 'Painéis de fachada-cortina') },
  { id: 'OST_CurtainWallMullions', group: 'ARCHITECTURE', labels: t('Montantes de muro cortina', 'Curtain wall mullions', 'Montantes de fachada-cortina') },
  { id: 'OST_Furniture', group: 'ARCHITECTURE', labels: t('Mobiliario', 'Furniture', 'Mobiliário') },
  { id: 'OST_Casework', group: 'ARCHITECTURE', labels: t('Mobiliario fijo', 'Casework', 'Marcenaria') },
  { id: 'OST_GenericModel', group: 'ARCHITECTURE', labels: t('Modelos genéricos', 'Generic models', 'Modelos genéricos') },
  { id: 'OST_SpecialityEquipment', group: 'ARCHITECTURE', labels: t('Equipos especiales', 'Specialty equipment', 'Equipamentos especiais') },
  { id: 'OST_StructuralColumns', group: 'STRUCTURE', labels: t('Pilares estructurales', 'Structural columns', 'Pilares estruturais') },
  { id: 'OST_StructuralFraming', group: 'STRUCTURE', labels: t('Armazón estructural', 'Structural framing', 'Vigamento estrutural') },
  { id: 'OST_StructuralFoundation', group: 'STRUCTURE', labels: t('Cimentación', 'Structural foundations', 'Fundações') },
  { id: 'OST_Rebar', group: 'STRUCTURE', labels: t('Armaduras', 'Structural rebar', 'Armaduras') },
  { id: 'OST_MechanicalEquipment', group: 'MEP', labels: t('Equipos mecánicos', 'Mechanical equipment', 'Equipamentos mecânicos') },
  { id: 'OST_DuctCurves', group: 'MEP', labels: t('Conductos', 'Ducts', 'Condutas') },
  { id: 'OST_DuctFitting', group: 'MEP', labels: t('Uniones de conducto', 'Duct fittings', 'Acessórios de conduta') },
  { id: 'OST_DuctTerminal', group: 'MEP', labels: t('Terminales de aire', 'Air terminals', 'Terminais de ar') },
  { id: 'OST_PipeCurves', group: 'MEP', labels: t('Tuberías', 'Pipes', 'Tubagens') },
  { id: 'OST_PipeFitting', group: 'MEP', labels: t('Uniones de tubería', 'Pipe fittings', 'Acessórios de tubagem') },
  { id: 'OST_PipeAccessory', group: 'MEP', labels: t('Accesorios de tubería', 'Pipe accessories', 'Acessórios de tubagem') },
  { id: 'OST_PlumbingFixtures', group: 'MEP', labels: t('Aparatos sanitarios', 'Plumbing fixtures', 'Loiças sanitárias') },
  { id: 'OST_Sprinklers', group: 'MEP', labels: t('Rociadores', 'Sprinklers', 'Aspersores') },
  { id: 'OST_ElectricalEquipment', group: 'MEP', labels: t('Equipos eléctricos', 'Electrical equipment', 'Equipamentos elétricos') },
  { id: 'OST_ElectricalFixtures', group: 'MEP', labels: t('Aparatos eléctricos', 'Electrical fixtures', 'Aparelhos elétricos') },
  { id: 'OST_LightingFixtures', group: 'MEP', labels: t('Luminarias', 'Lighting fixtures', 'Luminárias') },
  { id: 'OST_CableTray', group: 'MEP', labels: t('Bandejas de cables', 'Cable trays', 'Caminhos de cabos') },
  { id: 'OST_Conduit', group: 'MEP', labels: t('Tubos eléctricos', 'Conduits', 'Tubos elétricos') },
  { id: 'OST_FireAlarmDevices', group: 'MEP', labels: t('Detección de incendios', 'Fire alarm devices', 'Deteção de incêndio') },
  { id: 'OST_Toposolid', group: 'SITE', labels: t('Toposólidos', 'Toposolids', 'Toposólidos') },
  { id: 'OST_Planting', group: 'SITE', labels: t('Vegetación', 'Planting', 'Vegetação') },
  { id: 'OST_Parking', group: 'SITE', labels: t('Aparcamiento', 'Parking', 'Estacionamento') },
  { id: 'OST_Site', group: 'SITE', labels: t('Emplazamiento', 'Site', 'Implantação') },
  { id: 'OST_Rooms', group: 'SPACES', labels: t('Habitaciones', 'Rooms', 'Divisões') },
  { id: 'OST_MEPSpaces', group: 'SPACES', labels: t('Espacios', 'Spaces', 'Espaços') },
  { id: 'OST_Areas', group: 'SPACES', labels: t('Áreas', 'Areas', 'Áreas') },
  { id: 'OST_Sheets', group: 'DOCUMENTATION', labels: t('Planos', 'Sheets', 'Folhas') },
  { id: 'OST_Views', group: 'DOCUMENTATION', labels: t('Vistas', 'Views', 'Vistas') },
  { id: 'OST_ProjectInformation', group: 'DOCUMENTATION', labels: t('Información del proyecto', 'Project information', 'Informação do projeto') },
]

export const REVIT_CATEGORY_IDS = new Set(REVIT_CATEGORIES.map((category) => category.id))

export interface RevitDataType {
  /** Protocol identifier, stored in SharedParameterDef.dataType. */
  id: string
  /** SpecTypeId member path used by the add-in. */
  spec: string
  /**
   * DATATYPE written in a shared parameter file. Revit 2024–2026 still write
   * and read the legacy upper-case names here, never ForgeTypeId strings.
   */
  fileType: string
  labels: LocalizedText
}

export const REVIT_DATA_TYPES: RevitDataType[] = [
  { id: 'TEXT', spec: 'String.Text', fileType: 'TEXT', labels: t('Texto', 'Text', 'Texto') },
  { id: 'MULTILINE_TEXT', spec: 'String.MultilineText', fileType: 'MULTILINETEXT', labels: t('Texto multilínea', 'Multiline text', 'Texto multilinha') },
  { id: 'URL', spec: 'String.Url', fileType: 'URL', labels: t('URL', 'URL', 'URL') },
  { id: 'INTEGER', spec: 'Int.Integer', fileType: 'INTEGER', labels: t('Entero', 'Integer', 'Inteiro') },
  { id: 'NUMBER', spec: 'Number', fileType: 'NUMBER', labels: t('Número', 'Number', 'Número') },
  { id: 'LENGTH', spec: 'Length', fileType: 'LENGTH', labels: t('Longitud', 'Length', 'Comprimento') },
  { id: 'AREA', spec: 'Area', fileType: 'AREA', labels: t('Área', 'Area', 'Área') },
  { id: 'VOLUME', spec: 'Volume', fileType: 'VOLUME', labels: t('Volumen', 'Volume', 'Volume') },
  { id: 'ANGLE', spec: 'Angle', fileType: 'ANGLE', labels: t('Ángulo', 'Angle', 'Ângulo') },
  { id: 'YESNO', spec: 'Boolean.YesNo', fileType: 'YESNO', labels: t('Sí/No', 'Yes/No', 'Sim/Não') },
  { id: 'CURRENCY', spec: 'Currency', fileType: 'CURRENCY', labels: t('Moneda', 'Currency', 'Moeda') },
]

export const REVIT_DATA_TYPE_IDS = new Set(REVIT_DATA_TYPES.map((type) => type.id))

export interface RevitPaletteGroup {
  /** Protocol identifier, stored in SharedParameterDef.paletteGroup. */
  id: string
  /** GroupTypeId member used by the add-in when binding. */
  groupTypeId: string
  labels: LocalizedText
}

/** Where a bound parameter appears in the Properties palette. */
export const REVIT_PALETTE_GROUPS: RevitPaletteGroup[] = [
  { id: 'IDENTITY_DATA', groupTypeId: 'IdentityData', labels: t('Datos de identidad', 'Identity data', 'Dados de identidade') },
  { id: 'DATA', groupTypeId: 'Data', labels: t('Datos', 'Data', 'Dados') },
  { id: 'GENERAL', groupTypeId: 'General', labels: t('General', 'General', 'Geral') },
  { id: 'TEXT', groupTypeId: 'Text', labels: t('Texto', 'Text', 'Texto') },
  { id: 'CONSTRUCTION', groupTypeId: 'Construction', labels: t('Construcción', 'Construction', 'Construção') },
  { id: 'IFC', groupTypeId: 'Ifc', labels: t('Parámetros IFC', 'IFC parameters', 'Parâmetros IFC') },
]

export const REVIT_PALETTE_GROUP_IDS = new Set(REVIT_PALETTE_GROUPS.map((group) => group.id))
