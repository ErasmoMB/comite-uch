import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConsultarDto {
  // Tope alto para no cortar preguntas legítimas, pero acotado: el cuerpo va
  // dentro del prompt y no debe usarse para inyectar texto arbitrario largo.
  @IsString()
  @MinLength(3, { message: 'La pregunta es demasiado corta.' })
  @MaxLength(1000, { message: 'La pregunta no puede superar los 1000 caracteres.' })
  pregunta: string;
}
