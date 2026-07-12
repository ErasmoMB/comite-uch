import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { EvaluacionService } from './evaluacion.service';
import { CreateEvaluacionDto } from './dto/create-evaluacion.dto';
import { UpdateEvaluacionDto } from './dto/update-evaluacion.dto';
import { AsignarEvaluadorDto } from './dto/asignar-evaluador.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Equivalente 1:1 a comite/backend/app/api/evaluacion/routes.py (411 líneas).
//
// Orden de rutas: 'mis-evaluaciones', 'rubrica' y 'expediente/:id/asignar' se
// declaran ANTES que ':id' para que Nest no intente resolverlas como si
// fueran un id numérico (mismo criterio que ExpedientesController).
@Controller('evaluacion')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluacionController {
  constructor(private evaluacionService: EvaluacionService) {}

  // GET /evaluacion/rubrica (routes.py:85-91).
  @Get('rubrica')
  getRubrica() {
    return this.evaluacionService.getRubrica();
  }

  // GET /evaluacion/mis-evaluaciones (routes.py:99-103).
  @Get('mis-evaluaciones')
  findMisEvaluaciones(@Req() req: any) {
    return this.evaluacionService.findMisEvaluaciones(req.user);
  }

  // GET /evaluacion/ (routes.py:93-97).
  @Get()
  findAll(@Req() req: any, @Query('skip') skip?: string, @Query('limit') limit?: string) {
    const skipNum = skip !== undefined ? parseInt(skip, 10) : 0;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 50;
    return this.evaluacionService.findAll(req.user, skipNum, limitNum);
  }

  // POST /evaluacion/ (routes.py:112-128). Solo coordinadores/administradores.
  @Post()
  @Roles('administrador', 'coordinador')
  create(@Body() dto: CreateEvaluacionDto, @Req() req: any) {
    return this.evaluacionService.create(dto, req.user);
  }

  // POST /evaluacion/expediente/{id}/asignar (routes.py:341-412). REGLA
  // DURA de 1 solo evaluador por expediente. Nota de status code: Python no
  // declara `status_code` (-> 200 implícito en FastAPI); se deja el 201
  // default de Nest a propósito, igual criterio que
  // `ExpedientesController.submitSubsanacion` (la Task 8 brief acepta
  // "200/201" explícitamente para este endpoint).
  @Post('expediente/:id/asignar')
  @Roles('administrador', 'coordinador')
  asignar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarEvaluadorDto,
    @Req() req: any,
  ) {
    return this.evaluacionService.asignar(id, dto, req.user);
  }

  // GET /evaluacion/{id} (routes.py:105-110). Debe ir DESPUÉS de las rutas
  // estáticas de arriba.
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.evaluacionService.findOne(id);
  }

  // PUT /evaluacion/{id} (routes.py:130-259) -- el endpoint central.
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEvaluacionDto, @Req() req: any) {
    return this.evaluacionService.update(id, dto, req.user);
  }

  // GET /evaluacion/{id}/descargar-rubrica (routes.py:261-286). Usa @Res()
  // para poder tanto redirigir (302, si el path guardado ya es una URL) como
  // servir el buffer crudo (si es una key propia del bucket).
  @Get(':id/descargar-rubrica')
  async descargarRubrica(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const resultado = await this.evaluacionService.descargarRubrica(id);
    this.responderDescarga(res, resultado);
  }

  // GET /evaluacion/{id}/descargar-dictamen (routes.py:289-314).
  @Get(':id/descargar-dictamen')
  async descargarDictamen(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const resultado = await this.evaluacionService.descargarDictamen(id);
    this.responderDescarga(res, resultado);
  }

  private responderDescarga(
    res: Response,
    resultado: { redirectUrl: string } | { buffer: Buffer; contentType: string; nombreArchivo: string },
  ) {
    if ('redirectUrl' in resultado) {
      res.redirect(302, resultado.redirectUrl);
      return;
    }
    res.set({
      'Content-Type': resultado.contentType,
      'Content-Disposition': `attachment; filename="${resultado.nombreArchivo}"`,
      'Content-Length': String(resultado.buffer.length),
      'Access-Control-Expose-Headers': 'Content-Disposition, Content-Type, Content-Length',
    });
    res.send(resultado.buffer);
  }

  // POST /evaluacion/{id}/conflicto (routes.py:317-326).
  @Post(':id/conflicto')
  @HttpCode(HttpStatus.OK)
  declararConflicto(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.evaluacionService.declararConflicto(id, req.user);
  }

  // POST /evaluacion/{id}/guardar-parcial (routes.py:328-338).
  @Post(':id/guardar-parcial')
  @HttpCode(HttpStatus.OK)
  guardarParcial(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEvaluacionDto, @Req() req: any) {
    return this.evaluacionService.guardarParcial(id, dto, req.user);
  }
}
