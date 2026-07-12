import { IsString } from 'class-validator';

// Equivalente a `MensajeChatCreate` (comite/backend/app/schemas/__init__.py:240-241).
// Deliberadamente sin @IsNotEmpty/@MaxLength aquí: la validación de
// "vacío tras trim" y "máximo 2000 caracteres" vive en ChatService
// (_validar_texto en routes.py:43-49), para reusar el mismo mensaje de
// error exacto que el Python de referencia.
export class CreateMensajeDto {
  @IsString()
  texto: string;
}
