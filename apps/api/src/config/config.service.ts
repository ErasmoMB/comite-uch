import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CLAVE_FECHA_LIMITE, parseFechaLimite } from './fecha-limite.util';

// Equivalente a comite/backend/app/api/config/routes.py: tabla `configuracion`
// clave/valor genérica. Hoy la única clave usada es CLAVE_FECHA_LIMITE, igual
// que en Python (no hay otras claves definidas en la referencia).
@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  // Equivalente a `leer_config()` (routes.py:22-24).
  async leerConfig(clave: string): Promise<string | null> {
    const fila = await this.prisma.configuracion.findUnique({ where: { clave } });
    return fila?.valor ?? null;
  }

  // Equivalente a `guardar_config()` (routes.py:27-33): upsert por clave.
  async guardarConfig(clave: string, valor: string | null): Promise<void> {
    await this.prisma.configuracion.upsert({
      where: { clave },
      update: { valor },
      create: { clave, valor },
    });
  }

  // GET /config/fecha-limite -- cualquier usuario autenticado (routes.py:36-38).
  async getFechaLimite(): Promise<{ fechaLimite: string | null }> {
    const fechaLimite = await this.leerConfig(CLAVE_FECHA_LIMITE);
    return { fechaLimite };
  }

  // PUT /config/fecha-limite (routes.py:41-59). El chequeo de rol
  // administrador ya lo hace RolesGuard + @Roles('administrador') en el
  // controller antes de llegar aquí (mismo patrón que UsersService.create):
  // no se repite aquí porque este método no recibe el usuario actual, solo
  // el valor a guardar.
  async setFechaLimite(fechaLimite: string | null | undefined): Promise<{ fechaLimite: string | null }> {
    let valor: string | null = null;
    if (fechaLimite) {
      if (!parseFechaLimite(fechaLimite)) {
        throw new BadRequestException('Fecha inválida.');
      }
      valor = fechaLimite;
    }

    await this.guardarConfig(CLAVE_FECHA_LIMITE, valor);
    return { fechaLimite: valor };
  }
}
