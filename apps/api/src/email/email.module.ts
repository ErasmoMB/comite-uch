import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

// Sin dependencias propias del backend (ni PrismaService ni StorageService),
// así que no necesita importar nada más -- solo exporta EmailService para que
// EvaluacionModule (y cualquier otro módulo futuro) pueda inyectarlo.
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
