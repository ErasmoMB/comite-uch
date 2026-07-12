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
  UseGuards,
} from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { CreateNotificacionDto } from './dto/create-notificacion.dto';
import { UpdateNotificacionDto } from './dto/update-notificacion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Equivalente 1:1 a comite/backend/app/api/notificaciones/routes.py. Sin
// RolesGuard: cualquier usuario autenticado puede usar este controller (las
// comprobaciones de pertenencia viven en el service).
//
// Orden de rutas: 'sin-leer' y 'marcar-todas-leidas' se declaran ANTES que
// ':id' para que Nest no intente resolverlas como si fueran un id numérico
// (mismo criterio que EvaluacionController/ExpedientesController/ChatController).
@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(private notificacionesService: NotificacionesService) {}

  // GET /notificaciones/ (routes.py:12-14).
  @Get()
  findAll(
    @Req() req: any,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNum = skip !== undefined ? parseInt(skip, 10) : 0;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 50;
    return this.notificacionesService.findAll(req.user, skipNum, limitNum);
  }

  // GET /notificaciones/sin-leer (routes.py:16-19).
  @Get('sin-leer')
  countSinLeer(@Req() req: any) {
    return this.notificacionesService.countSinLeer(req.user);
  }

  // POST /notificaciones/marcar-todas-leidas (routes.py:52-56). Debe ir
  // antes de ':id' para que Nest no lo confunda con un Put(':id') -- son
  // verbos distintos así que no colisiona, pero se mantiene el mismo orden
  // que Python por claridad.
  @Post('marcar-todas-leidas')
  @HttpCode(HttpStatus.OK)
  marcarTodasLeidas(@Req() req: any) {
    return this.notificacionesService.marcarTodasLeidas(req.user);
  }

  // GET /notificaciones/{id} (routes.py:21-26).
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.notificacionesService.findOne(id, req.user);
  }

  // POST /notificaciones/ (routes.py:28-39). Python no declara `status_code`
  // (-> 200 implícito en FastAPI, no 201); se fuerza el mismo 200 aquí en vez
  // del 201 default de Nest (mismo criterio que ChatController).
  @Post()
  @HttpCode(HttpStatus.OK)
  create(@Body() dto: CreateNotificacionDto) {
    return this.notificacionesService.create(dto);
  }

  // PUT /notificaciones/{id} (routes.py:41-50).
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNotificacionDto,
    @Req() req: any,
  ) {
    return this.notificacionesService.update(id, dto, req.user);
  }
}
