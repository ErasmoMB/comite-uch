import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

// No importa PrismaModule ni AuthModule explícitamente: PrismaModule es
// @Global() (ver prisma/prisma.module.ts) y JwtAuthGuard/JwtStrategy quedan
// registrados globalmente por Passport una vez que AuthModule se instancia
// en AppModule (confirmado en test/auth.e2e-spec.ts, donde un controller
// ajeno a AuthModule usa JwtAuthGuard/RolesGuard sin problema).
@Module({
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
