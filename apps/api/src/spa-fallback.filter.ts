import { ArgumentsHost, Catch, ExceptionFilter, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { join } from 'path';

// Cuando este servicio sirve el build de apps/web (SPA con BrowserRouter)
// además de la API, cualquier ruta de navegación del cliente (ej.
// /investigador/dashboard) no existe como ruta real en Nest y cae aquí.
// Nest genera el 404 automático de "no matching route" con el mensaje fijo
// "Cannot GET /...": solo ESE caso se resuelve devolviendo index.html. Un
// NotFoundException lanzado a propósito por un controller (ej. "Expediente
// no encontrado") tiene otro mensaje y sigue devolviendo JSON normal.
const WEB_DIST_PATH = join(__dirname, '..', '..', 'web', 'dist');

@Catch(NotFoundException)
export class SpaFallbackFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const esRutaInexistente = exception.message.startsWith('Cannot ');
    const pareceArchivoEstatico = /\.[a-zA-Z0-9]+$/.test(req.path);

    if (req.method === 'GET' && esRutaInexistente && !pareceArchivoEstatico) {
      res.sendFile(join(WEB_DIST_PATH, 'index.html'));
      return;
    }

    res.status(exception.getStatus()).json(exception.getResponse());
  }
}
