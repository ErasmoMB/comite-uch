import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GeminiClient } from './gemini.client';
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

// Solo se envía el proyecto de investigación. La carta del asesor, la solicitud
// y la boleta no aportan al juicio ético y solo gastan contexto.
const TIPO_DOC_PROYECTO = 'proyecto_pdf';

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
    private gemini: GeminiClient,
  ) {}

  estaDisponible(): boolean {
    return this.gemini.estaConfigurado();
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
    try {
      return await this.storage.getObjectBuffer(doc.rutaArchivo);
    } catch {
      throw new ConflictException(
        'El proyecto de investigación no está disponible en el almacenamiento.',
      );
    }
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

    const bruto = await this.gemini.generarJson<RespuestaRubrica>(
      [GeminiClient.archivo(pdf), { text: promptRubrica(titulo) }],
      ESQUEMA_RUBRICA as unknown as Record<string, unknown>,
    );

    const criterios = normalizarSugerencias(bruto);
    const modelo = this.gemini.modelo;

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
  ): Promise<{ respuesta: string; modelo: string }> {
    // Se autoriza por la evaluación asignada, no por el expediente: el chat da
    // acceso al contenido del proyecto, así que sigue la misma regla que la
    // sugerencia de rúbrica.
    const ev = await this.prisma.evaluacion.findFirst({ where: { expedienteId } });
    if (!ev) throw new NotFoundException('Este expediente no tiene una evaluación asignada.');
    this.assertPuedeUsarIa(ev, user);

    const pdf = await this.descargarProyecto(expedienteId);

    const respuesta = await this.gemini.generar([
      GeminiClient.archivo(pdf),
      {
        text: `Eres asistente de un comité de ética en investigación. Responde la pregunta del
evaluador usando ÚNICAMENTE el proyecto adjunto.

Reglas:
- Cita la sección o página en la que te basas.
- Si el documento no contiene la respuesta, dilo con claridad: "No encontré eso
  en el expediente". No inventes ni completes con conocimiento general. Que algo
  falte es información valiosa para el comité.
- Responde en español, en 3 frases como máximo.

Pregunta del evaluador: ${pregunta}`,
      },
    ]);

    return { respuesta: respuesta.trim(), modelo: this.gemini.modelo };
  }
}
