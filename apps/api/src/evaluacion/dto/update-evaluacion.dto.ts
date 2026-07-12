import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CriterioInputDto } from './criterio-input.dto';

// Equivalente a `EvaluacionUpdate` (comite/backend/app/schemas/__init__.py:187-191).
// Reutilizado también por `POST /evaluacion/{id}/guardar-parcial`, igual que
// en Python (`guardar_parcial` recibe el mismo `EvaluacionUpdate`, aunque en
// la práctica solo lee `observaciones`).
export class UpdateEvaluacionDto {
  @IsOptional()
  @IsString()
  recommendation?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsBoolean()
  completa?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterioInputDto)
  criterios?: CriterioInputDto[];
}
