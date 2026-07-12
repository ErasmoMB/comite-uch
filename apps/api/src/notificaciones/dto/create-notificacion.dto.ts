import { IsInt, IsOptional, IsString } from 'class-validator';

// Equivalente a `NotificacionCreate` (comite/backend/app/schemas/__init__.py:218-224).
export class CreateNotificacionDto {
  @IsInt()
  usuarioId: number;

  @IsString()
  titulo: string;

  @IsString()
  mensaje: string;

  @IsOptional()
  @IsInt()
  expedienteId?: number;
}
