import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

// Alta de usuario hecha por el administrador (cualquier rol, incl. internos).
// Equivalente a `AdminUserCreate` en comite/backend/app/schemas/__init__.py:23-32.
//
// Deliberadamente NO se restringe `rol` con `@IsIn(ROLES_VALIDOS)` aquí: el
// backend Python de referencia acepta cualquier string a nivel de schema y
// valida el rol dentro del handler (comite/backend/app/api/users/routes.py:27-29),
// DESPUÉS de comprobar que quien llama es administrador. Si se validara acá
// con el ValidationPipe, un rol inválido enviado por un administrador seguiría
// devolviendo 400 (paridad correcta), pero se mantiene la validación en el
// servicio para reflejar exactamente el orden de comprobaciones del Python.
export class AdminCreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  nombre: string;

  @IsString()
  apellido: string;

  @IsString()
  rol: string;

  @IsOptional()
  @IsString()
  especialidad?: string;

  @IsOptional()
  @IsInt()
  cargaTrabajo?: number;

  @IsOptional()
  @IsBoolean()
  conflictoInteres?: boolean;
}
