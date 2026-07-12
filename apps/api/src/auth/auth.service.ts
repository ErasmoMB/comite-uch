import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { ROLES_AUTO_REGISTRO } from './constants';

const ROLES_ESTUDIANTE = ['estudiante_pregrado', 'estudiante_postgrado'];

// Vida del código OTP de recuperación: 15 minutos, igual criterio que la
// mayoría de flujos de "olvidé mi contraseña" (suficiente para revisar el
// correo, corto para no dejar una ventana de ataque grande).
const MINUTOS_VIGENCIA_CODIGO = 15;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    // Solo se permite auto-registrarse con los roles públicos. Los roles
    // internos (administrador, coordinador, secretaria, evaluador) los crea
    // únicamente el administrador vía otro endpoint (equivalente a
    // comite/backend/app/api/auth/routes.py:24-28).
    if (!(ROLES_AUTO_REGISTRO as readonly string[]).includes(dto.rol)) {
      throw new ForbiddenException(
        'Este rol no puede registrarse. Las credenciales de roles internos las crea el administrador.',
      );
    }

    const existente = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existente) {
      // Igual que comite/backend/app/api/auth/routes.py:30-32: email
      // duplicado responde 400, no 409 (confirmado leyendo el Python real).
      throw new BadRequestException('El correo ya está registrado.');
    }

    // Validación de campos académicos según el rol (equivalente a
    // comite/backend/app/api/auth/routes.py:44-48).
    const esEstudiante = ROLES_ESTUDIANTE.includes(dto.rol);
    if (esEstudiante && !dto.codigoEstudiante?.trim()) {
      throw new BadRequestException('El código de estudiante es obligatorio.');
    }
    if (dto.rol === 'investigador' && !dto.laboratorio?.trim()) {
      throw new BadRequestException('El laboratorio es obligatorio.');
    }

    // Costo bcrypt 12, igual que los hashes reales generados por
    // passlib/Python en producción (ej. admin@uch.edu.pe usa `$2b$12$...`).
    // bcrypt embebe el costo en cada hash, así que esto no afecta la
    // validación de hashes existentes creados con otro costo — solo aplica
    // a los hashes generados de aquí en adelante.
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        nombre: dto.nombre,
        apellido: dto.apellido,
        rol: dto.rol,
        // `activo` no tiene DEFAULT a nivel de columna en Postgres (ver
        // task-2-report.md); en Python, `Column(Boolean, default=True)` lo
        // aplica SQLAlchemy en cada INSERT. Hay que replicarlo explícitamente
        // aquí o los usuarios recién registrados quedarían con `activo` NULL
        // y no podrían iniciar sesión (login trata NULL como inactivo).
        activo: true,
        // Solo se guarda el dato académico correspondiente al rol elegido.
        codigoEstudiante: esEstudiante ? dto.codigoEstudiante : null,
        laboratorio: dto.rol === 'investigador' ? dto.laboratorio : null,
      },
    });
    // Forma de respuesta equivalente a `UserResponse` de Python
    // (comite/backend/app/schemas/__init__.py) — todo el objeto de usuario
    // salvo el hash de la contraseña, que nunca debe salir de la API.
    const { passwordHash: _passwordHash, updatedAt: _updatedAt, ...usuario } = user;
    return usuario;
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Igual que el backend Python: credenciales inválidas (usuario inexistente
    // o password incorrecto) siempre responde 401, sin distinguir cuál de los
    // dos falló.
    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }
    const valido = await bcrypt.compare(password, user.passwordHash);
    if (!valido) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }
    // La cuenta desactivada se distingue con 403 (solo se evalúa después de
    // confirmar que la contraseña es correcta), igual que
    // comite/backend/app/api/auth/routes.py:77-81.
    if (!user.activo) {
      throw new ForbiddenException('Cuenta desactivada. Contacta al administrador.');
    }
    const accessToken = this.jwt.sign({ sub: String(user.id) });
    return { access_token: accessToken, token_type: 'bearer' };
  }

  // POST /auth/recuperar/solicitar -- genera un código de 6 dígitos y lo
  // envía por correo. Responde siempre el mismo mensaje genérico exista o no
  // la cuenta, para no revelar por esta vía qué correos están registrados.
  async solicitarRecuperacion(email: string): Promise<{ message: string }> {
    const mensaje = { message: 'Si el correo está registrado, te enviamos un código de verificación.' };
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return mensaje;
    }

    // Invalida cualquier código anterior sin usar: solo el más reciente
    // sirve (cubre también el botón "Reenviar código" del cliente).
    await this.prisma.passwordResetCode.updateMany({
      where: { userId: user.id, usado: false },
      data: { usado: true },
    });

    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(codigo, 10);
    const expiresAt = new Date(Date.now() + MINUTOS_VIGENCIA_CODIGO * 60_000);
    await this.prisma.passwordResetCode.create({
      data: { userId: user.id, codeHash, expiresAt },
    });

    await this.emailService.enviarEmail({
      to: [user.email],
      subject: 'Código de verificación - Comité de Ética UCH',
      body:
        `Hola ${user.nombre},\n\n` +
        `Tu código para recuperar tu contraseña es: ${codigo}\n\n` +
        `Vence en ${MINUTOS_VIGENCIA_CODIGO} minutos. Si no solicitaste este cambio, ignora este correo.`,
    });

    return mensaje;
  }

  // Busca el código vigente (no usado, no vencido) más reciente del usuario
  // y lo compara contra el hash -- usado tanto por /verificar como por
  // /cambiar (el segundo repite la validación porque el código podría haber
  // vencido entre un paso y otro).
  private async obtenerCodigoValido(userId: number, codigo: string) {
    const registro = await this.prisma.passwordResetCode.findFirst({
      where: { userId, usado: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!registro) return null;
    const coincide = await bcrypt.compare(codigo, registro.codeHash);
    return coincide ? registro : null;
  }

  // POST /auth/recuperar/verificar -- valida el código sin consumirlo (el
  // cliente recién en el paso 3 pide la nueva contraseña).
  async verificarCodigo(email: string, codigo: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Código inválido o vencido.');
    }
    const valido = await this.obtenerCodigoValido(user.id, codigo);
    if (!valido) {
      throw new BadRequestException('Código inválido o vencido.');
    }
    return { message: 'Código válido.' };
  }

  // POST /auth/recuperar/cambiar -- valida el código de nuevo y, si es
  // correcto, actualiza la contraseña y marca el código como usado (de un
  // solo uso).
  async cambiarPassword(email: string, codigo: string, nuevaPassword: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Código inválido o vencido.');
    }
    const registro = await this.obtenerCodigoValido(user.id, codigo);
    if (!registro) {
      throw new BadRequestException('Código inválido o vencido.');
    }

    const passwordHash = await bcrypt.hash(nuevaPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.passwordResetCode.update({ where: { id: registro.id }, data: { usado: true } }),
    ]);

    return { message: 'Contraseña actualizada correctamente.' };
  }
}
