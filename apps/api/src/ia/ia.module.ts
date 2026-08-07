import { Module } from '@nestjs/common';
import { GeminiClient } from './gemini.client';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';

// PrismaModule y StorageModule son @Global, así que no hace falta importarlos.
@Module({
  controllers: [IaController],
  providers: [IaService, GeminiClient],
  exports: [IaService],
})
export class IaModule {}
