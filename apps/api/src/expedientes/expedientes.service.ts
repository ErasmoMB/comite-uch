import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '../config/config.service';
import { CLAVE_FECHA_LIMITE, parseFechaLimite } from '../config/fecha-limite.util';
import { huellaAutores, normalizarTexto, similitudTitulos } from '@comite/shared';
import {
  CICLOS,
  CICLOS_CAMBIO_TITULO,
  CLAVE_UMBRAL_SIMILITUD,
  DOCUMENTOS_REQUERIDOS,
  DOCUMENTO_FORMATOS,
  DOCUMENTO_LABELS,
  DOC_SOLICITUD_CAMBIO_TITULO,
  ESTADOS_ELEGIBLE_CAMBIO_TITULO,
  ESTADOS_REENVIABLES,
  ESTADO_EXPEDIENTE,
  GUIA_NOMBRES,
  MAX_INTENTOS_REENVIO,
  MODALIDAD,
  NIVELES_POSGRADO,
  PROGRAMAS_ESTUDIOS,
  ROL_A_MODALIDAD,
  TIPOS_PROYECTO,
  TIPO_PROYECTO_LABEL,
  TIPO_PROYECTO_POR_CICLO,
  TIPO_TRAMITE,
  UMBRAL_SIMILITUD_TITULO_DEFAULT,
  docInfo,
} from './catalogos';
import { CreateExpedienteDto } from './dto/create-expediente.dto';
import { UpdateExpedienteDto } from './dto/update-expediente.dto';
import { CambioTituloDto } from './dto/cambio-titulo.dto';
import { ReenviarDto } from './dto/reenviar.dto';
import { SubsanacionDto } from './dto/subsanacion.dto';
import { UploadDocumentoDto } from './dto/upload-documento.dto';

// Actor autenticado tal como lo deja `JwtStrategy.validate()` en
// `request.user` (mismo tipo que en UsersService/AuthService).
type CurrentUser = { id: number; email: string; rol: string };

// Cliente Prisma "de nivel superior" (PrismaService) o el cliente de
// transacción que `prisma.$transaction(async (tx) => ...)` inyecta en el
// callback. Se distinguen en tiempo de ejecución comprobando si trae
// `$transaction` (el tx interactivo NO lo expone: ver Prisma.TransactionClient).
type PrismaOrTx = PrismaService | Prisma.TransactionClient;

// ==================== FORMA MÍNIMA DE UN EXPEDIENTE PARA VALIDAR ====================
// No se usa el tipo `Expediente` de `@prisma/client` a propósito: las tareas
// futuras (subsanación, evaluación) y los tests unitarios deben poder llamar
// a `validarCompletitud` con objetos planos sin pasar por Prisma.

interface AutorParaValidar {
  apellidosNombres?: string | null;
  codigoEstudiante?: string | null;
  correo?: string | null;
  telefono?: string | null;
}

interface DocumentoParaValidar {
  tipoDocumento: string;
}

export interface ExpedienteParaValidar {
  tipoTramite?: string | null;
  modalidad?: string | null;
  tituloProtocolo?: string | null;
  programaEstudios?: string | null;
  ciclo?: string | null;
  nivelPosgrado?: string | null;
  numeroActa?: string | null;
  tituloAnterior?: string | null;
  tituloNuevo?: string | null;
  autores: AutorParaValidar[];
  documentos: DocumentoParaValidar[];
}

// Devuelve la lista de datos que le faltan a un autor según la modalidad.
// Equivalente a `_autor_incompleto` (routes.py:39-50).
function autorIncompleto(autor: AutorParaValidar, modalidad?: string | null): string[] {
  const faltan: string[] = [];
  if (!(autor.apellidosNombres ?? '').trim()) {
    faltan.push('apellidos y nombres');
  }
  if (!(autor.correo ?? '').trim()) {
    faltan.push('correo');
  }
  if (!(autor.telefono ?? '').trim()) {
    faltan.push('teléfono');
  }
  if (
    (modalidad === MODALIDAD.PREGRADO || modalidad === MODALIDAD.POSTGRADO) &&
    !(autor.codigoEstudiante ?? '').trim()
  ) {
    faltan.push('código de estudiante');
  }
  return faltan;
}

// Devuelve la lista de requisitos faltantes para enviar el trámite.
// Equivalente a `validar_completitud` (routes.py:53-105). Función PURA:
// no toca la base de datos, reutilizada por Tasks 7 (subsanación) y 8
// (evaluación) además de por `ExpedientesService.enviar` en este mismo
// módulo.
export function validarCompletitud(exp: ExpedienteParaValidar): string[] {
  const faltantes: string[] = [];
  const esCambio = exp.tipoTramite === TIPO_TRAMITE.CAMBIO_TITULO;

  let docsRequeridos: string[];

  if (esCambio) {
    if (!(exp.numeroActa ?? '').trim()) {
      faltantes.push('N° de acta');
    }
    if (!(exp.programaEstudios ?? '').trim()) {
      faltantes.push('Programa de estudios');
    }
    if (!(exp.ciclo ?? '').trim()) {
      faltantes.push('Ciclo');
    }
    if (!(exp.tituloAnterior ?? '').trim()) {
      faltantes.push('Título antiguo (original)');
    }
    if (!(exp.tituloNuevo ?? '').trim()) {
      faltantes.push('Nuevo título');
    }
    if (!exp.autores || exp.autores.length === 0) {
      faltantes.push('Al menos un integrante');
    } else {
      for (const a of exp.autores) {
        const falta: string[] = [];
        if (!(a.apellidosNombres ?? '').trim()) {
          falta.push('apellidos y nombres');
        }
        // Igual criterio que autorIncompleto() para proyecto_nuevo: un
        // investigador (modalidad "interno") nunca tiene código de
        // estudiante, así que no se le exige aquí tampoco.
        if (
          (exp.modalidad === MODALIDAD.PREGRADO || exp.modalidad === MODALIDAD.POSTGRADO) &&
          !(a.codigoEstudiante ?? '').trim()
        ) {
          falta.push('código de estudiante');
        }
        if (!(a.correo ?? '').trim()) {
          falta.push('correo');
        }
        if (falta.length) {
          faltantes.push(`Integrante '${a.apellidosNombres || '—'}': falta ${falta.join(', ')}`);
        }
      }
    }
    docsRequeridos = [DOC_SOLICITUD_CAMBIO_TITULO];
  } else {
    if (!(exp.tituloProtocolo ?? '').trim()) {
      faltantes.push('Título del proyecto');
    }
    if (!(exp.programaEstudios ?? '').trim()) {
      faltantes.push('Programa de estudios');
    }
    if (exp.modalidad === MODALIDAD.PREGRADO && !(exp.ciclo ?? '').trim()) {
      faltantes.push('Ciclo');
    }
    if (exp.modalidad === MODALIDAD.POSTGRADO && !(exp.nivelPosgrado ?? '').trim()) {
      faltantes.push('Nivel de posgrado');
    }
    if (!exp.autores || exp.autores.length === 0) {
      faltantes.push('Al menos un autor/integrante');
    } else {
      for (const a of exp.autores) {
        const falta = autorIncompleto(a, exp.modalidad);
        if (falta.length) {
          faltantes.push(`Integrante '${a.apellidosNombres || '—'}': falta ${falta.join(', ')}`);
        }
      }
    }
    docsRequeridos = DOCUMENTOS_REQUERIDOS[exp.modalidad ?? ''] ?? [];
  }

  const presentes = new Set(exp.documentos.map((d) => d.tipoDocumento));
  for (const tipo of docsRequeridos) {
    if (!presentes.has(tipo)) {
      faltantes.push(`Documento: ${DOCUMENTO_LABELS[tipo] ?? tipo}`);
    }
  }
  return faltantes;
}

