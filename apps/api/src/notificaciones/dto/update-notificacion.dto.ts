import { IsBoolean, IsOptional } from 'class-validator';

// Equivalente a `NotificacionUpdate` (comite/backend/app/schemas/__init__.py:226-227).
export class UpdateNotificacionDto {
  @IsOptional()
  @IsBoolean()
  leida?: boolean;
}
