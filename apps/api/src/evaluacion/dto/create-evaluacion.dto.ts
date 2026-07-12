import { IsInt } from 'class-validator';

// Equivalente a `EvaluacionCreate` (comite/backend/app/schemas/__init__.py:184-185).
export class CreateEvaluacionDto {
  @IsInt()
  expedienteId: number;
}
