import { Module } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';
import { PdfModule } from '../pdf/pdf.module';

// No importa PrismaModule ni AuthModule explícitamente: PrismaModule es
// @Global() y JwtAuthGuard/RolesGuard quedan disponibles globalmente una vez
// que AuthModule se instancia en AppModule (mismo patrón que UsersModule).
@Module({
  imports: [PdfModule],
  providers: [ReportesService],
  controllers: [ReportesController],
})
export class ReportesModule {}