// Código incremental global por año: 1-2026, 2-2026, ... Se asigna al
// ENVIAR (nunca al crear). Equivalente a `generar_codigo_anual` (routes.py:107-119).
export async function generarCodigoAnual(prisma: PrismaOrTx): Promise<string> {
  const year = new Date().getUTCFullYear();
  const sufijo = `-${year}`;
  const filas = await prisma.expediente.findMany({
    where: { codigoUnico: { endsWith: sufijo } },
    select: { codigoUnico: true },
  });
  let maxN = 0;
  for (const { codigoUnico } of filas) {
    if (!codigoUnico) continue;
    const n = parseInt(codigoUnico.split('-')[0], 10);
    if (!Number.isNaN(n) && n > maxN) {
      maxN = n;
    }
  }
  return `${maxN + 1}-${year}`;
}

// Escribe una fila en HistorialExpediente Y actualiza expediente.estado,
// atómicamente. Equivalente a `actualizar_estado` (routes.py:125-135).
//
// Atomicidad: si `prisma` es el PrismaService de nivel superior, ambas
// escrituras se envuelven en `$transaction`. Si `prisma` ya es un cliente de
// transacción (viene de un `$transaction` externo, ej. `enviar()` más abajo),
// simplemente se ejecutan dentro de esa misma transacción ya atómica —
// anidar transacciones no es necesario ni soportado por Prisma.
export async function actualizarEstado(
  prisma: PrismaOrTx,
  expediente: { id: number; estado?: string | null },
  nuevoEstado: string,
  observaciones?: string | null,
): Promise<void> {
  const estadoAnterior = expediente.estado ?? null;

  const escribir = async (tx: PrismaOrTx) => {
    await tx.historialExpediente.create({
      data: {
        expedienteId: expediente.id,
        estadoAnterior,
        estadoNuevo: nuevoEstado,
        observaciones: observaciones ?? null,
      },
    });
    await tx.expediente.update({
      where: { id: expediente.id },
      data: { estado: nuevoEstado },
    });
  };

  if ('$transaction' in prisma) {
    await prisma.$transaction((tx) => escribir(tx));
  } else {
    await escribir(prisma);
  }
  // Refleja el cambio en el objeto en memoria, igual que Python
  // (`expediente.estado = estado_nuevo` sobre la instancia ORM ya cargada).
  expediente.estado = nuevoEstado;
}

// Forma completa de un expediente con relaciones, tal como se necesita para
// construir la respuesta y para validar completitud/acceso.
const INCLUDE_COMPLETO = {
  investigador: true,
  autores: true,
  documentos: true,
  evaluaciones: true,
} satisfies Prisma.ExpedienteInclude;

type ExpedienteCompleto = Prisma.ExpedienteGetPayload<{ include: typeof INCLUDE_COMPLETO }>;

// ==================== DOCUMENTOS (Task 7) ====================

// Formato amplio de compatibilidad para cuando `tipo_documento` no está en
// el catálogo `DOCUMENTO_FORMATOS`. Equivalente al bloque `else` inline de
// `upload_documento` (routes.py:480-486) — a propósito NO se agrega a
// `catalogos.ts`: en Python tampoco vive en `models/__init__.py` junto al
// resto de catálogos compartidos, es un fallback local del propio handler.
const FORMATO_FALLBACK = {
  mimes: new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ]),
  ext: new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt']),
  desc: 'PDF, DOC, DOCX, XLS, XLSX, TXT',
};

const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB (routes.py:487).

// Detección de Content-Type por extensión, equivalente a
// `mimetypes.guess_type` (routes.py:674/804) para el universo cerrado de
// extensiones que `DOCUMENTO_FORMATOS`/`FORMATO_FALLBACK` permiten subir.
const MIME_POR_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function contentTypeParaArchivo(rutaArchivo: string): string {
  const ext = path.extname(rutaArchivo).toLowerCase();
  return MIME_POR_EXTENSION[ext] ?? 'application/octet-stream';
}

