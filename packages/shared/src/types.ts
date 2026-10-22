import type { ResultadoEvaluacion } from './constants.js'

export type RolBackend =
  | 'administrador'
  | 'coordinador'
  | 'secretaria'
  | 'evaluador'
  | 'estudiante_pregrado'
  | 'estudiante_postgrado'
  | 'investigador'
  | 'estudiante'

export type EstadoExpediente =
  | 'borrador'
  | 'enviado'
  | 'en_revision'
  | 'subsanacion'
  | 'aprobado'
  | 'aprobado_observaciones'
  | 'no_aprobado'
  | 'archivado'

export interface UserDto {
  id: number
  email: string
  nombre: string
  apellido: string
  rol: RolBackend
  activo: boolean | null
  especialidad: string | null
  cargaTrabajo: number | null
  conflictoInteres: boolean | null
  codigoEstudiante: string | null
  laboratorio: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface AutorExpedienteDto {
  id?: number
  orden: number
  apellidosNombres: string
  codigoEstudiante: string | null
  correo: string | null
  telefono: string | null
  esPrincipal: boolean
}

export interface ExpedienteDto {
  id: number
  codigoUnico: string | null
  tituloProtocolo: string
  investigadorId: number
  investigadorNombre?: string | null
  tipoTramite: string | null
  // Observación 1 del Comité: ARTICULO | TESIS | OTRO.
  tipoProyecto: string | null
  // Observación 4: envíos consumidos por este expediente (empieza en 1).
  intentos: number | null
  // Observación 2: título similar detectado al enviar. Presente solo si se
  // disparó la alerta; se usa para pintar un aviso en la bandeja de
  // Secretaría sin tener que abrir el expediente.
  alertaTituloSimilarCodigo: string | null
  alertaTituloSimilarPorcentaje: number | null
  facultad: string | null
  modalidad: string | null
  programaEstudios: string | null
  ciclo: string | null
  nivelPosgrado: string | null
  numeroActa: string | null
  tituloAnterior: string | null
  tituloNuevo: string | null
  proyectoOrigenId: number | null
  estado: EstadoExpediente
  fechaEnvio: string | null
  createdAt: string | null
  updatedAt: string | null
  autores?: AutorExpedienteDto[]
  investigador?: UserDto
  // Resultado de la última evaluación completada del expediente. `...Url` son
  // en realidad KEYS del bucket (no enlaces navegables): para descargar hay
  // que usar `/evaluacion/{evaluacionId}/descargar-rubrica|dictamen`.
  evaluacionId?: number | null
  evaluacionResultado?: ResultadoEvaluacion | null
  evaluacionRubricaUrl?: string | null
  evaluacionDictamenUrl?: string | null
}

export interface DocumentoDto {
  id: number
  expedienteId: number
  nombreArchivo: string
  tipoDocumento: string
  rutaArchivo: string
  version: number
  esObligatorio: boolean
  validado: boolean
  createdAt: string
}

export interface BitacoraDto {
  id: number
  expedienteId: number
  accion: string
  detalle: string | null
  createdAt: string
}

export interface HistorialDto {
  id: number
  expedienteId: number
  estadoAnterior: string | null
  estadoNuevo: string
  observaciones: string | null
  createdAt: string
}

export interface PlantillaInfo {
  key: string
  accion: 'descargar' | 'ver'
  label: string
}

export interface TipoDocumentoInfo {
  tipo: string
  label: string
  indicaciones: string[]
  plantilla: PlantillaInfo | null
}

export interface GuiaNombresDto {
  key: string
  label: string
  texto: string
}

export interface RequisitosDto {
  completo: boolean
  faltantes: string[]
  documentosRequeridos: TipoDocumentoInfo[]
}

// Un expediente rechazado/observado tal como lo devuelve
// `GET /expedientes/mis-rechazados` (observación 4).
export interface ExpedienteRechazadoDto {
  id: number
  codigoUnico: string | null
  tituloProtocolo: string
  estado: EstadoExpediente
  tipoProyecto: string | null
  programaEstudios: string | null
  ciclo: string | null
  fechaEnvio: string | null
  intentos: number
  intentosMaximos: number
  puedeReenviar: boolean
  motivoBloqueo: string | null
  // Observaciones que el solicitante debe levantar: las del historial de
  // estado más las que dejaron los evaluadores.
  observaciones: { origen: string; texto: string; fecha: string | null }[]
}

export interface CatalogosDto {
  modalidad: string | null
  programasEstudios: string[]
  ciclos: string[]
  nivelesPosgrado: string[]
  tiposProyecto: { valor: string; label: string }[]
  tipoProyectoPorCiclo: Record<string, string>
  documentosRequeridos: Record<string, TipoDocumentoInfo[]>
  guiaNombres: GuiaNombresDto
  cambioTitulo: {
    ciclos: string[]
    documento: TipoDocumentoInfo
  }
}

export interface ElegibleCambioTituloDto {
  id: number
  codigo: string | null
  titulo: string
  estado: EstadoExpediente
  programaEstudios: string | null
  ciclo: string | null
  autores: { apellidosNombres: string; codigoEstudiante: string; correo: string }[]
}

export interface EvaluacionCriterioDto {
  id?: number
  criterioKey: string
  puntaje: number | null
  observacion: string | null
}

export interface EvaluacionDto {
  id: number
  expedienteId: number
  evaluadorId: number
  recommendation: string | null
  observaciones: string | null
  completa: boolean
  conflictoInteres: boolean
  fechaAsignacion: string | null
  fechaEnvio: string | null
  puntajeTotal: number | null
  resultado: string | null
  rubricaPdfPath: string | null
  dictamenPdfPath: string | null
  criterios?: EvaluacionCriterioDto[]
  expediente?: ExpedienteDto
  evaluador?: UserDto
}

export interface CriterioRubrica {
  key: string
  nombre: string
  descripcion: string
  puntajeMax: number
}

export interface RubricaDto {
  criterios: CriterioRubrica[]
  puntajeTotalMax: number
  umbrales: { aprobado: string; aprobado_observaciones: string; no_aprobado: string }
}

export interface NotificacionDto {
  id: number
  usuarioId: number
  expedienteId: number | null
  titulo: string
  mensaje: string
  leida: boolean
  createdAt: string
}

export interface MensajeChatDto {
  id: number
  solicitanteId: number
  autorId: number
  texto: string
  leido: boolean
  createdAt: string
  esDeSecretaria?: boolean
}

export interface SolicitanteChatDto {
  id: number
  nombre: string
  rol: RolBackend
  email: string
  codigoEstudiante: string | null
}

export interface ConversacionChatDto {
  solicitanteId: number
  nombre: string
  rol: RolBackend
  email: string
  codigoEstudiante: string | null
  ultimoMensaje: string | null
  ultimaFecha: string | null
  noLeidos: number
}

export interface FechaLimiteDto {
  fechaLimite: string | null
}
