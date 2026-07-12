import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

// Campos que acompañan al archivo en el multipart/form-data de
// `upload_documento` (comite/backend/app/api/expedientes/routes.py:464-471).
// Mismos defaults que Python: tipo_documento="documento", es_obligatorio=True
// (aplicados en ExpedientesService.uploadDocumento, no aquí, para que quede
// explícito en un solo lugar igual que el resto del servicio).
//
// Nota: en un multipart/form-data TODOS los campos que no son el archivo
// llegan como string ("true"/"false"), por eso `esObligatorio` necesita un
// @Transform manual — @IsBoolean por sí solo rechazaría el string "true".
export class UploadDocumentoDto {
  @IsOptional()
  @IsString()
  tipoDocumento?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return value;
  })
  @IsBoolean()
  esObligatorio?: boolean;
}
