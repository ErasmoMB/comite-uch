import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MensajeChat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES_AUTO_REGISTRO } from '../auth/constants';
import { CreateMensajeDto } from './dto/create-mensaje.dto';

// Actor autenticado tal como lo deja `JwtStrategy.validate()` en
// `request.user` (mismo tipo que en EvaluacionService/ExpedientesService).
type CurrentUser = { id: number; email: string; rol: string };

const TEXTO_MAX = 2000;

// Equivalente a `app/api/chat/routes.py`. Chat 1-a-1 entre un solicitante
// (estudiante_pregrado/estudiante_postgrado/investigador) y la Secretaría
// (bandeja compartida por rol: secretaria + administrador). Un hilo por
// solicitante, identificado por `MensajeChat.solicitanteId`.
@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // Equivalente a `MensajeChat.es_de_secretaria` (models/__init__.py:409-412):
  // True si el autor del mensaje no es el propio solicitante del hilo.
  private toResponse(m: MensajeChat) {
    return {
      id: m.id,
      solicitanteId: m.solicitanteId,
      autorId: m.autorId,
      texto: m.texto,
      leido: m.leido ?? false,
      esDeSecretaria: m.autorId !== m.solicitanteId,
      createdAt: m.createdAt,
    };
  }

  // Equivalente a `_validar_texto` (routes.py:43-49).
  private validarTexto(texto: string): string {
    const t = (texto ?? '').trim();
    if (!t) {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }
    if (t.length > TEXTO_MAX) {
      throw new BadRequestException(
        `El mensaje no puede superar ${TEXTO_MAX} caracteres`,
      );
    }
    return t;
  }

  // Equivalente a `_get_solicitante` (routes.py:52-56).
  private async getSolicitanteOrThrow(solicitanteId: number) {
    const solicitante = await this.prisma.user.findUnique({
      where: { id: solicitanteId },
    });
    if (
      !solicitante ||
      !(ROLES_AUTO_REGISTRO as readonly string[]).includes(solicitante.rol)
    ) {
      throw new NotFoundException('Solicitante no encontrado');
    }
    return solicitante;
  }

  // ---------- Lado solicitante ----------

  // GET /chat/mios (routes.py:61-76). Abrirlo marca como leídos los
  // mensajes de secretaría.
  async getMisMensajes(user: CurrentUser) {
    await this.prisma.mensajeChat.updateMany({
      where: {
        solicitanteId: user.id,
        autorId: { not: user.id },
        leido: false,
      },
      data: { leido: true },
    });
    const mensajes = await this.prisma.mensajeChat.findMany({
      where: { solicitanteId: user.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return mensajes.map((m) => this.toResponse(m));
  }

  // POST /chat/mios (routes.py:79-87).
  async enviarMensajeSolicitante(dto: CreateMensajeDto, user: CurrentUser) {
    const texto = this.validarTexto(dto.texto);
    const mensaje = await this.prisma.mensajeChat.create({
      data: { solicitanteId: user.id, autorId: user.id, texto, leido: false },
    });
    return this.toResponse(mensaje);
  }

  // GET /chat/mios/no-leidos (routes.py:90-99). Mensajes de secretaría que
  // el solicitante aún no ha visto (para el badge).
  async misNoLeidos(user: CurrentUser) {
    const noLeidos = await this.prisma.mensajeChat.count({
      where: {
        solicitanteId: user.id,
        autorId: { not: user.id },
        leido: false,
      },
    });
    return { noLeidos };
  }

  // ---------- Lado secretaría ----------

  // GET /chat/conversaciones (routes.py:104-156). Bandeja: una entrada por
  // solicitante con mensajes, ordenada por actividad reciente.
  async getConversaciones() {
    const grupos = await this.prisma.mensajeChat.groupBy({
      by: ['solicitanteId'],
      _max: { id: true },
    });
    if (grupos.length === 0) {
      return [];
    }

    const ultimosIds = grupos
      .map((g) => g._max.id)
      .filter((id): id is number => id !== null);
    const ultimosMensajes = await this.prisma.mensajeChat.findMany({
      where: { id: { in: ultimosIds } },
    });
    const ultimosPorSolicitante = new Map(
      ultimosMensajes.map((m) => [m.solicitanteId, m]),
    );

    // No leídos por hilo = mensajes escritos por el solicitante que
    // secretaría no ha visto (autorId === solicitanteId, leido === false).
    // Prisma no soporta comparar dos columnas entre sí en un `where`, así
    // que se filtra en memoria -- volumen esperado bajo para este módulo.
    const noLeidosMensajes = await this.prisma.mensajeChat.findMany({
      where: { leido: false },
    });
    const noLeidosPorSolicitante = new Map<number, number>();
    for (const m of noLeidosMensajes) {
      if (m.autorId === m.solicitanteId) {
        noLeidosPorSolicitante.set(
          m.solicitanteId,
          (noLeidosPorSolicitante.get(m.solicitanteId) ?? 0) + 1,
        );
      }
    }

    const solicitanteIds = [...ultimosPorSolicitante.keys()];
    const solicitantes = await this.prisma.user.findMany({
      where: { id: { in: solicitanteIds } },
    });
    const solicitantesPorId = new Map(solicitantes.map((u) => [u.id, u]));

    const resumen: {
      solicitanteId: number;
      nombre: string;
      rol: string;
      email: string;
      codigoEstudiante: string | null;
      ultimoMensaje: string;
      ultimaFecha: Date | null;
      noLeidos: number;
    }[] = [];
    for (const [sid, mensaje] of ultimosPorSolicitante) {
      const u = solicitantesPorId.get(sid);
      if (!u) continue;
      resumen.push({
        solicitanteId: sid,
        nombre: `${u.nombre} ${u.apellido}`.trim(),
        rol: u.rol,
        email: u.email,
        codigoEstudiante: u.codigoEstudiante ?? null,
        ultimoMensaje: mensaje.texto,
        ultimaFecha: mensaje.createdAt,
        noLeidos: noLeidosPorSolicitante.get(sid) ?? 0,
      });
    }
    // El id del último mensaje desempata fechas idénticas (mismo segundo).
    resumen.sort(
      (a, b) =>
        (ultimosPorSolicitante.get(b.solicitanteId)?.id ?? 0) -
        (ultimosPorSolicitante.get(a.solicitanteId)?.id ?? 0),
    );
    return resumen;
  }

  // GET /chat/solicitantes (routes.py:159-178). Todos los solicitantes
  // registrados y activos (para que secretaría inicie una conversación).
  async getSolicitantes() {
    const usuarios = await this.prisma.user.findMany({
      where: { rol: { in: [...ROLES_AUTO_REGISTRO] }, activo: true },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    });
    return usuarios.map((u) => ({
      id: u.id,
      nombre: `${u.nombre} ${u.apellido}`.trim(),
      rol: u.rol,
      email: u.email,
      codigoEstudiante: u.codigoEstudiante ?? null,
    }));
  }

  // GET /chat/no-leidos (routes.py:181-189). Total de mensajes de
  // solicitantes sin leer (badge de la bandeja).
  async totalNoLeidos() {
    const noLeidosMensajes = await this.prisma.mensajeChat.findMany({
      where: { leido: false },
    });
    const total = noLeidosMensajes.filter(
      (m) => m.autorId === m.solicitanteId,
    ).length;
    return { noLeidos: total };
  }

  // GET /chat/{solicitanteId} (routes.py:194-210). Hilo de un solicitante.
  // Abrirlo marca como leídos sus mensajes.
  async getHilo(solicitanteId: number) {
    await this.getSolicitanteOrThrow(solicitanteId);
    await this.prisma.mensajeChat.updateMany({
      where: { solicitanteId, autorId: solicitanteId, leido: false },
      data: { leido: true },
    });
    const mensajes = await this.prisma.mensajeChat.findMany({
      where: { solicitanteId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return mensajes.map((m) => this.toResponse(m));
  }

  // POST /chat/{solicitanteId} (routes.py:213-223). Responde (o inicia) la
  // conversación con un solicitante.
  async enviarMensajeSecretaria(
    solicitanteId: number,
    dto: CreateMensajeDto,
    user: CurrentUser,
  ) {
    await this.getSolicitanteOrThrow(solicitanteId);
    const texto = this.validarTexto(dto.texto);
    const mensaje = await this.prisma.mensajeChat.create({
      data: { solicitanteId, autorId: user.id, texto, leido: false },
    });
    return this.toResponse(mensaje);
  }
}
