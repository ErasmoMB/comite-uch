import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateMensajeDto } from './dto/create-mensaje.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES_AUTO_REGISTRO } from '../auth/constants';

// La secretaría comparte bandeja; el admin también puede atenderla (igual
// que `ROLES_SECRETARIA` en routes.py:26).
const ROLES_SECRETARIA = ['secretaria', 'administrador'];

// Equivalente 1:1 a comite/backend/app/api/chat/routes.py.
//
// OJO orden de rutas: las fijas ('mios', 'mios/no-leidos', 'conversaciones',
// 'solicitantes', 'no-leidos') se declaran ANTES que la dinámica
// (':solicitanteId') para que Nest no intente resolverlas como si fueran un
// id numérico -- mismo criterio que en el Python de referencia (ver
// comentario de cabecera de routes.py) y que EvaluacionController /
// ExpedientesController en este mismo backend.
@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  // ---------- Lado solicitante (rutas fijas) ----------

  // GET /chat/mios (routes.py:61-76).
  @Get('mios')
  @Roles(...ROLES_AUTO_REGISTRO)
  getMisMensajes(@Req() req: any) {
    return this.chatService.getMisMensajes(req.user);
  }

  // POST /chat/mios (routes.py:79-87). Python no declara `status_code` (->
  // 200 implícito en FastAPI, confirmado por los tests que assertan
  // `status_code == 200`); se fuerza el mismo 200 aquí en vez del 201
  // default de Nest.
  @Post('mios')
  @Roles(...ROLES_AUTO_REGISTRO)
  @HttpCode(HttpStatus.OK)
  enviarMensajeSolicitante(@Body() dto: CreateMensajeDto, @Req() req: any) {
    return this.chatService.enviarMensajeSolicitante(dto, req.user);
  }

  // GET /chat/mios/no-leidos (routes.py:90-99).
  @Get('mios/no-leidos')
  @Roles(...ROLES_AUTO_REGISTRO)
  misNoLeidos(@Req() req: any) {
    return this.chatService.misNoLeidos(req.user);
  }

  // ---------- Lado secretaría (rutas fijas) ----------

  // GET /chat/conversaciones (routes.py:104-156).
  @Get('conversaciones')
  @Roles(...ROLES_SECRETARIA)
  getConversaciones() {
    return this.chatService.getConversaciones();
  }

  // GET /chat/solicitantes (routes.py:159-178).
  @Get('solicitantes')
  @Roles(...ROLES_SECRETARIA)
  getSolicitantes() {
    return this.chatService.getSolicitantes();
  }

  // GET /chat/no-leidos (routes.py:181-189).
  @Get('no-leidos')
  @Roles(...ROLES_SECRETARIA)
  totalNoLeidos() {
    return this.chatService.totalNoLeidos();
  }

  // ---------- Lado secretaría (rutas dinámicas, SIEMPRE al final) ----------

  // GET /chat/{solicitanteId} (routes.py:194-210).
  @Get(':solicitanteId')
  @Roles(...ROLES_SECRETARIA)
  getHilo(@Param('solicitanteId', ParseIntPipe) solicitanteId: number) {
    return this.chatService.getHilo(solicitanteId);
  }

  // POST /chat/{solicitanteId} (routes.py:213-223). Mismo criterio de
  // status code 200 explícito que POST /chat/mios (arriba).
  @Post(':solicitanteId')
  @Roles(...ROLES_SECRETARIA)
  @HttpCode(HttpStatus.OK)
  enviarMensajeSecretaria(
    @Param('solicitanteId', ParseIntPipe) solicitanteId: number,
    @Body() dto: CreateMensajeDto,
    @Req() req: any,
  ) {
    return this.chatService.enviarMensajeSecretaria(
      solicitanteId,
      dto,
      req.user,
    );
  }
}
