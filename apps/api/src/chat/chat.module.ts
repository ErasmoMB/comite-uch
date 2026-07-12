import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';

// No importa PrismaModule explícitamente: es @Global() (mismo patrón que
// EvaluacionModule/ExpedientesModule).
@Module({
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
