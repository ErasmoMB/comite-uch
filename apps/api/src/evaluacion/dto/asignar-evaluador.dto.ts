import { IsInt } from 'class-validator';

// Equivalente a `EvaluacionAsignarRequest` (comite/backend/app/schemas/__init__.py:193-194).
export class AsignarEvaluadorDto {
  @IsInt()
  evaluadorId: number;
}
