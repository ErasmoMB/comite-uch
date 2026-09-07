import { IsNotEmpty, IsString } from 'class-validator';

// Observación 4 del Comité: el solicitante puede volver a enviar un
// expediente rechazado o con observaciones, explicando cómo las levantó.
// Misma forma que `SubsanacionDto` (que ahora delega en la misma lógica):
// un texto obligatorio y no vacío.
export class ReenviarDto {
  @IsString()
  @IsNotEmpty()
  observaciones: string;
}
