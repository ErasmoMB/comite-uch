import { IsInt, IsOptional, IsString } from 'class-validator';

// Equivalente a `CriterioEvaluacionInput`
// (comite/backend/app/schemas/__init__.py:168-171). El rango 0..puntajeMax
// específico de cada criterio se valida en el servicio (depende de la
// `key`), no aquí con un decorador genérico.
export class CriterioInputDto {
  @IsString()
  key: string;

  @IsInt()
  puntaje: number;

  @IsOptional()
  @IsString()
  observacion?: string;
}
