import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // GET /health -- endpoint público y liviano para que los clientes sepan si
  // el backend está disponible ANTES de dejar operar al usuario.
  //
  // Existe sobre todo por el plan free de Render, que apaga el servicio tras
  // ~15 min sin tráfico: la primera petición despierta la instancia y puede
  // tardar ~40s. Sin esto, la app se veía congelada sin explicación.
  //
  // Comprueba también la base de datos porque "el proceso responde" no basta:
  // si Neon no contesta, la app no sirve para nada y el usuario debe saberlo.
  @Get('health')
  async health(@Res() res: Response) {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      res.status(200).json({ ok: true, db: true });
    } catch {
      res.status(503).json({ ok: false, db: false });
    }
  }
}
