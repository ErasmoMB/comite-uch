import { IsBoolean, IsOptional, IsString } from 'class-validator';

// Equivalente a `UserUpdate` en comite/backend/app/schemas/__init__.py:34-38.
// Todos los campos son opcionales: el handler decide, campo por campo, cuáles
// se aplican según quién hace la petición (ver UsersService.update).
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  apellido?: string;

  // Solo se aplica si quien edita es administrador (comite/backend/app/api/users/routes.py:76-77).
  @IsOptional()
  @IsString()
  rol?: string;

  // Solo se aplica si quien edita es administrador (comite/backend/app/api/users/routes.py:78-79).
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
