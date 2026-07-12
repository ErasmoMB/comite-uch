import { Module } from '@nestjs/common';
import { EvaluacionService } from './evaluacion.service';
import { EvaluacionController } from './evaluacion.controller';
import { PdfModule } from '../pdf/pdf.module';
import { EmailModule } from '../email/email.module';

// No importa PrismaModule/StorageModule explícitamente: ambos son @Global()
// (mismo patrón que ExpedientesModule). PdfModule SÍ hay que importarlo --
// no es global, y `EvaluacionService` necesita `PdfService` para generar
// rúbrica/dictamen. `ExpedientesService.actualizarEstado` se importa
// directo como función desde `expedientes.service.ts` (no es un provider de
// Nest), así que tampoco hace falta importar ExpedientesModule aquí.
// EmailModule (Task 10): tampoco es @Global(), así que hay que importarlo
// para que `EvaluacionService` pueda inyectar `EmailService` y notificar el
// resultado de la evaluación por correo.
@Module({
  imports: [PdfModule, EmailModule],
  providers: [EvaluacionService],
  controllers: [EvaluacionController],
  exports: [EvaluacionService],
})
export class EvaluacionModule {}
