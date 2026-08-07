import { Logger, Module } from '@nestjs/common';
import { ClaudeClient } from './claude.client';
import { GeminiClient } from './gemini.client';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { PROVEEDOR_IA, type ProveedorIa } from './proveedor-ia';

/**
 * Elige el proveedor de IA al arrancar.
 *
 * `IA_PROVEEDOR` manda si está puesto (`claude` | `gemini`). Si no, se usa el
 * que tenga clave configurada, con Claude primero: si alguien se molestó en
 * poner `ANTHROPIC_API_KEY`, es la que quiere usar. Sin ninguna clave se
 * devuelve igual un proveedor — responde `estaConfigurado() === false` y la
 * interfaz esconde el botón, en vez de tumbar el arranque del servidor.
 */
function elegirProveedor(gemini: GeminiClient, claude: ClaudeClient): ProveedorIa {
  const logger = new Logger('IA');
  const pedido = process.env.IA_PROVEEDOR?.trim().toLowerCase();

  let elegido: ProveedorIa;
  if (pedido === 'claude') elegido = claude;
  else if (pedido === 'gemini') elegido = gemini;
  else if (claude.estaConfigurado()) elegido = claude;
  else elegido = gemini;

  logger.log(
    elegido.estaConfigurado()
      ? `Proveedor: ${elegido.nombre} (${elegido.modelo})`
      : `Proveedor: ${elegido.nombre} SIN clave configurada — el asistente queda oculto`,
  );
  return elegido;
}

// PrismaModule y StorageModule son @Global, así que no hace falta importarlos.
@Module({
  controllers: [IaController],
  providers: [
    IaService,
    GeminiClient,
    ClaudeClient,
    {
      provide: PROVEEDOR_IA,
      inject: [GeminiClient, ClaudeClient],
      useFactory: elegirProveedor,
    },
  ],
  exports: [IaService],
})
export class IaModule {}
