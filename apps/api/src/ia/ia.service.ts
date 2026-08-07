import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DOCUMENTO_LABELS } from '@comite/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PROVEEDOR_IA, type ProveedorIa } from './proveedor-ia';
import {
  ESQUEMA_RUBRICA,
  normalizarSugerencias,
  promptRubrica,
  type RespuestaRubrica,
  type SugerenciaCriterio,
} from './rubrica.prompt';

type CurrentUser = { id: number; email: string; rol: string };

// Mismo criterio que EvaluacionService: los roles internos ven todos los
// expedientes, así que también pueden usar el asistente sobre cualquiera.
const ROLES_VEN_TODO = ['administrador', 'coordinador', 'secretaria'];

// El borrador de rúbrica se calcula SIEMPRE sobre el proyecto de investigación:
// es el único documento sobre el que se juzga la ética del estudio. El chat sí
// deja elegir, porque ahí el evaluador puede querer verificar la carta del
// asesor o la solicitud.
const TIPO_DOC_PROYECTO = 'proyecto_pdf';

// Gemini recibe el archivo tal cual, así que solo se ofrecen los formatos que
// sabe leer. El Word queda fuera a propósito: la API no lo acepta y mandarlo
// devolvería un error del proveedor en vez de una respuesta útil. No es una
// pérdida real -- el mismo proyecto está subido en PDF.
const MIME_POR_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  txt: 'text/plain',
};

function mimeDe(nombreArchivo: string): string | null {
  const ext = nombreArchivo.split('.').pop()?.toLowerCase() ?? '';
  return MIME_POR_EXTENSION[ext] ?? null;
}

export interface DocumentoConsultable {
  id: number;
  tipoDocumento: string;
  /** Etiqueta oficial del tipo, ej. "Carta de aprobación del docente/asesor (PDF)". */
  label: string;
  nombreArchivo: string;
}

