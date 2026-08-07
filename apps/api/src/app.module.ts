import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { PdfModule } from './pdf/pdf.module';
import { UsersModule } from './users/users.module';
import { ExpedientesModule } from './expedientes/expedientes.module';
import { EvaluacionModule } from './evaluacion/evaluacion.module';
import { ChatModule } from './chat/chat.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { EmailModule } from './email/email.module';
import { ConfigModule } from './config/config.module';
import { ReportesModule } from './reportes/reportes.module';
import { PlantillasModule } from './plantillas/plantillas.module';
import { IaModule } from './ia/ia.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StorageModule,
    PdfModule,
    UsersModule,
    ExpedientesModule,
    EvaluacionModule,
    ChatModule,
    NotificacionesModule,
    EmailModule,
    ConfigModule,
    ReportesModule,
    PlantillasModule,
    IaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // ValidationPipe global (whitelist + transform), registrado como
    // provider `APP_PIPE` en vez de únicamente vía `app.useGlobalPipes()` en
    // main.ts: los ~14 specs e2e crean su propia instancia de Nest con
    // `Test.createTestingModule({ imports: [AppModule] }).createNestApplication()`
    // y nunca invocan el `bootstrap()` de main.ts, así que un
    // `app.useGlobalPipes()` puesto solo ahí sería invisible en los tests.
    // Registrarlo aquí como provider hace que aplique de forma idéntica en
    // producción y en cualquier módulo de testing que importe AppModule.
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, transform: true }) },
  ],
})
export class AppModule {}
