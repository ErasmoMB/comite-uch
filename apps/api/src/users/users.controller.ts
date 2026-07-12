import {
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
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Equivalente 1:1 a comite/backend/app/api/users/routes.py.
//
// El ValidationPipe (whitelist + transform) para AdminCreateUserDto/
// UpdateUserDto se aplica globalmente vía provider APP_PIPE en app.module.ts.
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // GET /users/ — cualquier usuario autenticado (routes.py:49-52).
  @Get()
  findAll(@Query('skip') skip?: string, @Query('limit') limit?: string) {
    const skipNum = skip !== undefined ? parseInt(skip, 10) : 0;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 100;
    return this.usersService.findAll(skipNum, limitNum);
  }

  // GET /users/me — debe ir antes de GET /users/:id para que Nest no
  // intente parsear "me" como un id (routes.py:54-56).
  @Get('me')
  findMe(@Req() req: any) {
    return this.usersService.findMe(req.user);
  }

  // GET /users/{id} (routes.py:58-63).
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  // POST /users/ — solo administrador (routes.py:14-47).
  @Post()
  @UseGuards(RolesGuard)
  @Roles('administrador')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: AdminCreateUserDto, @Req() req: any) {
    return this.usersService.create(dto, req.user);
  }

  // PUT /users/{id} — el propio usuario o un administrador (routes.py:65-82).
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    return this.usersService.update(id, dto, req.user);
  }

  // DELETE /users/{id}/permanente — solo administrador. Debe declararse
  // ANTES que DELETE /users/{id} para que Nest no intente resolver
  // "permanente" como si fuera parte de otra ruta.
  @Delete(':id/permanente')
  @UseGuards(RolesGuard)
  @Roles('administrador')
  removePermanente(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.usersService.eliminarPermanente(id, req.user);
  }

  // DELETE /users/{id} — solo administrador, soft-delete (routes.py:84-93).
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('administrador')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.usersService.remove(id, req.user);
  }
}
