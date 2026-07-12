import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ConfigService } from './config.service';
import { SetFechaLimiteDto } from './dto/set-fecha-limite.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Equivalente 1:1 a comite/backend/app/api/config/routes.py.
@Controller('config')
@UseGuards(JwtAuthGuard)
export class ConfigController {
  constructor(private configService: ConfigService) {}

  // GET /config/fecha-limite -- cualquier usuario autenticado (routes.py:36-38).
  @Get('fecha-limite')
  getFechaLimite() {
    return this.configService.getFechaLimite();
  }

  // PUT /config/fecha-limite -- solo administrador (routes.py:41-59).
  @Put('fecha-limite')
  @UseGuards(RolesGuard)
  @Roles('administrador')
  setFechaLimite(@Body() dto: SetFechaLimiteDto) {
    return this.configService.setFechaLimite(dto.fechaLimite);
  }
}
