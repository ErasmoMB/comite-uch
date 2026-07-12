import { IsOptional, IsString } from 'class-validator';

// Equivalente a `FechaLimiteIn` (comite/backend/app/api/config/routes.py:18-19):
// cadena ISO 8601 opcional, o `null`/ausente para quitar la fecha límite
// configurada. La validación de que la cadena efectivamente sea una fecha
// ISO parseable ocurre en ConfigService (mismo lugar donde Python la valida
// dentro del handler, no en el schema Pydantic).
export class SetFechaLimiteDto {
  @IsOptional()
  @IsString()
  fechaLimite?: string | null;
}
