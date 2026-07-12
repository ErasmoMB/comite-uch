import { IsNotEmpty, IsString } from 'class-validator';

// Equivalente al Form field `observaciones: str = Form(...)` de
// `submit_subsanacion` (comite/backend/app/api/expedientes/routes.py:870-874):
// obligatorio, no vacío. A diferencia de Python (que exige `multipart/form-data`
// porque usa `Form(...)`), aquí se acepta como JSON normal — el test de
// referencia de la Task 7 (`test/subsanacion.e2e-spec.ts`) envía el body con
// supertest `.send({ observaciones })`, que por defecto es JSON.
export class SubsanacionDto {
  @IsString()
  @IsNotEmpty()
  observaciones: string;
}
