import type { RolBackend } from './types.js'

// ==================== ROLES ====================

export const ROLES_AUTO_REGISTRO = [
  'estudiante_pregrado',
  'estudiante_postgrado',
  'investigador',
] as const

export type RolAutoRegistro = (typeof ROLES_AUTO_REGISTRO)[number]

export const ROLES_SOLICITANTE: RolBackend[] = [
  'estudiante_pregrado',
  'estudiante_postgrado',
  'investigador',
  'estudiante',
]

export const ROL_LABEL: Record<RolBackend, string> = {
  administrador: 'Administrador',
  coordinador: 'Coordinador',
  secretaria: 'Secretaría',
  evaluador: 'Evaluador',
  estudiante_pregrado: 'Estudiante de pregrado',
  estudiante_postgrado: 'Estudiante de posgrado',
  investigador: 'Investigador',
  estudiante: 'Estudiante',
}

export function homePathForRole(rol: RolBackend): string {
  if (ROLES_SOLICITANTE.includes(rol)) return '/'
  switch (rol) {
    case 'secretaria':
      return '/secretaria/bandeja'
    case 'coordinador':
      return '/coordinador/dashboard'
    case 'evaluador':
      return '/evaluador/bandeja'
    case 'administrador':
      return '/admin/reportes'
    default:
      return '/'
  }
}

export const ROL_A_MODALIDAD: Record<string, string> = {
  estudiante_pregrado: 'pregrado',
  estudiante_postgrado: 'postgrado',
  investigador: 'interno',
}

// ==================== MODALIDAD / TRÁMITE / ESTADOS ====================

export const MODALIDAD = {
  PREGRADO: 'pregrado',
  POSTGRADO: 'postgrado',
  INTERNO: 'interno',
} as const

export const TIPO_TRAMITE = {
  PROYECTO_NUEVO: 'proyecto_nuevo',
  CAMBIO_TITULO: 'cambio_titulo',
} as const

export const ESTADO_EXPEDIENTE = {
  BORRADOR: 'borrador',
  ENVIADO: 'enviado',
  EN_REVISION: 'en_revision',
  SUBSANACION: 'subsanacion',
  APROBADO: 'aprobado',
  APROBADO_OBSERVACIONES: 'aprobado_observaciones',
  NO_APROBADO: 'no_aprobado',
  ARCHIVADO: 'archivado',
} as const

// ==================== TIPO DE PROYECTO (observación 1 del Comité) ====================
//
// El Comité observó que el sistema no distinguía si lo que se somete a
// evaluación ética es un ARTÍCULO de investigación o una TESIS. En pregrado
// eso depende del ciclo en que va el estudiante: en VII se trabaja el
// artículo y en IX la tesis. Los ciclos VIII y X (y cualquier rol interno)
// quedan SIN preselección: el usuario elige a mano.

export const TIPO_PROYECTO = {
  ARTICULO: 'ARTICULO',
  TESIS: 'TESIS',
  OTRO: 'OTRO',
} as const

export type TipoProyecto = (typeof TIPO_PROYECTO)[keyof typeof TIPO_PROYECTO]

export const TIPOS_PROYECTO: string[] = [
  TIPO_PROYECTO.ARTICULO,
  TIPO_PROYECTO.TESIS,
  TIPO_PROYECTO.OTRO,
]

export const TIPO_PROYECTO_LABEL: Record<string, string> = {
  [TIPO_PROYECTO.ARTICULO]: 'Artículo de investigación',
  [TIPO_PROYECTO.TESIS]: 'Tesis',
  [TIPO_PROYECTO.OTRO]: 'Otro',
}

// Preselección por ciclo. Devuelve `null` cuando NO hay criterio confirmado
// por el Comité (ciclos VIII y X: duda abierta del spec) o cuando el usuario
// no es un estudiante con ciclo.
export const TIPO_PROYECTO_POR_CICLO: Record<string, string> = {
  VII: TIPO_PROYECTO.ARTICULO,
  IX: TIPO_PROYECTO.TESIS,
}

export function tipoProyectoPorCiclo(ciclo: string | null | undefined): string | null {
  if (!ciclo) return null
  return TIPO_PROYECTO_POR_CICLO[ciclo] ?? null
}

// ==================== SIMILITUD Y REENVÍO (observaciones 2, 3 y 4) ====================

// Clave en la tabla `configuracion` con el umbral de similitud de títulos
// (0..1) a partir del cual se alerta a Secretaría. Configurable porque el
// Comité aún no fijó el valor definitivo (duda abierta del spec).
export const CLAVE_UMBRAL_SIMILITUD = 'umbral_similitud_titulo'
export const UMBRAL_SIMILITUD_TITULO_DEFAULT = 0.8