export interface SugerenciaRubrica {
  criterios: SugerenciaCriterio[];
  modelo: string;
  generadaEn: string;
  /** true si viene de la base y no se volvió a llamar al modelo. */
  desdeCache: boolean;
}

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    @Inject(PROVEEDOR_IA) private ia: ProveedorIa,
  ) {}

  estaDisponible(): boolean {
    return this.ia.estaConfigurado();
  }

  // ==================== acceso ====================

  /**
   * El asistente trabaja sobre documentos con datos personales y sobre el juicio
   * ético del comité: solo el evaluador asignado y los roles internos. El dueño
   * del expediente queda FUERA a propósito -- no debe poder pedirle a la IA que
   * evalúe su propio proyecto.
   */
  private assertPuedeUsarIa(ev: { evaluadorId: number }, user: CurrentUser) {
    if (ROLES_VEN_TODO.includes(user.rol)) return;
    if (ev.evaluadorId === user.id) return;
    throw new ForbiddenException('No tienes acceso a esta evaluación.');
  }

  private async getEvaluacion(id: number) {
    const ev = await this.prisma.evaluacion.findUnique({
      where: { id },
      include: { expediente: true },
    });
    if (!ev) throw new NotFoundException('Evaluación no encontrada');
    return ev;
  }

  // ==================== documentos ====================

  private async bajarDeR2(ruta: string, queEs: string): Promise<Buffer> {
    try {
      return await this.storage.getObjectBuffer(ruta);
    } catch {
      throw new ConflictException(`${queEs} no está disponible en el almacenamiento.`);
    }
  }

  /** Descarga de R2 el proyecto de investigación del expediente. */
  private async descargarProyecto(expedienteId: number): Promise<Buffer> {
    const doc = await this.prisma.documento.findFirst({
      where: { expedienteId, tipoDocumento: TIPO_DOC_PROYECTO },
      orderBy: { id: 'desc' },
    });
    if (!doc?.rutaArchivo) {
      throw new ConflictException(
        'Este expediente no tiene cargado el proyecto de investigación en PDF, así que no hay nada que analizar.',
      );
    }
    return this.bajarDeR2(doc.rutaArchivo, 'El proyecto de investigación');
  }

  /**
   * Documentos del expediente sobre los que se puede preguntar.
   *
   * Se listan aparte de los documentos del expediente porque no todos sirven:
   * hace falta que estén subidos de verdad y en un formato que el modelo lea.
   * El más nuevo de cada tipo gana, igual que en el resto del sistema.
   */
  async listarDocumentos(
    expedienteId: number,
    user: CurrentUser,
  ): Promise<DocumentoConsultable[]> {
    const ev = await this.prisma.evaluacion.findFirst({ where: { expedienteId } });
    if (!ev) throw new NotFoundException('Este expediente no tiene una evaluación asignada.');
    this.assertPuedeUsarIa(ev, user);

    const docs = await this.prisma.documento.findMany({
      where: { expedienteId },
      orderBy: { id: 'desc' },
    });

    const vistos = new Set<string>();
    const lista: DocumentoConsultable[] = [];
    for (const d of docs) {
      if (!d.rutaArchivo || vistos.has(d.tipoDocumento)) continue;
      if (!mimeDe(d.nombreArchivo)) continue;
      vistos.add(d.tipoDocumento);
      lista.push({
        id: d.id,
        tipoDocumento: d.tipoDocumento,
        label: DOCUMENTO_LABELS[d.tipoDocumento] ?? d.tipoDocumento,
        nombreArchivo: d.nombreArchivo,
      });
    }

    // El proyecto primero: es el que el evaluador consulta casi siempre y el
    // que queda seleccionado por defecto en la interfaz.
    lista.sort((a, b) =>
      a.tipoDocumento === TIPO_DOC_PROYECTO ? -1 : b.tipoDocumento === TIPO_DOC_PROYECTO ? 1 : 0,
    );
    return lista;
  }

  /** Baja el documento elegido, validando que sea de ESTE expediente. */
  private async descargarElegido(
    expedienteId: number,
    documentoId: number,
  ): Promise<{ buffer: Buffer; mime: string; label: string }> {
    const doc = await this.prisma.documento.findUnique({ where: { id: documentoId } });
    // El expedienteId va en la condición y no solo en la búsqueda: sin eso,
    // cualquiera con acceso a UN expediente podría leer documentos de otro
    // pasando un id ajeno.
    if (!doc || doc.expedienteId !== expedienteId) {
      throw new NotFoundException('Ese documento no pertenece a este expediente.');
    }
    const mime = doc.rutaArchivo ? mimeDe(doc.nombreArchivo) : null;
    if (!doc.rutaArchivo || !mime) {
      throw new ConflictException('Ese documento no se puede consultar con el asistente.');
    }
    const label = DOCUMENTO_LABELS[doc.tipoDocumento] ?? doc.nombreArchivo;
    return { buffer: await this.bajarDeR2(doc.rutaArchivo, `El documento "${label}"`), mime, label };
  }

  // ==================== borrador de rúbrica ====================

  async sugerirRubrica(
    evaluacionId: number,
    user: CurrentUser,
    regenerar = false,
  ): Promise<SugerenciaRubrica> {
    const ev = await this.getEvaluacion(evaluacionId);
    this.assertPuedeUsarIa(ev, user);

    // Reutiliza lo ya generado: evita pagar dos veces el mismo análisis cuando
    // el evaluador recarga la pantalla.
    if (!regenerar) {
      const guardada = await this.prisma.sugerenciaIa.findUnique({
        where: { evaluacionId },
      });
      if (guardada) {
        return {
          criterios: guardada.contenido as unknown as SugerenciaCriterio[],
          modelo: guardada.modelo,
          generadaEn: guardada.createdAt.toISOString(),
          desdeCache: true,
        };
      }
    }

    const pdf = await this.descargarProyecto(ev.expedienteId);
    const titulo = ev.expediente?.tituloProtocolo ?? 'Proyecto de investigación';

    const bruto = await this.ia.generarJson<RespuestaRubrica>(
      { archivo: { buffer: pdf, mime: 'application/pdf' }, texto: promptRubrica(titulo) },
      ESQUEMA_RUBRICA as unknown as Record<string, unknown>,
    );

    const criterios = normalizarSugerencias(bruto);
    const modelo = this.ia.modelo;

    const guardada = await this.prisma.sugerenciaIa.upsert({
      where: { evaluacionId },
      update: { contenido: criterios as unknown as object, modelo, createdAt: new Date() },
      create: { evaluacionId, contenido: criterios as unknown as object, modelo },
    });

    this.logger.log(
      `Sugerencia de rúbrica generada para evaluación ${evaluacionId} con ${modelo}`,
    );

    return {
      criterios,
      modelo,
      generadaEn: guardada.createdAt.toISOString(),
      desdeCache: false,
    };
  }

  // ==================== consulta sobre el expediente ====================

  async consultarExpediente(
    expedienteId: number,
    pregunta: string,
    user: CurrentUser,
    documentoId?: number,
  ): Promise<{ respuesta: string; modelo: string; documento: string }> {
    // Se autoriza por la evaluación asignada, no por el expediente: el chat da
    // acceso al contenido del proyecto, así que sigue la misma regla que la
    // sugerencia de rúbrica.
    const ev = await this.prisma.evaluacion.findFirst({ where: { expedienteId } });
    if (!ev) throw new NotFoundException('Este expediente no tiene una evaluación asignada.');
    this.assertPuedeUsarIa(ev, user);

    // Sin documento elegido se mantiene el comportamiento anterior (el
    // proyecto), para que un cliente viejo siga funcionando igual.
    const elegido = documentoId
      ? await this.descargarElegido(expedienteId, documentoId)
      : {
          buffer: await this.descargarProyecto(expedienteId),
          mime: 'application/pdf',
          label: DOCUMENTO_LABELS[TIPO_DOC_PROYECTO],
        };

    const respuesta = await this.ia.generar({
      archivo: { buffer: elegido.buffer, mime: elegido.mime },
      texto: `Eres asistente de un comité de ética en investigación. Responde la pregunta del
evaluador usando ÚNICAMENTE el documento adjunto, que es: "${elegido.label}".

Reglas:
- Cita la sección o página en la que te basas.
- Si el documento no contiene la respuesta, dilo con claridad: "No encontré eso
  en ${elegido.label}". No inventes ni completes con conocimiento general, ni
  supongas lo que dirían otros documentos del expediente. Que algo falte es
  información valiosa para el comité.
- Responde en español, en 3 frases como máximo.

Pregunta del evaluador: ${pregunta}`,
    });

    return {
      respuesta: respuesta.trim(),
      modelo: this.ia.modelo,
      documento: elegido.label,
    };
  }
}
