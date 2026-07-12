import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  nombre: string;

  @IsString()
  apellido: string;

  // Deliberadamente NO se usa @IsIn(ROLES_AUTO_REGISTRO) aquí: el backend
  // Python de referencia acepta cualquier string en este campo a nivel de
  // schema y rechaza los roles no permitidos en el handler con 403 Forbidden
  // (ver comite/backend/app/api/auth/routes.py:24-28). Si se restringiera acá
  // con @IsIn, un rol no permitido sería rechazado por el ValidationPipe con
  // 400 antes de llegar al AuthService, perdiendo la paridad de status code
  // (403) con el backend real.
  @IsString()
  rol: string;

  @IsOptional()
  @IsString()
  codigoEstudiante?: string;

  @IsOptional()
  @IsString()
  laboratorio?: string;
}
