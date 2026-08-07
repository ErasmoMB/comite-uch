import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ExpedientesService } from './expedientes.service';
import type { ArchivoSubido } from './expedientes.service';
import { CreateExpedienteDto } from './dto/create-expediente.dto';
import { UpdateExpedienteDto } from './dto/update-expediente.dto';
import { CambioTituloDto } from './dto/cambio-titulo.dto';
import { SubsanacionDto } from './dto/subsanacion.dto';
import { UploadDocumentoDto } from './dto/upload-documento.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Equivalente 1:1 a comite/backend/app/api/expedientes/routes.py (líneas
// 1-435 desde la Task 6, más 443-919 -- documentos y subsanación -- desde
// esta Task 7).
//
// El ValidationPipe (whitelist + transform) se aplica globalmente vía
// provider APP_PIPE en app.module.ts.
//
// Orden de rutas: las rutas estáticas (`catalogos`, `elegibles-cambio-titulo`,
// `cambio-titulo`) se declaran ANTES que `:id`, igual que en FastAPI, para que
// Nest no intente resolver "catalogos" como si fuera un `:id`.
@Controller('expedientes')
@UseGuards(JwtAuthGuard)
export class ExpedientesController {
  constructor(private expedientesService: ExpedientesService) {}

  // GET /expedientes/ (routes.py:137-142).
  @Get()
  findAll(@Req() req: any, @Query('skip') skip?: string, @Query('limit') limit?: string) {
    const skipNum = skip !== undefined ? parseInt(skip, 10) : 0;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 50;
    return this.expedientesService.findAll(req.user, skipNum, limitNum);
  }

  // GET /expedientes/catalogos (routes.py:144-162).
  @Get('catalogos')
  getCatalogos(@Req() req: any) {
    return this.expedientesService.getCatalogos(req.user);
  }

  // GET /expedientes/elegibles-cambio-titulo (routes.py:181-208).
  @Get('elegibles-cambio-titulo')
  getElegiblesCambioTitulo(@Req() req: any) {
    return this.expedientesService.getElegiblesCambioTitulo(req.user);
  }

  // GET /expedientes/{id}/requisitos (routes.py:165-178).
  @Get(':id/requisitos')
  getRequisitos(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.expedientesService.getRequisitos(id, req.user);
  }

  // GET /expedientes/{id}/bitacora (routes.py:437-440).
  @Get(':id/bitacora')
  getBitacora(@Param('id', ParseIntPipe) id: number) {
    return this.expedientesService.getBitacora(id);
  }

  // GET /expedientes/{id}/historial (routes.py:442-445).
  @Get(':id/historial')
  getHistorial(@Param('id', ParseIntPipe) id: number) {
    return this.expedientesService.getHistorial(id);
  }

  // GET /expedientes/{id}/documentos (routes.py:576-593).
  @Get(':id/documentos')
  getDocumentos(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.expedientesService.getDocumentos(id, req.user);
  }

