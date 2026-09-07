import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AutorDto } from './autor.dto';

// Equivalente a `ExpedienteUpdate` en
// comite/backend/app/schemas/__init__.py:110-118.
//
// `programaEstudios`/`ciclo`/`nivelPosgrado`/`autores` estaban deliberadamente
// omitidos porque el handler Python de referencia nunca los aplicaba. Resultó
// ser un bug real y observado: un expediente guardado como borrador con datos
// de autor incompletos (p. ej. sin teléfono) quedaba trabado — la validación
// de envío exigía el dato y no existía forma de completarlo. Ahora sí se
// portan, y `ExpedientesService.update` solo los aplica mientras el
// expediente siga en borrador.
export class UpdateExpedienteDto {
  @IsOptional()
  @IsString()
  tituloProtocolo?: string;

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
  estado?: string;

  @IsOptional()
  @IsString()
  programaEstudios?: string;

  @IsOptional()
  @IsString()
  ciclo?: string;

  @IsOptional()
  @IsString()
  nivelPosgrado?: string;

  // Reemplaza la lista completa de autores (no es un patch por autor): el
  // formulario del cliente edita la lista entera y la reenvía, igual que al
  // crear el expediente.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutorDto)
  autores?: AutorDto[];
}
