import { Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';

// No importa PrismaModule explícitamente: es @Global() (mismo patrón que
// ChatModule/ExpedientesModule/EvaluacionModule).
@Module({
  providers: [NotificacionesService],
  controllers: [NotificacionesController],
})
export class NotificacionesModule {}