// Tope de envíos por expediente: el original más 2 reenvíos. Al agotarlo, el
// solicitante debe iniciar un proyecto nuevo.
export const MAX_INTENTOS_REENVIO = 3

// Estados desde los que un expediente puede volver a la cola de revisión
// levantando observaciones. `aprobado_observaciones` queda fuera a propósito:
// ese expediente YA está aprobado, sus observaciones no obligan a reenviar.
export const ESTADOS_REENVIABLES: string[] = [
  ESTADO_EXPEDIENTE.NO_APROBADO,
  ESTADO_EXPEDIENTE.SUBSANACION,
]

// ==================== CATÁLOGOS ====================

export const PROGRAMAS_ESTUDIOS = [
  'Enfermería',
  'Psicología',
  'Medicina Humana',
  'Farmacia y Bioquímica',
  'Nutrición y Dietética',
]

export const CICLOS = ['VII', 'VIII', 'IX', 'X']

export const CICLOS_CAMBIO_TITULO = ['VII', 'VIII', 'IX', 'X', 'Egresado']

export const NIVELES_POSGRADO = ['Segunda especialidad', 'Maestría', 'Doctorado']

// ==================== DOCUMENTOS ====================

export const DOC_PROYECTO_PDF = 'proyecto_pdf'
export const DOC_PROYECTO_WORD = 'proyecto_word'
export const DOC_SOLICITUD_EVALUACION = 'solicitud_evaluacion'
export const DOC_CARTA_APROBACION = 'carta_aprobacion'
export const DOC_BOLETA_PAGO = 'boleta_pago'
export const DOC_SOLICITUD_CAMBIO_TITULO = 'solicitud_cambio_titulo'

export const DOCUMENTO_LABELS: Record<string, string> = {
  [DOC_PROYECTO_PDF]: 'Proyecto de investigación (PDF)',
  [DOC_PROYECTO_WORD]: 'Proyecto de investigación (Word)',
  [DOC_SOLICITUD_EVALUACION]: 'Solicitud de evaluación por Comité de Ética (PDF)',
  [DOC_CARTA_APROBACION]: 'Carta de aprobación del docente/asesor (PDF)',
  [DOC_BOLETA_PAGO]: 'Boleta de pago del trámite (PDF o imagen)',
  [DOC_SOLICITUD_CAMBIO_TITULO]: 'Solicitud de cambio de título (PDF)',
}

export const DOCUMENTO_INDICACIONES: Record<string, string[]> = {
  [DOC_PROYECTO_PDF]: [
    'En formato PDF.',
    'Debe cumplir con la estructura establecida por la UCH.',
    'El formato y la estructura los proporciona el docente responsable de la asignatura.',
  ],
  [DOC_PROYECTO_WORD]: ['El mismo proyecto, en formato Word (editable).'],
  [DOC_SOLICITUD_EVALUACION]: [
    'Dirigida al Presidente del Comité de Ética.',
    'Debidamente completada y firmada.',
    'En formato PDF.',
  ],
  [DOC_CARTA_APROBACION]: [
    'El docente/asesor declara que el proyecto es apto para pasar a evaluación ética.',
    'Debe estar firmada por el docente o asesor.',
    'En formato PDF.',
  ],
  [DOC_BOLETA_PAGO]: [
    'Concepto: "Evaluación de proyecto de tesis por Comité de Ética".',
    'Descargada desde la Intranet (ERP).',
    'En formato PDF o imagen.',
  ],
  [DOC_SOLICITUD_CAMBIO_TITULO]: [
    'En formato PDF, debidamente firmada.',
    'Nombra el archivo: ACTA - NÚMERO CAMBIO DE TITULO (APELLIDO o APELLIDOS) – ESCUELA PROFESIONAL.',
  ],
}

export const DOCUMENTO_PLANTILLA: Record<string, { key: string; accion: string; label: string }> = {
  [DOC_SOLICITUD_EVALUACION]: { key: 'solicitud_evaluacion', accion: 'descargar', label: 'Descargar plantilla' },
  [DOC_CARTA_APROBACION]: { key: 'carta_aprobacion', accion: 'descargar', label: 'Descargar plantilla' },
  [DOC_BOLETA_PAGO]: { key: 'guia_pago', accion: 'ver', label: 'Ver guía de pago (ERP)' },
  [DOC_SOLICITUD_CAMBIO_TITULO]: { key: 'cambio_titulo', accion: 'descargar', label: 'Descargar formato (Word)' },
}