// Forma mínima de un archivo subido por `FileInterceptor` (multer en modo
// memoria, sin `dest`/`storage` -> `MemoryStorage`, igual que `await
// file.read()` de Python que carga todo el contenido en memoria antes de
// subirlo). Se declara un tipo propio en vez de `Express.Multer.File` para
// no acoplar el servicio a los tipos globales de Express/Multer.
export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class ExpedientesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private configService: ConfigService,
  ) {}

  // Forma de respuesta equivalente a `ExpedienteResponse`
  // (comite/backend/app/schemas/__init__.py:120-138).
  private toResponse(exp: ExpedienteCompleto) {
    const investigadorNombre = exp.investigador
      ? `${exp.investigador.nombre} ${exp.investigador.apellido}`.trim()
      : null;

    const ultimaCon = <T extends { fechaEnvio: Date | null; fechaAsignacion: Date | null }>(
      lista: T[],
    ): T | null => {
      if (lista.length === 0) return null;
      return lista.reduce((mejor, actual) => {
        const fechaActual = actual.fechaEnvio ?? actual.fechaAsignacion;
        const fechaMejor = mejor.fechaEnvio ?? mejor.fechaAsignacion;
        return fechaActual && (!fechaMejor || fechaActual > fechaMejor) ? actual : mejor;
      });
    };

    const evaluacionesCompletasRubrica = exp.evaluaciones.filter((e) => e.completa && e.rubricaPdfPath);
    const evaluacionesCompletasDictamen = exp.evaluaciones.filter((e) => e.completa && e.dictamenPdfPath);
    const evaluacionesCompletasResultado = exp.evaluaciones.filter((e) => e.completa && e.resultado);

    return {
      id: exp.id,
      codigoUnico: exp.codigoUnico,
      tituloProtocolo: exp.tituloProtocolo,
      tipoTramite: exp.tipoTramite,
      // Observaciones 1 y 4 del Comité.
      tipoProyecto: exp.tipoProyecto,
      intentos: exp.intentos ?? 1,
      alertaTituloSimilarCodigo: exp.alertaTituloSimilarCodigo,
      alertaTituloSimilarPorcentaje: exp.alertaTituloSimilarPorcentaje,
      facultad: exp.facultad,
      investigadorId: exp.investigadorId,
      investigadorNombre,
      modalidad: exp.modalidad,
      programaEstudios: exp.programaEstudios,
      ciclo: exp.ciclo,
      nivelPosgrado: exp.nivelPosgrado,
      numeroActa: exp.numeroActa,
      tituloAnterior: exp.tituloAnterior,
      tituloNuevo: exp.tituloNuevo,
      proyectoOrigenId: exp.proyectoOrigenId,
      estado: exp.estado,
      fechaEnvio: exp.fechaEnvio,
      autores: exp.autores,
      evaluacionRubricaUrl: ultimaCon(evaluacionesCompletasRubrica)?.rubricaPdfPath ?? null,
      evaluacionDictamenUrl: ultimaCon(evaluacionesCompletasDictamen)?.dictamenPdfPath ?? null,
      evaluacionResultado: ultimaCon(evaluacionesCompletasResultado)?.resultado ?? null,
      // Id de la evaluación que produjo ese resultado. Los PDFs se descargan
      // por `/evaluacion/{id}/descargar-rubrica|dictamen`, así que el
      // solicitante necesita este id para poder bajar su propio dictamen
      // (los campos ...Url de arriba son keys del bucket, no enlaces usables).
      evaluacionId: ultimaCon(evaluacionesCompletasResultado)?.id ?? null,
      createdAt: exp.fechaCreacion,
    };
  }

  // Roles internos que ven TODOS los expedientes en el listado (routes.py:140).
  // Nótese que EVALUADOR queda deliberadamente fuera (igual que en Python):
  // un evaluador solo ve expedientes propios en este endpoint (en la
  // práctica no crea ninguno; su acceso real a expedientes ajenos se maneja
  // por asignación de evaluación, fuera del alcance de esta tarea).
  private readonly ROLES_VEN_TODO = ['administrador', 'coordinador', 'secretaria'];

  // Comprueba acceso de "dueño" para roles externos. Equivalente al patrón
  // repetido en routes.py: `if current_user.rol in ROL_A_MODALIDAD and
  // exp.investigador_id != current_user.id: 403`.
  private assertAccesoPropio(exp: { investigadorId: number }, user: CurrentUser) {
    if (user.rol in ROL_A_MODALIDAD && exp.investigadorId !== user.id) {
      throw new ForbiddenException('No tienes acceso a este expediente');
    }
  }

  // GET /expedientes/ (routes.py:137-142).
  async findAll(user: CurrentUser, skip = 0, limit = 50) {
    const where = this.ROLES_VEN_TODO.includes(user.rol) ? {} : { investigadorId: user.id };
    const expedientes = await this.prisma.expediente.findMany({
      where,
      skip,
      take: limit,
      include: INCLUDE_COMPLETO,
    });
    return expedientes.map((e) => this.toResponse(e));
  }

  // GET /expedientes/catalogos (routes.py:144-162).
  getCatalogos(user: CurrentUser) {
    const modalidad = ROL_A_MODALIDAD[user.rol] ?? null;
    return {
      modalidad,
      programasEstudios: PROGRAMAS_ESTUDIOS,
      ciclos: CICLOS,
      nivelesPosgrado: NIVELES_POSGRADO,
      // Observación 1: catálogo de tipo de proyecto + el mapa ciclo -> tipo
      // que el formulario usa para PRESELECCIONAR (VII -> artículo, IX ->
      // tesis). La preselección se aplica en el cliente y siempre es
      // editable; el backend solo valida que el valor final esté en el
      // catálogo.
      tiposProyecto: TIPOS_PROYECTO.map((valor) => ({
        valor,
        label: TIPO_PROYECTO_LABEL[valor] ?? valor,
      })),
      tipoProyectoPorCiclo: TIPO_PROYECTO_POR_CICLO,
      documentosRequeridos: Object.fromEntries(
        Object.entries(DOCUMENTOS_REQUERIDOS).map(([m, docs]) => [m, docs.map((t) => docInfo(t))]),
      ),
      guiaNombres: GUIA_NOMBRES,
      cambioTitulo: {
        ciclos: CICLOS_CAMBIO_TITULO,
        documento: docInfo(DOC_SOLICITUD_CAMBIO_TITULO),
      },
    };
  }

  // GET /expedientes/{id}/requisitos (routes.py:165-178).
  async getRequisitos(id: number, user: CurrentUser) {
    const exp = await this.prisma.expediente.findUnique({
      where: { id },
      include: { autores: true, documentos: true },
    });
    if (!exp) {
      throw new NotFoundException('Expediente no encontrado');
    }
    this.assertAccesoPropio(exp, user);

    const faltantes = validarCompletitud(exp);
    // Un cambio de título exige "solicitud_cambio_titulo", no la lista de
    // documentos de proyecto_nuevo por modalidad (mismo criterio que
    // validarCompletitud() unas líneas más arriba, que ya distinguía esto
    // pero esta función seguía devolviendo siempre la lista de modalidad).
    const esCambio = exp.tipoTramite === TIPO_TRAMITE.CAMBIO_TITULO;
    const requeridos = esCambio
      ? [docInfo(DOC_SOLICITUD_CAMBIO_TITULO)]
      : (DOCUMENTOS_REQUERIDOS[exp.modalidad ?? ''] ?? []).map((t) => docInfo(t));
    return {
      completo: faltantes.length === 0,
      faltantes,
      documentosRequeridos: requeridos,
    };
  }

  // GET /expedientes/elegibles-cambio-titulo (routes.py:181-208).
  async getElegiblesCambioTitulo(user: CurrentUser) {
    const proyectos = await this.prisma.expediente.findMany({
      where: {
        investigadorId: user.id,
        estado: { in: ESTADOS_ELEGIBLE_CAMBIO_TITULO },
        NOT: { tipoTramite: TIPO_TRAMITE.CAMBIO_TITULO },
      },
      include: { autores: true },
    });
    return proyectos.map((p) => ({
      id: p.id,
      codigo: p.codigoUnico,
      titulo: p.tituloProtocolo,
      estado: p.estado,
      programaEstudios: p.programaEstudios,
      ciclo: p.ciclo,
      autores: [...p.autores]
        .sort((a, b) => (a.orden ?? 1) - (b.orden ?? 1))
        .map((a) => ({
          apellidosNombres: a.apellidosNombres,
          codigoEstudiante: a.codigoEstudiante ?? '',
          correo: a.correo ?? '',
        })),
    }));
  }

  // GET /expedientes/{id} (routes.py:211-218).
  async findOne(id: number, user: CurrentUser) {
    const exp = await this.prisma.expediente.findUnique({
      where: { id },
      include: INCLUDE_COMPLETO,
    });
    if (!exp) {
      throw new NotFoundException('Expediente no encontrado');
    }
    this.assertAccesoPropio(exp, user);
    return this.toResponse(exp);
  }

  // POST /expedientes/ (routes.py:253-298).
  async create(dto: CreateExpedienteDto, user: CurrentUser) {
    // La modalidad se deriva del rol con el que inició sesión (no se confía
    // en el cliente): NUNCA se lee `dto.modalidad` porque ese campo ni
    // siquiera existe en CreateExpedienteDto.
    const modalidad = ROL_A_MODALIDAD[user.rol];
    if (!modalidad) {
      throw new ForbiddenException('Tu rol no puede enviar proyectos al comité.');
    }

    if (dto.programaEstudios && !PROGRAMAS_ESTUDIOS.includes(dto.programaEstudios)) {
      throw new BadRequestException('Programa de estudios no válido.');
    }
    if (dto.ciclo && !CICLOS.includes(dto.ciclo)) {
      throw new BadRequestException('Ciclo no válido.');
    }
    if (dto.nivelPosgrado && !NIVELES_POSGRADO.includes(dto.nivelPosgrado)) {
      throw new BadRequestException('Nivel de posgrado no válido.');
    }
    if (dto.tipoProyecto && !TIPOS_PROYECTO.includes(dto.tipoProyecto)) {
      throw new BadRequestException('Tipo de proyecto no válido.');
    }

    const autores = dto.autores ?? [];
    const nuevoId = await this.prisma.$transaction(async (tx) => {
      const nuevo = await tx.expediente.create({
        data: {
          tituloProtocolo: dto.tituloProtocolo,
          tipoTramite: dto.tipoTramite || TIPO_TRAMITE.PROYECTO_NUEVO,
          // Observación 1: el tipo de proyecto llega ya resuelto desde el
          // formulario (preseleccionado por ciclo, o elegido a mano cuando el
          // ciclo no determina uno). Si el cliente no lo manda, queda null y
          // el expediente se puede completar después.
          tipoProyecto: dto.tipoProyecto ?? null,
          // Observación 4: primer envío del expediente.
          intentos: 1,
          facultad: dto.facultad ?? null,
          modalidad,
          programaEstudios: dto.programaEstudios ?? null,
          // Cada campo solo aplica a su modalidad.
          ciclo: modalidad === MODALIDAD.PREGRADO ? (dto.ciclo ?? null) : null,
          nivelPosgrado: modalidad === MODALIDAD.POSTGRADO ? (dto.nivelPosgrado ?? null) : null,
          investigadorId: user.id,
          estado: ESTADO_EXPEDIENTE.BORRADOR,
          codigoUnico: null, // el código formal N-AÑO se asigna recién al enviar
        },
      });

      for (let i = 0; i < autores.length; i++) {
        const autor = autores[i];
        await tx.autorExpediente.create({
          data: {
            expedienteId: nuevo.id,
            orden: i + 1,
            apellidosNombres: autor.apellidosNombres,
            codigoEstudiante: modalidad !== MODALIDAD.INTERNO ? (autor.codigoEstudiante ?? null) : null,
            correo: autor.correo ?? null,
            telefono: autor.telefono ?? null,
            esPrincipal: i === 0,
          },
        });
      }

      await tx.bitacora.create({
        data: {
          expedienteId: nuevo.id,
          accion: 'Expediente creado',
          detalle: `Título: ${dto.tituloProtocolo}`,
          usuarioId: user.id,
        },
      });

      return nuevo.id;
    });

    return this.findOne(nuevoId, user);
  }

  // POST /expedientes/cambio-titulo (routes.py:300-354).
  async createCambioTitulo(dto: CambioTituloDto, user: CurrentUser) {
    const modalidad = ROL_A_MODALIDAD[user.rol];
    if (!modalidad) {
      throw new ForbiddenException('Tu rol no puede solicitar un cambio de título.');
    }
    if (!PROGRAMAS_ESTUDIOS.includes(dto.programaEstudios)) {
      throw new BadRequestException('Programa de estudios no válido.');
    }
    if (!CICLOS_CAMBIO_TITULO.includes(dto.ciclo)) {
      throw new BadRequestException('Ciclo no válido.');
    }

    // El proyecto origen debe ser del usuario y estar aprobado (con o sin
    // observaciones).
    const origen = await this.prisma.expediente.findUnique({
      where: { id: dto.proyectoOrigenId },
    });
    if (!origen || origen.investigadorId !== user.id) {
      throw new NotFoundException('Proyecto de origen no encontrado.');
    }
    if (!ESTADOS_ELEGIBLE_CAMBIO_TITULO.includes(origen.estado ?? '')) {
      throw new BadRequestException('Solo puedes solicitar cambio de título de un proyecto aprobado.');
    }

    // El N° de acta se deriva del código del proyecto origen (ej. "1-2026" -> "1").
    const numeroActa = (origen.codigoUnico ?? '').split('-')[0] || null;

    const autores = dto.autores ?? [];
    const nuevoId = await this.prisma.$transaction(async (tx) => {
      const nuevo = await tx.expediente.create({
        data: {
          // El título del proyecto pasa a ser el nuevo título (para listados).
          tituloProtocolo: dto.tituloNuevo,
          tipoTramite: TIPO_TRAMITE.CAMBIO_TITULO,
          modalidad,
          programaEstudios: dto.programaEstudios,
          ciclo: dto.ciclo,
          numeroActa,
          tituloAnterior: origen.tituloProtocolo, // autollenado desde el proyecto origen
          tituloNuevo: dto.tituloNuevo,
          proyectoOrigenId: origen.id,
          investigadorId: user.id,
          estado: ESTADO_EXPEDIENTE.BORRADOR,
          codigoUnico: null,
        },
      });

      for (let i = 0; i < autores.length; i++) {
        const autor = autores[i];
        await tx.autorExpediente.create({
          data: {
            expedienteId: nuevo.id,
            orden: i + 1,
            apellidosNombres: autor.apellidosNombres,
            codigoEstudiante: autor.codigoEstudiante ?? null,
            correo: autor.correo ?? null,
            telefono: null, // el cambio de título no pide teléfono
            esPrincipal: i === 0,
          },
        });
      }

      await tx.bitacora.create({
        data: {
          expedienteId: nuevo.id,
          accion: 'Solicitud de cambio de título creada',
          detalle: `Nuevo título: ${dto.tituloNuevo}`,
          usuarioId: user.id,
        },
      });

      return nuevo.id;
    });

    return this.findOne(nuevoId, user);
  }

  // PUT /expedientes/{id} (routes.py:357-375).
  //
  // DIVERGENCIA INTENCIONAL Y AUTORIZADA respecto a Python (decisión del
  // usuario, NO un descuido de paridad): el `update_expediente` de
  // referencia (routes.py:357-375) NO valida dueño en absoluto — mientras el
  // expediente está en BORRADOR, cualquier usuario autenticado (incluidos
  // roles externos/solicitantes que no fueran el autor) podía editar el
  // expediente de OTRO usuario, incluso forzando `estado` a mano. Un
  // reviewer detectó el hueco y el usuario pidió explícitamente cerrarlo
  // aquí aunque eso diverja del Python real. Se reutiliza el mismo patrón de
  // "acceso propio" que ya usan `findOne`/`getRequisitos`
  // (`assertAccesoPropio`): los roles externos (los que están en
  // ROL_A_MODALIDAD) solo pueden editar SU PROPIO expediente, sin importar
  // el estado. Los roles internos conservan exactamente el mismo acceso que
  // ya tenían (sin chequeo de dueño aquí), igual que en Python.
  async update(id: number, dto: UpdateExpedienteDto, user: CurrentUser) {
    const exp = await this.prisma.expediente.findUnique({ where: { id } });
    if (!exp) {
      throw new NotFoundException('Expediente no encontrado');
    }
    // FIX DE SEGURIDAD (ver nota arriba del método): dueño obligatorio para
    // roles externos, sin importar el estado.
    this.assertAccesoPropio(exp, user);

    // Solo se bloquea para roles "externos" (los que están en
    // ROL_A_MODALIDAD); los roles internos SIEMPRE pueden editar sin
    // importar el estado (igual que Python: `current_user.rol in
    // ROL_A_MODALIDAD`).
    if (exp.estado !== ESTADO_EXPEDIENTE.BORRADOR && user.rol in ROL_A_MODALIDAD) {
      throw new ForbiddenException('No puedes modificar un expediente enviado');
    }

    // Los catálogos se validan igual que en `create`: el cliente manda el
    // texto del programa/ciclo, no un id, así que hay que confirmarlo contra
    // la lista o entraría cualquier cosa a la base.
    if (dto.programaEstudios && !PROGRAMAS_ESTUDIOS.includes(dto.programaEstudios)) {
      throw new BadRequestException('Programa de estudios no válido.');
    }
    if (dto.ciclo && !CICLOS.includes(dto.ciclo)) {
      throw new BadRequestException('Ciclo no válido.');
    }
    if (dto.nivelPosgrado && !NIVELES_POSGRADO.includes(dto.nivelPosgrado)) {
      throw new BadRequestException('Nivel de posgrado no válido.');
    }
    if (dto.tipoProyecto && !TIPOS_PROYECTO.includes(dto.tipoProyecto)) {
      throw new BadRequestException('Tipo de proyecto no válido.');
    }

    // Editar datos del proyecto/autores solo tiene sentido mientras el
    // expediente no salió del escritorio del solicitante: una vez enviado, el
    // expediente ya está en el circuito del Comité y sus datos son parte del
    // trámite. (El bloqueo por rol de arriba solo cubre roles externos; esto
    // vale también para los internos.)
    const editaDatos =
      dto.programaEstudios !== undefined ||
      dto.ciclo !== undefined ||
      dto.nivelPosgrado !== undefined ||
      dto.autores !== undefined;
    if (editaDatos && exp.estado !== ESTADO_EXPEDIENTE.BORRADOR) {
      throw new ForbiddenException(
        'Los datos del proyecto y sus autores solo se pueden editar mientras el expediente está en borrador.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {};
      if (dto.tituloProtocolo) {
        data.tituloProtocolo = dto.tituloProtocolo;
      }
      if (dto.tipoTramite !== undefined) {
        data.tipoTramite = dto.tipoTramite;
      }
      if (dto.facultad !== undefined) {
        data.facultad = dto.facultad;
      }
      // Observación 1: el tipo de proyecto es corregible por el solicitante
      // (la preselección por ciclo es solo una sugerencia).
      if (dto.tipoProyecto !== undefined) {
        data.tipoProyecto = dto.tipoProyecto || null;
      }
      if (dto.programaEstudios !== undefined) {
        data.programaEstudios = dto.programaEstudios || null;
      }
      // Cada campo solo aplica a su modalidad, mismo criterio que `create`.
      if (dto.ciclo !== undefined) {
        data.ciclo = exp.modalidad === MODALIDAD.PREGRADO ? dto.ciclo || null : null;
      }
      if (dto.nivelPosgrado !== undefined) {
        data.nivelPosgrado = exp.modalidad === MODALIDAD.POSTGRADO ? dto.nivelPosgrado || null : null;
      }
      if (Object.keys(data).length > 0) {
        await tx.expediente.update({ where: { id }, data });
      }

      // Reemplazo completo: el formulario edita la lista entera y la reenvía.
      // Borrar + recrear (en vez de diff por id) mantiene `orden` y
      // `esPrincipal` coherentes con el orden que mandó el cliente, sin
      // arrastrar filas huérfanas de un autor que se quitó.
      if (dto.autores !== undefined) {
        await tx.autorExpediente.deleteMany({ where: { expedienteId: id } });
        for (let i = 0; i < dto.autores.length; i++) {
          const autor = dto.autores[i];
          await tx.autorExpediente.create({
            data: {
              expedienteId: id,
              orden: i + 1,
              apellidosNombres: autor.apellidosNombres,
              codigoEstudiante:
                exp.modalidad !== MODALIDAD.INTERNO ? (autor.codigoEstudiante ?? null) : null,
              correo: autor.correo ?? null,
              telefono: autor.telefono ?? null,
              esPrincipal: i === 0,
            },
          });
        }
      }
      if (editaDatos) {
        await tx.bitacora.create({
          data: {
            expedienteId: id,
            accion: 'Datos del borrador actualizados',
            detalle: null,
            usuarioId: user.id,
          },
        });
      }
      if (dto.estado) {
        await actualizarEstado(tx, exp, dto.estado);
        await tx.bitacora.create({
          data: {
            expedienteId: id,
            accion: `Estado cambiado a ${dto.estado}`,
            detalle: null,
            usuarioId: user.id,
          },
        });
      }
    });

    return this.findOne(id, user);
  }

  // DELETE /expedientes/{id} (routes.py:377-395).
  async remove(id: number, user: CurrentUser) {
    const exp = await this.prisma.expediente.findUnique({ where: { id } });
    if (!exp) {
      throw new NotFoundException('Proyecto no encontrado');
    }
    // A diferencia de update/enviar, aquí el chequeo de dueño NO está
    // condicionado a `ROL_A_MODALIDAD`: es incondicional para cualquier rol
    // (igual que Python: `if exp.investigador_id != current_user.id: 403`).
    if (exp.investigadorId !== user.id) {
      throw new ForbiddenException('Solo el autor puede eliminar su proyecto.');
    }
    if (exp.estado !== ESTADO_EXPEDIENTE.BORRADOR) {
      throw new BadRequestException('Solo puedes eliminar proyectos en estado borrador.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.documento.deleteMany({ where: { expedienteId: id } });
      await tx.autorExpediente.deleteMany({ where: { expedienteId: id } });
      await tx.bitacora.deleteMany({ where: { expedienteId: id } });
      await tx.historialExpediente.deleteMany({ where: { expedienteId: id } });
      await tx.expediente.delete({ where: { id } });
    });

    return { message: 'Proyecto eliminado' };
  }

  // ==================== OBSERVACIONES DEL COMITÉ (2026-09-07) ====================
  //
  // Estados que cuentan como "expediente vivo en el sistema" para comparar
  // contra un envío nuevo. Un expediente `borrador` todavía no entró al
  // circuito (nadie lo vio) y uno `archivado` ya salió: ninguno de los dos
  // debe disparar alerta ni rechazo.
  private readonly ESTADOS_ACTIVOS = [
    ESTADO_EXPEDIENTE.ENVIADO,
    ESTADO_EXPEDIENTE.EN_REVISION,
    ESTADO_EXPEDIENTE.SUBSANACION,
    ESTADO_EXPEDIENTE.APROBADO,
    ESTADO_EXPEDIENTE.APROBADO_OBSERVACIONES,
  ];

  // Umbral de similitud de títulos (0..1). Configurable en la tabla
  // `configuracion` porque el Comité aún no fijó el valor definitivo; si la
  // clave no existe o tiene basura, se usa el default del catálogo (0.8).
  private async leerUmbralSimilitud(): Promise<number> {
    const guardado = await this.configService.leerConfig(CLAVE_UMBRAL_SIMILITUD);
    const valor = guardado !== null ? Number(guardado) : NaN;
    if (!Number.isFinite(valor) || valor <= 0 || valor > 1) {
      return UMBRAL_SIMILITUD_TITULO_DEFAULT;
    }
    return valor;
  }

  // Trae los expedientes activos (excepto el propio `id`) con sus autores,
  // que es el universo contra el que se compara un envío.
  private async expedientesActivos(excluirId: number) {
    return this.prisma.expediente.findMany({
      where: {
        id: { not: excluirId },
        estado: { in: this.ESTADOS_ACTIVOS },
      },
      select: {
        id: true,
        codigoUnico: true,
        tituloProtocolo: true,
        ciclo: true,
        facultad: true,
        programaEstudios: true,
        autores: { select: { apellidosNombres: true } },
      },
    });
  }

  // OBSERVACIÓN 3 — duplicado EXACTO (tras normalizar): mismo título, mismo
  // conjunto de autores, mismo ciclo y misma facultad/programa. Los cuatro
  // criterios deben coincidir; con que uno difiera, ya no es el mismo
  // expediente y a lo sumo cae en la alerta de similitud.
  private buscarDuplicadoExacto<T extends { id: number; codigoUnico: string | null; tituloProtocolo: string; ciclo: string | null; facultad: string | null; programaEstudios: string | null; autores: { apellidosNombres: string }[] }>(
    exp: {
      tituloProtocolo: string;
      ciclo: string | null;
      facultad: string | null;
      programaEstudios: string | null;
      autores: { apellidosNombres: string }[];
    },
    candidatos: T[],
  ): T | null {
    const titulo = normalizarTexto(exp.tituloProtocolo);
    const autores = huellaAutores(exp.autores);
    const ciclo = normalizarTexto(exp.ciclo);
    const facultad = normalizarTexto(exp.facultad);
    const programa = normalizarTexto(exp.programaEstudios);

    // Un expediente sin autores cargados no puede considerarse "el mismo"
    // que otro: la huella vacía haría coincidir cualquier par de títulos
    // iguales de personas distintas.
    if (!autores) return null;

    return (
      candidatos.find(
        (c) =>
          normalizarTexto(c.tituloProtocolo) === titulo &&
          huellaAutores(c.autores) === autores &&
          normalizarTexto(c.ciclo) === ciclo &&
          normalizarTexto(c.facultad) === facultad &&
          normalizarTexto(c.programaEstudios) === programa,
      ) ?? null
    );
  }

  // OBSERVACIÓN 2 — títulos SIMILARES por encima del umbral, ordenados de
  // más a menos parecido.
  private buscarSimilares<T extends { id: number; codigoUnico: string | null; tituloProtocolo: string }>(
    titulo: string,
    candidatos: T[],
    umbral: number,
  ): { expediente: T; similitud: number }[] {
    return candidatos
      .map((c) => ({ expediente: c, similitud: similitudTitulos(titulo, c.tituloProtocolo) }))
      .filter((r) => r.similitud >= umbral)
      .sort((a, b) => b.similitud - a.similitud);
  }

  private etiquetaExpediente(exp: { id: number; codigoUnico: string | null }): string {
    return exp.codigoUnico ? `#${exp.codigoUnico}` : `#${exp.id}`;
  }

  // POST /expedientes/{id}/enviar (routes.py:398-435).
  //
  // Ampliado con las observaciones 2 y 3 del Comité: antes de dar el envío
  // por bueno se compara el expediente contra los que ya están activos.
  //  - Duplicado exacto -> rechazo automático (`no_aprobado`), sin pasar por
  //    revisión, y se notifica al solicitante.
  //  - Título muy similar -> el envío CONTINÚA normal, y se notifica a
  //    Secretaría para que lo mire.
  async enviar(id: number, user: CurrentUser) {
    const exp = await this.prisma.expediente.findUnique({
      where: { id },
      include: { autores: true, documentos: true },
    });
    if (!exp) {
      throw new NotFoundException('Expediente no encontrado');
    }
    if (exp.investigadorId !== user.id) {
      throw new ForbiddenException('No tienes acceso');
    }
    if (exp.estado !== ESTADO_EXPEDIENTE.BORRADOR) {
      throw new BadRequestException('El proyecto ya fue enviado');
    }

    // La fecha límite global aplica solo a proyectos nuevos, NO al cambio de
    // título (routes.py:407-420). Si no hay fecha configurada, o la cadena
    // guardada no se puede parsear, no se aplica ningún límite (mismo
    // comportamiento que el `except ValueError: pass` de Python) -- ver
    // parseFechaLimite() para el detalle de por qué la comparación de
    // instantes es equivalente a la de Python pese a no usar tzinfo.
    const fechaLimiteStr = await this.configService.leerConfig(CLAVE_FECHA_LIMITE);
    if (fechaLimiteStr && exp.tipoTramite !== TIPO_TRAMITE.CAMBIO_TITULO) {
      const limite = parseFechaLimite(fechaLimiteStr);
      if (limite && new Date() > limite) {
        throw new ForbiddenException(
          'Los envíos están cerrados: la fecha límite ya venció.',
        );
      }
    }

    // No se permite enviar un expediente incompleto.
    const faltantes = validarCompletitud(exp);
    if (faltantes.length > 0) {
      throw new BadRequestException({
        mensaje: 'El proyecto está incompleto. Completa lo siguiente antes de enviar.',
        faltantes,
      });
    }

    // El cambio de título es, por definición, un trámite sobre un proyecto
    // que YA existe aprobado: compararlo contra los expedientes activos daría
    // siempre "duplicado" del propio origen. Las observaciones 2 y 3 aplican
    // solo a proyectos nuevos.
    const aplicaControlDuplicados = exp.tipoTramite !== TIPO_TRAMITE.CAMBIO_TITULO;
    const candidatos = aplicaControlDuplicados ? await this.expedientesActivos(id) : [];

    // ---- OBSERVACIÓN 3: rechazo automático por duplicado exacto ----
    const duplicado = aplicaControlDuplicados ? this.buscarDuplicadoExacto(exp, candidatos) : null;
    if (duplicado) {
      const etiqueta = this.etiquetaExpediente(duplicado);
      const motivo = `Duplicado exacto del expediente ${etiqueta}: mismo título, mismos autores, mismo ciclo y mismo programa/facultad.`;

      await this.prisma.$transaction(async (tx) => {
        // Se le asigna igual su código formal: el expediente existe y queda
        // registrado como rechazado, no desaparece del sistema.
        let codigoUnico = exp.codigoUnico;
        if (!codigoUnico) {
          codigoUnico = await generarCodigoAnual(tx);
          await tx.expediente.update({ where: { id }, data: { codigoUnico } });
        }
        await tx.expediente.update({ where: { id }, data: { fechaEnvio: new Date() } });
        await actualizarEstado(tx, exp, ESTADO_EXPEDIENTE.NO_APROBADO, motivo);
        await tx.bitacora.create({
          data: {
            expedienteId: id,
            accion: 'Rechazo automático por duplicado exacto',
            detalle: motivo,
            usuarioId: user.id,
          },
        });
        await tx.notificacion.create({
          data: {
            usuarioId: exp.investigadorId,
            expedienteId: id,
            titulo: 'Proyecto rechazado automáticamente (duplicado)',
            mensaje: `Tu proyecto no fue admitido porque coincide exactamente con el expediente ${etiqueta} ya registrado. Si se trata de una corrección de ese proyecto, gestiónala desde el expediente original.`,
            leida: false,
          },
        });
      });

      return {
        message: motivo,
        codigo: exp.codigoUnico,
        rechazoAutomatico: true,
        duplicadoDeId: duplicado.id,
      };
    }

    // ---- OBSERVACIÓN 2: alerta de título similar (NO bloquea) ----
    const umbral = aplicaControlDuplicados ? await this.leerUmbralSimilitud() : 1;
    const similares = aplicaControlDuplicados
      ? this.buscarSimilares(exp.tituloProtocolo, candidatos, umbral)
      : [];

    const codigo = await this.prisma.$transaction(async (tx) => {
      // Asignar el código formal incremental del año recién al enviar.
      let codigoUnico = exp.codigoUnico;
      if (!codigoUnico) {
        codigoUnico = await generarCodigoAnual(tx);
        await tx.expediente.update({ where: { id }, data: { codigoUnico } });
      }
      await actualizarEstado(tx, exp, ESTADO_EXPEDIENTE.ENVIADO);
      await tx.expediente.update({ where: { id }, data: { fechaEnvio: new Date() } });
      await tx.bitacora.create({
        data: {
          expedienteId: id,
          accion: 'Expediente enviado formalmente',
          detalle: null,
          usuarioId: user.id,
        },
      });
      return codigoUnico;
    });

    let alertaSimilitud: { expedienteId: number; codigo: string | null; similitud: number } | null = null;
    if (similares.length > 0) {
      alertaSimilitud = await this.alertarSecretariaPorSimilitud(id, exp.tituloProtocolo, similares, umbral);
    } else if (exp.alertaTituloSimilarCodigo) {
      // Un reenvío sin parecidos no debe conservar la alerta de un envío anterior.
      await this.prisma.expediente.update({
        where: { id },
        data: { alertaTituloSimilarCodigo: null, alertaTituloSimilarPorcentaje: null },
      });
    }

    return { message: 'Expediente enviado exitosamente', codigo, alertaSimilitud };
  }

  // OBSERVACIÓN 2 — deja constancia en el historial del expediente y crea
  // una notificación por cada usuaria con rol `secretaria` activa. Se hace
  // FUERA de la transacción del envío a propósito: la alerta es informativa
  // y su fallo no debe revertir un envío ya válido.
  private async alertarSecretariaPorSimilitud(
    expedienteId: number,
    titulo: string,
    similares: { expediente: { id: number; codigoUnico: string | null; tituloProtocolo: string }; similitud: number }[],
    umbral: number,
  ) {
    const mejor = similares[0];
    const etiqueta = this.etiquetaExpediente(mejor.expediente);
    const porcentaje = Math.round(mejor.similitud * 100);
    const detalle =
      `Título similar (${porcentaje}%, umbral ${Math.round(umbral * 100)}%) al del expediente ${etiqueta}: ` +
      `"${mejor.expediente.tituloProtocolo}".` +
      (similares.length > 1 ? ` Hay ${similares.length - 1} coincidencia(s) adicional(es).` : '');

    await this.prisma.historialExpediente.create({
      data: {
        expedienteId,
        estadoAnterior: ESTADO_EXPEDIENTE.ENVIADO,
        estadoNuevo: ESTADO_EXPEDIENTE.ENVIADO,
        observaciones: `Alerta automática: ${detalle}`,
      },
    });

    const secretarias = await this.prisma.user.findMany({
      where: { rol: 'secretaria', NOT: { activo: false } },
      select: { id: true },
    });
    if (secretarias.length > 0) {
      await this.prisma.notificacion.createMany({
        data: secretarias.map((s) => ({
          usuarioId: s.id,
          expedienteId,
          titulo: 'Posible título similar a un expediente existente',
          mensaje: `El proyecto "${titulo}" ingresó con un ${detalle}`,
          leida: false,
        })),
      });
    }

    // Se guarda también en el propio expediente (no solo en el historial y
    // la notificación) para que la bandeja de Secretaría pueda pintar un
    // aviso en la fila sin tener que abrir cada expediente a leer su
    // historial.
    await this.prisma.expediente.update({
      where: { id: expedienteId },
      data: {
        alertaTituloSimilarCodigo: etiqueta.replace(/^#/, ''),
        alertaTituloSimilarPorcentaje: porcentaje,
      },
    });

    return {
      expedienteId: mejor.expediente.id,
      codigo: mejor.expediente.codigoUnico,
      similitud: mejor.similitud,
    };
  }

  // GET /expedientes/{id}/bitacora (routes.py:437-440).
  //
  // NOTA de paridad: el Python de referencia NO comprueba dueño/rol aquí
  // (cualquier usuario autenticado puede leer la bitácora de CUALQUIER
  // expediente por id). Se replica ese mismo comportamiento a propósito
  // (la tarea pide portar 1:1), aunque a simple vista parece un hueco de
  // autorización respecto al resto de endpoints — señalado también en el
  // reporte de esta tarea como posible seguimiento.
  async getBitacora(id: number) {
    return this.prisma.bitacora.findMany({
      where: { expedienteId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        accion: true,
        detalle: true,
        createdAt: true,
      },
    });
  }

  // GET /expedientes/{id}/historial (routes.py:442-445). Misma nota de
  // paridad que getBitacora: Python tampoco valida dueño/rol aquí.
  async getHistorial(id: number) {
    return this.prisma.historialExpediente.findMany({
      where: { expedienteId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // POST /expedientes/{id}/subsanacion (routes.py:855-905).
  //
  // NOTA de paridad (igual que getBitacora/getHistorial arriba): el Python de
  // referencia NO valida dueño/rol aquí — cualquier usuario autenticado
  // puede enviar la subsanación de CUALQUIER expediente en estado
  // SUBSANACION. Se replica ese mismo comportamiento a propósito (no fue
  // señalado como hueco a corregir en esta tarea, a diferencia del fix
  // explícito y autorizado que sí se hizo en `update()`).
  //
  // FIX aplicado hoy (2026-07-04) al Python real y replicado aquí: la
  // subsanación REINGRESA el expediente a la cola de revisión (estado
  // `enviado`), igual que un envío nuevo. Antes del fix, el bug dejaba el
  // expediente pegado en `subsanacion` (solo se registraba en bitácora, sin
  // llamar a `actualizar_estado`) — comportamiento buggy que NO se
  // reimplementa aquí.
  async submitSubsanacion(id: number, dto: SubsanacionDto, user: CurrentUser) {
    const exp = await this.prisma.expediente.findUnique({ where: { id } });
    if (!exp) {
      throw new NotFoundException('Expediente no encontrado');
    }
    if (exp.estado !== ESTADO_EXPEDIENTE.SUBSANACION) {
      throw new BadRequestException(
        `El proyecto debe estar en estado SUBSANACION. Estado actual: ${exp.estado}`,
      );
    }

    // OBSERVACIÓN 4: la subsanación es un reenvío como cualquier otro, así
    // que consume un intento y respeta el tope de 3. Se delega en la misma
    // rutina que `reenviar` para no tener dos caminos que reingresan un
    // expediente a la cola con reglas distintas.
    const intentos = await this.reingresarACola(exp, dto.observaciones, user, {
      accionBitacora: 'Subsanación respondida',
      observacionHistorial: 'Subsanación reenviada por el investigador',
    });

    return {
      mensaje: 'Subsanación registrada correctamente. El proyecto vuelve a la cola de revisión.',
      expedienteId: id,
      estado: exp.estado,
      intentos,
      fechaSubsanacion: new Date(),
    };
  }

  // ==================== OBSERVACIÓN 4: REENVÍO CON TOPE DE 3 INTENTOS ====================

  // Núcleo compartido por `reenviar` y `submitSubsanacion`: verifica el tope
  // de intentos, incrementa el contador y devuelve el expediente a la cola de
  // revisión (`enviado`), todo en una sola transacción. Devuelve el número de
  // intento resultante.
  //
  // El chequeo de estado NO vive aquí: cada punto de entrada tiene el suyo
  // (`subsanacion` exige estado SUBSANACION con su mensaje propio; `reenviar`
  // acepta cualquier estado de ESTADOS_REENVIABLES).
  private async reingresarACola(
    exp: { id: number; estado: string | null; intentos: number | null },
    observaciones: string,
    user: CurrentUser,
    textos: { accionBitacora: string; observacionHistorial: string },
  ): Promise<number> {
    const intentosActuales = exp.intentos ?? 1;
    if (intentosActuales >= MAX_INTENTOS_REENVIO) {
      throw new BadRequestException(
        `Este proyecto ya agotó los ${MAX_INTENTOS_REENVIO} intentos permitidos. Debes iniciar un proyecto nuevo.`,
      );
    }
    const nuevosIntentos = intentosActuales + 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.bitacora.create({
        data: {
          expedienteId: exp.id,
          accion: textos.accionBitacora,
          detalle: `Intento ${nuevosIntentos} de ${MAX_INTENTOS_REENVIO}. Observaciones levantadas: ${observaciones.slice(0, 500)}`,
          usuarioId: user.id,
        },
      });
      await actualizarEstado(
        tx,
        exp,
        ESTADO_EXPEDIENTE.ENVIADO,
        `${textos.observacionHistorial} (intento ${nuevosIntentos} de ${MAX_INTENTOS_REENVIO}): ${observaciones.slice(0, 500)}`,
      );
      await tx.expediente.update({
        where: { id: exp.id },
        data: { intentos: nuevosIntentos, fechaEnvio: new Date() },
      });
    });

    return nuevosIntentos;
  }

  // POST /expedientes/{id}/reenviar. El solicitante levanta las observaciones
  // de un expediente rechazado (`no_aprobado`) o observado (`subsanacion`) y
  // lo devuelve a la cola, hasta un máximo de 3 envíos por expediente.
  async reenviar(id: number, dto: ReenviarDto, user: CurrentUser) {
    const exp = await this.prisma.expediente.findUnique({ where: { id } });
    if (!exp) {
      throw new NotFoundException('Expediente no encontrado');
    }
    // A diferencia de `submitSubsanacion` (que replica la falta de chequeo
    // del Python de referencia), este endpoint es nuevo y sí valida dueño:
    // reenviar consume un intento del expediente de otra persona.
    if (exp.investigadorId !== user.id) {
      throw new ForbiddenException('Solo el autor puede reenviar su proyecto.');
    }
    if (!ESTADOS_REENVIABLES.includes(exp.estado ?? '')) {
      throw new BadRequestException(
        'Solo puedes reenviar un proyecto que fue rechazado o que tiene observaciones por levantar.',
      );
    }

    const intentos = await this.reingresarACola(exp, dto.observaciones, user, {
      accionBitacora: 'Observaciones levantadas y proyecto reenviado',
      observacionHistorial: 'Reenvío del solicitante tras levantar observaciones',
    });

    return {
      mensaje: 'Proyecto reenviado. Vuelve a la cola de revisión del Comité.',
      expedienteId: id,
      estado: ESTADO_EXPEDIENTE.ENVIADO,
      intentos,
      intentosMaximos: MAX_INTENTOS_REENVIO,
    };
  }

  // GET /expedientes/mis-rechazados. Vista "Mis proyectos rechazados": los
  // expedientes PROPIOS que fueron rechazados o tienen observaciones, con las
  // observaciones a levantar (historial de estado + evaluaciones) y si aún
  // queda margen para reenviar.
  async getMisRechazados(user: CurrentUser) {
    const expedientes = await this.prisma.expediente.findMany({
      where: {
        investigadorId: user.id,
        estado: { in: ESTADOS_REENVIABLES },
      },
      orderBy: { fechaEnvio: 'desc' },
      include: {
        historial: { orderBy: { createdAt: 'desc' } },
        evaluaciones: { orderBy: { fechaEnvio: 'desc' } },
      },
    });

    return expedientes.map((exp) => {
      const intentos = exp.intentos ?? 1;
      const puedeReenviar = intentos < MAX_INTENTOS_REENVIO;

      const observaciones: { origen: string; texto: string; fecha: string | null }[] = [];
      for (const h of exp.historial) {
        if (!h.observaciones?.trim()) continue;
        // Las alertas automáticas de similitud van dirigidas a Secretaría, no
        // son observaciones que el solicitante deba levantar.
        if (h.observaciones.startsWith('Alerta automática:')) continue;
        observaciones.push({
          origen: 'Comité / Secretaría',
          texto: h.observaciones,
          fecha: h.createdAt ? h.createdAt.toISOString() : null,
        });
      }
      for (const ev of exp.evaluaciones) {
        if (!ev.completa || !ev.observaciones?.trim()) continue;
        observaciones.push({
          origen: 'Evaluador',
          texto: ev.observaciones,
          fecha: ev.fechaEnvio ? ev.fechaEnvio.toISOString() : null,
        });
      }

      return {
        id: exp.id,
        codigoUnico: exp.codigoUnico,
        tituloProtocolo: exp.tituloProtocolo,
        estado: exp.estado,
        tipoProyecto: exp.tipoProyecto,
        programaEstudios: exp.programaEstudios,
        ciclo: exp.ciclo,
        fechaEnvio: exp.fechaEnvio,
        intentos,
        intentosMaximos: MAX_INTENTOS_REENVIO,
        puedeReenviar,
        motivoBloqueo: puedeReenviar
          ? null
          : `Agotaste los ${MAX_INTENTOS_REENVIO} intentos de este proyecto. Para continuar debes registrar un proyecto nuevo.`,
        observaciones,
      };
    });
  }

  // POST /expedientes/{id}/documentos (routes.py:447-573).
  //
  // NOTA de paridad: el Python de referencia tampoco valida dueño/rol aquí
  // (solo existencia + estado del expediente); se replica igual.
  //
  // DIVERGENCIA intencional respecto a Python: no se implementa el fallback a
  // disco local (routes.py:546-557) — este backend NestJS no corre con un
  // filesystem persistente compartido, y la tarea no lo pide; si
  // `StorageService.putObject` falla, el error se propaga tal cual (500),
  // en vez de degradar silenciosamente a un disco que nadie más puede leer.
  async uploadDocumento(id: number, file: ArchivoSubido, dto: UploadDocumentoDto, user: CurrentUser) {
    const tipoDocumento = dto.tipoDocumento ?? 'documento';
    const esObligatorio = dto.esObligatorio ?? true;

    const formato = DOCUMENTO_FORMATOS[tipoDocumento] ?? FORMATO_FALLBACK;

    // El navegador manda el nombre del archivo en UTF-8, pero la librería que
    // parsea el multipart lo entrega interpretado como latin1: "Carta de
    // aprobación.pdf" se guardaba como "Carta de aprobaciÃ³n.pdf" y así se
    // veía en la lista de documentos del evaluador. Se corrige aquí, en el
    // único punto por el que entra un archivo.
    const nombreOriginal = Buffer.from(file.originalname, 'latin1').toString('utf8');

    // Validar extensión (criterio principal; el MIME del navegador no
    // siempre es fiable) — routes.py:489-496.
    const ext = path.extname(nombreOriginal).toLowerCase();
    if (!formato.ext.has(ext)) {
      throw new BadRequestException(
        `Este documento solo admite: ${formato.desc}. Subiste un archivo ${ext || 'sin extensión'}.`,
      );
    }

    // Validar MIME type (si el cliente lo envía) — routes.py:498-503.
    if (file.mimetype && !formato.mimes.has(file.mimetype)) {
      throw new BadRequestException(`Este documento solo admite: ${formato.desc}.`);
    }

    // Validar tamaño — routes.py:505-511.
    if (file.size > TAMANO_MAXIMO_BYTES) {
      throw new BadRequestException(
        `Archivo muy grande. Máximo permitido: 10 MB, tamaño del archivo: ${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      );
    }

    const exp = await this.prisma.expediente.findUnique({ where: { id } });
    if (!exp) {
      throw new NotFoundException('Expediente no encontrado');
    }
    if (exp.estado !== ESTADO_EXPEDIENTE.BORRADOR && exp.estado !== ESTADO_EXPEDIENTE.SUBSANACION) {
      throw new BadRequestException('No puedes agregar documentos en este estado');
    }

    // Nombre único para evitar conflictos, igual que Python
    // (`{stem}_{uuid4().hex[:8]}{ext}`) — routes.py:527-529.
    const extension = path.extname(nombreOriginal);
    const stem = path.basename(nombreOriginal, extension);
    const nombreUnico = `${stem}_${randomBytes(4).toString('hex')}${extension}`;
    const key = `uploads/${id}/${nombreUnico}`;

    await this.storage.putObject(key, file.buffer, file.mimetype);

    return this.prisma.$transaction(async (tx) => {
      const doc = await tx.documento.create({
        data: {
          expedienteId: id,
          nombreArchivo: nombreOriginal,
          tipoDocumento,
          esObligatorio,
          rutaArchivo: key,
        },
      });
      await tx.bitacora.create({
        data: {
          expedienteId: id,
          accion: 'Documento subido',
          detalle: `Archivo: ${nombreOriginal} (MIME: ${file.mimetype}, Tamaño: ${file.size} bytes)`,
          usuarioId: user.id,
        },
      });
      return doc;
    });
  }

  // GET /expedientes/{id}/documentos (routes.py:576-593).
  async getDocumentos(id: number, user: CurrentUser) {
    const exp = await this.prisma.expediente.findUnique({ where: { id } });
    if (!exp) {
      throw new NotFoundException('Expediente no encontrado');
    }
    this.assertAccesoPropio(exp, user);
    return this.prisma.documento.findMany({ where: { expedienteId: id } });
  }

  // Chequeo de acceso compartido por descargar/preview (routes.py:638-649 y
  // 770-779): dueño para roles externos, Y ADEMÁS evaluador asignado para el
  // rol `evaluador` (a diferencia de `assertAccesoPropio` a secas, que ya
  // usan findOne/getRequisitos/getDocumentos). El Task 8 (módulo Evaluación)
  // aún no tiene endpoints propios, pero la tabla `evaluaciones` ya existe en
  // el schema, así que se consulta directo por Prisma como pide la tarea.
  private async assertAccesoDocumento(
    exp: { investigadorId: number },
    expedienteId: number,
    user: CurrentUser,
  ) {
    this.assertAccesoPropio(exp, user);
    if (user.rol === 'evaluador') {
      const evaluacion = await this.prisma.evaluacion.findFirst({
        where: { expedienteId, evaluadorId: user.id },
      });
      if (!evaluacion) {
        throw new ForbiddenException('No tienes acceso a este expediente');
      }
    }
  }

  private async obtenerDocumentoParaServir(expedienteId: number, documentoId: number, user: CurrentUser) {
    const exp = await this.prisma.expediente.findUnique({ where: { id: expedienteId } });
    if (!exp) {
      throw new NotFoundException('Expediente no encontrado');
    }
    await this.assertAccesoDocumento(exp, expedienteId, user);

    const doc = await this.prisma.documento.findFirst({
      where: { id: documentoId, expedienteId },
    });
    if (!doc) {
      throw new NotFoundException('Documento no encontrado');
    }
    if (!doc.rutaArchivo) {
      throw new BadRequestException('Documento sin ruta de archivo');
    }

    let buffer: Buffer;
    try {
      buffer = await this.storage.getObjectBuffer(doc.rutaArchivo);
    } catch {
      // Documentos subidos en la época en que las subidas caían al disco local
      // (antes de tener almacenamiento en la nube) apuntan a un archivo que
      // nunca llegó al bucket -- el objeto simplemente no está ahí. Sin este
      // catch, el SDK de S3 tira un error crudo que el filtro global de
      // excepciones convierte en un 500 opaco.
      throw new NotFoundException(
        'El archivo de este documento no está disponible: fue subido antes de migrar a almacenamiento en la nube.',
      );
    }
    return {
      buffer,
      contentType: contentTypeParaArchivo(doc.rutaArchivo),
      nombreArchivo: doc.nombreArchivo,
    };
  }

  // GET /expedientes/{id}/documentos/{documento_id}/descargar (routes.py:614-725).
  // Sirve el archivo con Content-Disposition: attachment (se arma en el
  // controller, que es quien tiene acceso a la respuesta HTTP cruda).
  async descargarDocumento(expedienteId: number, documentoId: number, user: CurrentUser) {
    const resultado = await this.obtenerDocumentoParaServir(expedienteId, documentoId, user);
    await this.prisma.bitacora.create({
      data: {
        expedienteId,
        accion: 'Documento descargado',
        detalle: `Documento: ${resultado.nombreArchivo} (ID: ${documentoId})`,
        usuarioId: user.id,
      },
    });
    return resultado;
  }

  // GET /expedientes/{id}/documentos/{documento_id}/preview (routes.py:744-854).
  // Misma lógica que descargar, pero Content-Disposition: inline.
  async previewDocumento(expedienteId: number, documentoId: number, user: CurrentUser) {
    const resultado = await this.obtenerDocumentoParaServir(expedienteId, documentoId, user);
    await this.prisma.bitacora.create({
      data: {
        expedienteId,
        accion: 'Documento previsualizado',
        detalle: `Archivo: ${resultado.nombreArchivo} (ID: ${documentoId})`,
        usuarioId: user.id,
      },
    });
    return resultado;
  }
}
