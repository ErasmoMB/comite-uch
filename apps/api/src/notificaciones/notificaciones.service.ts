import { Injectable, NotFoundException } from '@nestjs/common';
import { Notificacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificacionDto } from './dto/create-notificacion.dto';
import { UpdateNotificacionDto } from './dto/update-notificacion.dto';

// Actor autenticado tal como lo deja `JwtStrategy.validate()` en
// `request.user` (mismo tipo que en el resto de servicios).
type CurrentUser = { id: number; email: string; rol: string };

// Equivalente 1:1 a `comite/backend/app/api/notificaciones/routes.py`. Sin
// restricción de rol: cualquier usuario autenticado puede leer/crear/marcar
// notificaciones (igual que Python -- las únicas comprobaciones son de
// pertenencia, `usuario_id == current_user.id`, no de rol).
@Injectable()
export class NotificacionesService {
  constructor(private prisma: PrismaService) {}

  private toResponse(n: Notificacion) {
    return {
      id: n.id,
      usuarioId: n.usuarioId,
      titulo: n.titulo,
      mensaje: n.mensaje,
      expedienteId: n.expedienteId,
      leida: n.leida ?? false,
      createdAt: n.createdAt,
    };
  }

  // GET /notificaciones/ (routes.py:12-14).
  async findAll(user: CurrentUser, skip: number, limit: number) {
    const notificaciones = await this.prisma.notificacion.findMany({
      where: { usuarioId: user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
    return notificaciones.map((n) => this.toResponse(n));
  }

  // GET /notificaciones/sin-leer (routes.py:16-19).
  async countSinLeer(user: CurrentUser) {
    const sinLeer = await this.prisma.notificacion.count({
      where: { usuarioId: user.id, leida: false },
    });
    return { sinLeer };
  }

  // GET /notificaciones/{id} (routes.py:21-26).
  async findOne(id: number, user: CurrentUser) {
    const notif = await this.prisma.notificacion.findFirst({
      where: { id, usuarioId: user.id },
    });
    if (!notif) {
      throw new NotFoundException('Notificación no encontrada');
    }
    return this.toResponse(notif);
  }

  // POST /notificaciones/ (routes.py:28-39). Igual que Python: no valida que
  // `dto.usuarioId` coincida con el usuario autenticado ni exige rol
  // especial -- cualquier usuario autenticado puede crear una notificación
  // para cualquier otro usuario.
  async create(dto: CreateNotificacionDto) {
    const nueva = await this.prisma.notificacion.create({
      data: {
        usuarioId: dto.usuarioId,
        titulo: dto.titulo,
        mensaje: dto.mensaje,
        expedienteId: dto.expedienteId ?? null,
        leida: false,
      },
    });
    return this.toResponse(nueva);
  }

  // PUT /notificaciones/{id} (routes.py:41-50). Marca como leída/no leída.
  // Solo el dueño de la notificación puede modificarla (mismo filtro
  // `usuario_id == current_user.id` de `findOne`, no error 403 explícito --
  // Python también responde 404 si no es del usuario).
  async update(id: number, dto: UpdateNotificacionDto, user: CurrentUser) {
    const notif = await this.prisma.notificacion.findFirst({
      where: { id, usuarioId: user.id },
    });
    if (!notif) {
      throw new NotFoundException('Notificación no encontrada');
    }

    const data: { leida?: boolean } = {};
    if (dto.leida !== undefined) {
      data.leida = dto.leida;
    }

    const actualizada = await this.prisma.notificacion.update({
      where: { id },
      data,
    });
    return this.toResponse(actualizada);
  }

  // POST /notificaciones/marcar-todas-leidas (routes.py:52-56). Solo afecta
  // las notificaciones del usuario que llama, nunca las de otros.
  async marcarTodasLeidas(user: CurrentUser) {
    await this.prisma.notificacion.updateMany({
      where: { usuarioId: user.id, leida: false },
      data: { leida: true },
    });
    return { message: 'Todas las notificaciones marcadas como leídas' };
  }
}
