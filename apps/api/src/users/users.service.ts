import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ROLES_VALIDOS } from './constants';

// Actor autenticado tal como lo deja `JwtStrategy.validate()` en
// `request.user`: solo { id, email, rol }, no el registro completo.
type CurrentUser = { id: number; email: string; rol: string };

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Forma de respuesta equivalente a `UserResponse` de Python
  // (comite/backend/app/schemas/__init__.py:40-55): todo el usuario salvo el
  // hash de contraseña, que nunca debe salir de la API. `updated_at` tampoco
  // forma parte de `UserResponse` en Python, así que se excluye también aquí
  // (misma convención ya usada en AuthService.register).
  private toResponse(user: User) {
    const {
      passwordHash: _passwordHash,
      updatedAt: _updatedAt,
      ...usuario
    } = user;
    return usuario;
  }

  async findAll(skip: number, limit: number) {
    const users = await this.prisma.user.findMany({ skip, take: limit });
    return users.map((u) => this.toResponse(u));
  }

  async findMe(currentUser: CurrentUser) {
    // El JWT solo trae { id, email, rol }; hay que releer el registro
    // completo, igual que `get_current_user_info` en Python devuelve el
    // `current_user` completo obtenido de la base.
    return this.findOne(currentUser.id);
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.toResponse(user);
  }

  async create(dto: AdminCreateUserDto, currentUser: CurrentUser) {
    // Solo el administrador puede crear usuarios (incluidos los roles
    // internos). En la práctica esta comprobación ya la hace RolesGuard +
    // @Roles('administrador') en el controller antes de llegar aquí, pero se
    // repite explícitamente para dejar la regla de negocio documentada y
    // blindada si el guard cambiara.
    if (currentUser.rol !== 'administrador') {
      throw new ForbiddenException(
        'Solo el administrador puede crear usuarios.',
      );
    }

    if (!(ROLES_VALIDOS as readonly string[]).includes(dto.rol)) {
      throw new BadRequestException('Rol no válido.');
    }

    const existente = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existente) {
      throw new BadRequestException('Email ya registrado');
    }

    // Costo bcrypt 12, igual que AuthService.register (paridad con los
    // hashes reales de producción generados por passlib/Python).
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        nombre: dto.nombre,
        apellido: dto.apellido,
        rol: dto.rol,
        // `activo` no tiene DEFAULT a nivel de columna en Postgres (ver
        // task-2-report.md); se aplica explícitamente igual que en
        // AuthService.register para que el usuario recién creado por el
        // admin pueda iniciar sesión.
        activo: true,
        especialidad: dto.especialidad ?? null,
        cargaTrabajo: dto.cargaTrabajo ?? null,
        conflictoInteres: dto.conflictoInteres ?? false,
      },
    });
    return this.toResponse(user);
  }

  async update(id: number, dto: UpdateUserDto, currentUser: CurrentUser) {
    const esAdmin = currentUser.rol === 'administrador';
    if (!esAdmin && currentUser.id !== id) {
      throw new ForbiddenException('No tienes permisos');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Chequeos truthy/`!== undefined`, igual que el Python de referencia
    // (comite/backend/app/api/users/routes.py:72-79): nombre/apellido se
    // actualizan si vienen no vacíos; rol/activo solo si quien edita es
    // administrador (sin importar si edita su propio registro u otro).
    const data: Record<string, unknown> = {};
    if (dto.nombre) {
      data.nombre = dto.nombre;
    }
    if (dto.apellido) {
      data.apellido = dto.apellido;
    }
    if (dto.rol && esAdmin) {
      data.rol = dto.rol;
    }
    if (dto.activo !== undefined && esAdmin) {
      data.activo = dto.activo;
    }

    const updated = await this.prisma.user.update({ where: { id }, data });
    return this.toResponse(updated);
  }

  async remove(id: number, currentUser: CurrentUser) {
    // Redundante con RolesGuard + @Roles('administrador') en el controller,
    // pero se deja explícito por la misma razón que en `create`.
    if (currentUser.rol !== 'administrador') {
      throw new ForbiddenException(
        'Solo administradores pueden eliminar usuarios',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Soft-delete: igual que comite/backend/app/api/users/routes.py:91, solo
    // se marca `activo = false`; la fila NUNCA se borra de la base.
    await this.prisma.user.update({ where: { id }, data: { activo: false } });
    return { message: 'Usuario desactivado' };
  }

  // DELETE /users/{id}/permanente -- a diferencia de `remove()` (soft-delete
  // de siempre), esto SÍ borra la fila. Solo administrador, solo roles
  // internos (un investigador/estudiante es dueño de expedientes -- borrarlo
  // de verdad implicaría decidir qué hacer con esos expedientes, fuera de
  // alcance de este botón) y solo si la cuenta no tiene evaluaciones o
  // mensajes de chat propios: eso es historial real del Comité y no debe
  // desaparecer solo porque se elimine la cuenta que lo generó.
  async eliminarPermanente(id: number, currentUser: CurrentUser) {
    if (currentUser.rol !== 'administrador') {
      throw new ForbiddenException('Solo administradores pueden eliminar usuarios.');
    }
    if (currentUser.id === id) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta.');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const ROLES_INTERNOS = ['administrador', 'coordinador', 'secretaria', 'evaluador'];
    if (!ROLES_INTERNOS.includes(user.rol)) {
      throw new BadRequestException(
        'Solo se pueden eliminar de forma permanente cuentas de roles internos (administrador, coordinador, secretaria, evaluador).',
      );
    }

    const [evaluacionesCount, mensajesCount] = await Promise.all([
      this.prisma.evaluacion.count({ where: { evaluadorId: id } }),
      this.prisma.mensajeChat.count({ where: { autorId: id } }),
    ]);
    if (evaluacionesCount > 0 || mensajesCount > 0) {
      throw new BadRequestException(
        'Esta cuenta tiene evaluaciones o mensajes de chat registrados; no se puede eliminar de forma permanente (se perdería historial del Comité). Usa "Desactivar" en su lugar.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.notificacion.deleteMany({ where: { usuarioId: id } }),
      this.prisma.bitacora.deleteMany({ where: { usuarioId: id } }),
      this.prisma.passwordResetCode.deleteMany({ where: { userId: id } }),
      this.prisma.mensajeChat.deleteMany({ where: { solicitanteId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    return { message: 'Usuario eliminado permanentemente.' };
  }
}
