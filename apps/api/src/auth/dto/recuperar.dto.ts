import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class SolicitarRecuperacionDto {
  @IsEmail()
  email: string;
}

export class VerificarCodigoDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  codigo: string;
}

export class CambiarPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  codigo: string;

  @IsString()
  @MinLength(6)
  nuevaPassword: string;
}