export const DOCUMENTOS_REQUERIDOS: Record<string, string[]> = {
  [MODALIDAD.PREGRADO]: [
    DOC_PROYECTO_PDF,
    DOC_PROYECTO_WORD,
    DOC_SOLICITUD_EVALUACION,
    DOC_CARTA_APROBACION,
    DOC_BOLETA_PAGO,
  ],
  [MODALIDAD.POSTGRADO]: [
    DOC_PROYECTO_PDF,
    DOC_PROYECTO_WORD,
    DOC_SOLICITUD_EVALUACION,
    DOC_CARTA_APROBACION,
    DOC_BOLETA_PAGO,
  ],
  [MODALIDAD.INTERNO]: [DOC_PROYECTO_PDF],
}

export const ESTADOS_ELEGIBLE_CAMBIO_TITULO: string[] = [
  ESTADO_EXPEDIENTE.APROBADO,
  ESTADO_EXPEDIENTE.APROBADO_OBSERVACIONES,
]

export const GUIA_NOMBRES = {
  key: 'estructura_nombres',
  label: 'Ver guía: estructura del nombre de los archivos',
  texto:
    'Nombra cada archivo según la estructura del Comité de Ética. Los documentos que no cumplan la nomenclatura no serán considerados en la evaluación.',
}

// ==================== RÚBRICA ====================

// Copiados literalmente del formato oficial del Comité ("Documento 2 —
// FORMATO DE EVALUACIÓN Y DICTAMEN ÉTICO DE PROYECTOS DE INVESTIGACIÓN"):
// mismos nombres, mismas descripciones y mismo reparto de puntajes (3/4/4/2/
// 2/2/3 = 20). Antes el reparto divergía del documento (2/4/4/3/2/3/2), lo
// que hacía que la rúbrica emitida no cuadrara con la plantilla impresa.
export const CRITERIOS_RUBRICA = [
  {
    key: 'valor_pertinencia',
    nombre: 'Valor y pertinencia del estudio',
    descripcion:
      'El proyecto presenta una justificación clara y una contribución académica y social relevante. Cuenta con los recursos necesarios para su implementación, incluyendo financiamiento, infraestructura, tiempo y personal capacitado.',
    puntajeMax: 3,
  },
  {
    key: 'principios_eticos',
    nombre: 'Principios éticos',
    descripcion: 'Respeta los principios de autonomía, beneficencia, no maleficencia y justicia.',
    puntajeMax: 4,
  },
  {
    key: 'consentimiento_informado',
    nombre: 'Consentimiento informado',
    descripcion:
      'El proceso de información y consentimiento es adecuado, claro y voluntario. Presenta el anexo correspondiente.',
    puntajeMax: 4,
  },
  {
    key: 'proteccion_participantes',
    nombre: 'Protección de participantes',
    descripcion: 'Identifica riesgos y establece medidas de protección para los participantes.',
    puntajeMax: 2,
  },
  {
    key: 'poblaciones_vulnerables',
    nombre: 'Poblaciones vulnerables (si aplica)',
    descripcion:
      'El proyecto contempla medidas especiales para proteger a poblaciones vulnerables, como niños, mujeres embarazadas o en periodo de lactancia, personas con enfermedades mentales o discapacidades, comunidades no familiarizadas con conceptos médicos, y aquellos con libertad restringida para tomar decisiones independientes (por ejemplo, presos o estudiantes menores de edad)',
    puntajeMax: 2,
  },
  {
    key: 'confidencialidad_datos',
    nombre: 'Confidencialidad y protección de datos',
    descripcion: 'Garantiza privacidad, anonimato o confidencialidad de la información.',
    puntajeMax: 2,
  },
  {
    key: 'adecuacion_metodologica',
    nombre: 'Adecuación metodológica',
    descripcion:
      'La metodología es robusta, clara y científicamente válida, coherente con los objetivos y no expone innecesariamente a los participantes.',
    puntajeMax: 3,
  },
] as const

export const PUNTAJE_TOTAL_MAX = 20

export const CRITERIOS_MAX_POR_KEY: Record<string, number> = Object.fromEntries(
  CRITERIOS_RUBRICA.map((c) => [c.key, c.puntajeMax]),
)

export type ResultadoEvaluacion = 'aprobado' | 'aprobado_observaciones' | 'no_aprobado'

export function resultadoPorPuntaje(total: number): ResultadoEvaluacion {
  if (total >= 17) return 'aprobado'
  if (total >= 13) return 'aprobado_observaciones'
  return 'no_aprobado'
}
