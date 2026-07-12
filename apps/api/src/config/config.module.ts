import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';

// No importa PrismaModule ni AuthModule explícitamente: PrismaModule es
// @Global() y JwtAuthGuard/RolesGuard quedan disponibles globalmente una vez
// que AuthModule se instancia en AppModule (mismo patrón que UsersModule).
//
// Exporta ConfigService porque ExpedientesModule lo necesita para el chequeo
// de fecha límite dentro de `ExpedientesService.enviar()` (Task 11).
@Module({
  providers: [ConfigService],
  controllers: [ConfigController],
  exports: [ConfigService],
})
export class ConfigModule {}
