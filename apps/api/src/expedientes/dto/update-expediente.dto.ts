import { IsOptional, IsString } from 'class-validator';

// Equivalente a `ExpedienteUpdate` en
// comite/backend/app/schemas/__init__.py:110-118 — PERO deliberadamente NO
// se portan `programa_estudios`, `ciclo`, `nivel_posgrado` ni `autores`: el
// schema Python los declara, pero el handler real `update_expediente`
// (routes.py:357-375) NUNCA los lee ni los aplica (solo toca
// titulo_protocolo/tipo_tramite/facultad/estado). Portar los campos no
// usados solo daría una falsa sensación de soporte. Si esa omisión resulta
// ser un bug del Python y no una decisión deliberada, hay que confirmarlo
// con el equipo antes de "corregirlo" aquí, para no divergir del
// comportamiento real de producción.
export class UpdateExpedienteDto {
  @IsOptional()
  @IsString()
  tituloProtocolo?: string;

  @IsOptional()
  @IsString()
  tipoTramite?: string;

  @IsOptional()
  @IsString()
  facultad?: string;

  @IsOptional()
  @IsString()
  estado?: string;
}
