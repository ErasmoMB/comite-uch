import { Module } from '@nestjs/common';
import { ExpedientesService } from './expedientes.service';
import { ExpedientesController } from './expedientes.controller';
import { ConfigModule } from '../config/config.module';

// No importa PrismaModule ni AuthModule explícitamente: PrismaModule es
// @Global() y JwtAuthGuard/JwtStrategy quedan registrados globalmente por
// Passport una vez que AuthModule se instancia en AppModule (mismo patrón ya
// usado en UsersModule).
//
// ConfigModule (Task 11) SÍ hay que importarlo explícitamente -- no es
// @Global() -- para que ExpedientesService pueda inyectar ConfigService y
// hacer el chequeo de fecha límite dentro de `enviar()`.
@Module({
  imports: [ConfigModule],
  providers: [ExpedientesService],
  controllers: [ExpedientesController],
  exports: [ExpedientesService],
})
export class ExpedientesModule {}
