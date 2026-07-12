import { IsOptional, IsString } from 'class-validator';

// Equivalente a `AutorBase` en comite/backend/app/schemas/__init__.py:76-80.
// Compartido por CreateExpedienteDto y CambioTituloDto (ambos reciben una
// lista de integrantes/autores con la misma forma en Python).
export class AutorDto {
  @IsString()
  apellidosNombres: string;

  @IsOptional()
  @IsString()
  codigoEstudiante?: string;

  @IsOptional()
  @IsString()
  correo?: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}
