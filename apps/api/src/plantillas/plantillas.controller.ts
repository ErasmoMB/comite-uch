import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { PLANTILLAS } from './plantillas.constants';

const MIME_POR_EXTENSION: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
};

// Equivalente 1:1 a comite/backend/app/api/plantillas/routes.py -- sin
// JwtAuthGuard, son plantillas/guías públicas del Comité.
@Controller('plantillas')
export class PlantillasController {
  // process.cwd() (no __dirname): Nest siempre se ejecuta con el cwd en la
  // raíz de apps/server sin importar si el build empaqueta todo en un solo
  // dist/main.js (webpack) o mantiene la estructura de carpetas de src/.
  private readonly plantillasDir = path.join(process.cwd(), 'plantillas');

  @Get(':key')
  get(@Param('key') key: string, @Query('modo') modo: 'ver' | 'descargar' = 'ver', @Res() res: Response) {
    const item = PLANTILLAS[key];
    if (!item) throw new NotFoundException('Plantilla no encontrada');

    const filePath = path.join(this.plantillasDir, item.archivo);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('El archivo de la plantilla no está disponible.');
    }

    const extension = path.extname(item.archivo).toLowerCase();
    const contentType = MIME_POR_EXTENSION[extension] ?? 'application/octet-stream';
    const disposicion = modo === 'descargar' ? 'attachment' : 'inline';
    const nombreUtf8 = encodeURIComponent(item.nombreDescarga);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `${disposicion}; filename*=UTF-8''${nombreUtf8}`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.sendFile(filePath);
  }
}
