import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Decisión: NO se restaura el prefijo /api/v1 de Python — el nuevo frontend
// (Etapa B) todavía no existe y se puede apuntar a la raíz sin costo; ver
// revisión final whole-branch.
//
// Decisión: se usa el formato de error nativo de Nest ({statusCode, message,
// error}), no el {detail} de FastAPI — Etapa B se construye contra este
// formato.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: equivalente práctico al `allow_origins=["*"]` + `allow_credentials
  // =True` de comite/backend/app/main.py, pero sin violar la spec de CORS
  // (que prohíbe combinar wildcard de origen con credentials). `origin: true`
  // refleja el origen real de cada request, permitiendo credentials.
  app.enableCors({ origin: true, credentials: true });

  // El ValidationPipe global (whitelist + transform) — promovido desde los
  // `@UsePipes(...)` que cada controller repetía individualmente — se
  // registra en app.module.ts como provider `APP_PIPE`, no aquí: así aplica
  // igual en producción y en los specs e2e que construyen su propia
  // instancia de Nest a partir de AppModule sin pasar por este bootstrap().

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
