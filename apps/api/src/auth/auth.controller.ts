import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CambiarPasswordDto, SolicitarRecuperacionDto, VerificarCodigoDto } from './dto/recuperar.dto';

// El ValidationPipe (whitelist + transform) para RegisterDto/LoginDto (email
// válido, largo mínimo de password, rol permitido, etc.) se aplica
// globalmente vía provider APP_PIPE en app.module.ts.
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // El backend Python (FastAPI) responde 200 OK en /auth/login (no crea un
  // recurso). El default de Nest para @Post es 201 Created; se fuerza 200
  // para no introducir una diferencia de status code innecesaria frente al
  // backend de referencia.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Post('recuperar/solicitar')
  @HttpCode(HttpStatus.OK)
  solicitarRecuperacion(@Body() dto: SolicitarRecuperacionDto) {
    return this.authService.solicitarRecuperacion(dto.email);
  }

  @Post('recuperar/verificar')
  @HttpCode(HttpStatus.OK)
  verificarCodigo(@Body() dto: VerificarCodigoDto) {
    return this.authService.verificarCodigo(dto.email, dto.codigo);
  }

  @Post('recuperar/cambiar')
  @HttpCode(HttpStatus.OK)
  cambiarPassword(@Body() dto: CambiarPasswordDto) {
    return this.authService.cambiarPassword(dto.email, dto.codigo, dto.nuevaPassword);
  }
}
