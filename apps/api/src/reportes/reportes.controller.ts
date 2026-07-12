import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const TIPOS_EXPORTAR_VALIDOS = ['expedientes', 'evaluaciones'] as const;

// Equivalente 1:1 a comite/backend/app/api/reportes/routes.py.
@Controller('reportes')
@UseGuards(JwtAuthGuard)
export class ReportesController {
  constructor(private reportesService: ReportesService) {}

  // GET /reportes/expedientes-por-estado -- cualquier usuario autenticado
  // (routes.py:17-25).
  @Get('expedientes-por-estado')
  expedientesPorEstado() {
    return this.reportesService.expedientesPorEstado();
  }

  // GET /reportes/tiempos-atencion -- cualquier usuario autenticado
  // (routes.py:27-40).
  @Get('tiempos-atencion')
  tiemposAtencion() {
    return this.reportesService.tiemposAtencion();
  }

  // GET /reportes/carga-evaluadores -- cualquier usuario autenticado
  // (routes.py:42-62).
  @Get('carga-evaluadores')
  cargaEvaluadores() {
    return this.reportesService.cargaEvaluadores();
  }

  // GET /reportes/resultados-emitidos -- cualquier usuario autenticado
  // (routes.py:64-89, YA CORREGIDO: sobre Evaluacion.resultado).
  @Get('resultados-emitidos')
  resultadosEmitidos() {
    return this.reportesService.resultadosEmitidos();
  }

  // GET /reportes/buscar-expedientes -- cualquier usuario autenticado
  // (routes.py:91-106).
  @Get('buscar-expedientes')
  buscarExpedientes(
    @Query('estado') estado?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return this.reportesService.buscarExpedientes(estado, fechaInicio, fechaFin);
  }

  // GET /reportes/resumen -- solo administrador/coordinador/secretaria
  // (routes.py:108-197).
  @Get('resumen')
  @UseGuards(RolesGuard)
  @Roles('administrador', 'coordinador', 'secretaria')
  resumen() {
    return this.reportesService.resumen();
  }

  // GET /reportes/exportar?tipo=expedientes|evaluaciones -- solo
  // administrador/coordinador/secretaria. Devuelve un PDF real con cara
  // institucional (antes era un stub que solo confirmaba el "tipo" sin
  // generar ningún archivo; luego fue CSV plano hasta que se pidió PDF).
  @Get('exportar')
  @UseGuards(RolesGuard)
  @Roles('administrador', 'coordinador', 'secretaria')
  async exportar(@Query('tipo') tipo: string | undefined, @Res() res: Response) {
    if (!tipo) {
      throw new BadRequestException('El parámetro "tipo" es obligatorio.');
    }
    if (!TIPOS_EXPORTAR_VALIDOS.includes(tipo as (typeof TIPOS_EXPORTAR_VALIDOS)[number])) {
      throw new BadRequestException(`Tipo de exportación inválido. Usa: ${TIPOS_EXPORTAR_VALIDOS.join(', ')}.`);
    }
    const { filename, buffer } = await this.reportesService.exportarListadoPdf(tipo as 'expedientes' | 'evaluaciones');
    this.enviarPdf(res, filename, buffer);
  }

  // GET /reportes/exportar-reporte -- solo administrador/coordinador/
  // secretaria. Descarga directa de un clic (antes abría el diálogo de
  // impresión del navegador, a pedido del admin ahora baja el PDF sin
  // preguntar nada).
  @Get('exportar-reporte')
  @UseGuards(RolesGuard)
  @Roles('administrador', 'coordinador', 'secretaria')
  async exportarReporte(@Res() res: Response) {
    const buffer = await this.reportesService.exportarReportePdf();
    this.enviarPdf(res, `reporte-gestion_${Date.now()}.pdf`, buffer);
  }

  private enviarPdf(res: Response, filename: string, buffer: Buffer) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
      'Access-Control-Expose-Headers': 'Content-Disposition, Content-Type, Content-Length',
    });
    res.send(buffer);
  }
}
