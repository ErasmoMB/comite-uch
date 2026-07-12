import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AutorDto } from './autor.dto';

// Equivalente a `CambioTituloCreate` en
// comite/backend/app/schemas/__init__.py:103-108.
export class CambioTituloDto {
  @IsInt()
  proyectoOrigenId: number;

  @IsString()
  programaEstudios: string;

  @IsString()
  ciclo: string;

  @IsString()
  tituloNuevo: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutorDto)
  autores?: AutorDto[] = [];
}