  // GET /expedientes/{id}/documentos/{documentoId}/descargar (routes.py:614-725).
  // Usa @Res() para controlar headers/body crudos (Content-Disposition:
  // attachment) -- por eso Nest no envuelve la respuesta en JSON aquí.
  @Get(':id/documentos/:documentoId/descargar')
  async descargarDocumento(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentoId', ParseIntPipe) documentoId: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { buffer, contentType, nombreArchivo } = await this.expedientesService.descargarDocumento(
      id,
      documentoId,
      req.user,
    );
    this.enviarArchivo(res, buffer, contentType, nombreArchivo, 'attachment');
  }

  // GET /expedientes/{id}/documentos/{documentoId}/preview (routes.py:744-854).
  // Única diferencia real con /descargar: Content-Disposition: inline.
  @Get(':id/documentos/:documentoId/preview')
  async previewDocumento(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentoId', ParseIntPipe) documentoId: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { buffer, contentType, nombreArchivo } = await this.expedientesService.previewDocumento(
      id,
      documentoId,
      req.user,
    );
    this.enviarArchivo(res, buffer, contentType, nombreArchivo, 'inline');
  }

  // Arma los mismos headers que Python (routes.py:679-683/809-813): nombre
  // de archivo en ASCII entre comillas + variante `filename*=UTF-8''...`
  // percent-encoded para navegadores que soportan RFC 5987 (nombres con
  // tildes/ñ), y expone los headers al frontend vía CORS.
  private enviarArchivo(
    res: Response,
    buffer: Buffer,
    contentType: string,
    nombreArchivo: string,
    disposicion: 'attachment' | 'inline',
  ) {
    const nombreUtf8 = encodeURIComponent(nombreArchivo);
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `${disposicion}; filename="${nombreArchivo}"; filename*=UTF-8''${nombreUtf8}`,
      'Content-Length': String(buffer.length),
      'Access-Control-Expose-Headers': 'Content-Disposition, Content-Type, Content-Length',
    });
    res.send(buffer);
  }

  // GET /expedientes/{id} (routes.py:211-218). Debe ir DESPUÉS de las rutas
  // estáticas/anidadas de arriba.
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.expedientesService.findOne(id, req.user);
  }

  // POST /expedientes/cambio-titulo (routes.py:300-354). Declarada antes de
  // POST /expedientes/{id}/enviar solo por prolijidad; no hay ambigüedad real
  // de rutas entre POST '/' y POST 'cambio-titulo'.
  @Post('cambio-titulo')
  createCambioTitulo(@Body() dto: CambioTituloDto, @Req() req: any) {
    return this.expedientesService.createCambioTitulo(dto, req.user);
  }

  // POST /expedientes/ (routes.py:253-298).
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateExpedienteDto, @Req() req: any) {
    return this.expedientesService.create(dto, req.user);
  }

  // PUT /expedientes/{id} (routes.py:357-375).
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExpedienteDto,
    @Req() req: any,
  ) {
    return this.expedientesService.update(id, dto, req.user);
  }

  // DELETE /expedientes/{id} (routes.py:377-395).
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.expedientesService.remove(id, req.user);
  }

  // POST /expedientes/{id}/enviar (routes.py:398-435). El Python de
  // referencia no declara `status_code` -> default FastAPI 200 (no crea un
  // recurso nuevo, transiciona uno existente); se fuerza 200 aquí por la
  // misma razón que AuthController.login fuerza 200 en vez del 201 por
  // defecto de Nest.
  @Post(':id/enviar')
  @HttpCode(HttpStatus.OK)
  enviar(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.expedientesService.enviar(id, req.user);
  }

  // POST /expedientes/{id}/documentos (routes.py:447-573). multipart/form-data:
  // campo de archivo "file" + campos opcionales tipoDocumento/esObligatorio.
  // `FileInterceptor` sin opciones usa multer en modo memoria (sin `dest` ni
  // `storage` -> `MemoryStorage`), igual que Python que carga todo el
  // contenido en memoria (`await file.read()`) antes de subirlo al bucket.
  @Post(':id/documentos')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  uploadDocumento(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: ArchivoSubido,
    @Body() dto: UploadDocumentoDto,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Debes adjuntar un archivo.');
    }
    return this.expedientesService.uploadDocumento(id, file, dto, req.user);
  }

  // POST /expedientes/{id}/subsanacion (routes.py:855-905). A diferencia de
  // `enviar` (forzado a 200 para paridad con FastAPI), aquí se deja el 201
  // default de Nest a propósito: la Task 7 así lo especifica en su test de
  // referencia (`test/subsanacion.e2e-spec.ts`), aunque el Python real
  // tampoco declare `status_code` (-> 200 implícito ahí).
  @Post(':id/subsanacion')
  submitSubsanacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubsanacionDto,
    @Req() req: any,
  ) {
    return this.expedientesService.submitSubsanacion(id, dto, req.user);
  }
}
