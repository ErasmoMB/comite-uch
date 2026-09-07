import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AutorDto } from './autor.dto';

// Equivalente a `ExpedienteCreate` en
// comite/backend/app/schemas/__init__.py:91-101.
//
// Deliberadamente NO existe un campo `modalidad` aquí: en el backend Python
// (routes.py:255-256) la modalidad se deriva SIEMPRE de
// `ROL_A_MODALIDAD[current_user.rol]`, nunca del payload del cliente. Si un
// cliente enviara `modalidad` en el body, `ValidationPipe({ whitelist: true })`
// lo descarta silenciosamente antes de llegar al service.
export class CreateExpedienteDto {
  @IsString()
  tituloProtocolo: string;

  @IsOptional()
  @IsString()
  tipoTramite?: string;

  // Observación 1 del Comité: ARTICULO | TESIS | OTRO. Se valida contra el
  // catálogo compartido en el servicio (mismo criterio que
  // programaEstudios/ciclo/nivelPosgrado: el cliente manda el texto, no un id).
  @IsOptional()
  @IsString()
  tipoProyecto?: string;

  @IsOptional()
  @IsString()
  facultad?: string;

  @IsOptional()
  @IsString()
  programaEstudios?: string;

  @IsOptional()
  @IsString()
  ciclo?: string;

  @IsOptional()
  @IsString()
  nivelPosgrado?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutorDto)
  autores?: AutorDto[] = [];
}
