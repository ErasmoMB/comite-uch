import Anthropic from '@anthropic-ai/sdk';
import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { EntradaIa, ProveedorIa } from './proveedor-ia';

/**
 * Único punto del sistema que habla con la API de Claude (Anthropic).
 *
 * Hermano de `gemini.client.ts`: los dos implementan `ProveedorIa`, así que el
 * servicio no sabe cuál está atendiendo. Cambiar de proveedor es una variable
 * de entorno, no un cambio de código.
 */

// Opus 5 es el modelo recomendado para este uso: leer un proyecto de
// investigación completo y emitir un juicio ético razonado por criterio. Aquí
// el costo de equivocarse (un puntaje mal justificado que el evaluador tenga
// que rehacer) pesa más que un par de segundos de latencia. `CLAUDE_MODELO` lo
// cambia si se quiere probar uno más rápido, ej. claude-sonnet-5.
const MODELO_POR_DEFECTO = 'claude-opus-5';

// Techo de la respuesta. En Opus 5 el razonamiento va DENTRO de este límite, no
// aparte, así que un valor ajustado al JSON esperado cortaría la respuesta a
// media frase.
const MAX_TOKENS = 16_000;

const TIMEOUT_MS = 90_000;

/**
 * Restricciones que Claude NO acepta en el esquema y rechaza con 400 (probado:
 * `minItems: 7` devuelve "values other than 0 or 1 are not supported"). Se
 * quitan al traducir; no se pierde nada real, porque `normalizarSugerencias`
 * ya trata el esquema como una guía y no como una garantía: completa los
 * criterios que falten y recorta los puntajes fuera de rango.
 */
const NO_SOPORTADAS = new Set([
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'multipleOf',
  'minLength',
  'maxLength',
]);

/**
 * El esquema del proyecto está escrito en el dialecto de Gemini (tipos en
 * MAYÚSCULAS, herencia de OpenAPI). Claude espera JSON Schema estándar y exige
 * `additionalProperties: false` en cada objeto. Se traduce aquí, en la frontera
 * del proveedor, para que siga habiendo UNA sola definición de la rúbrica.
 */
function aJsonSchema(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(aJsonSchema);
  if (!nodo || typeof nodo !== 'object') return nodo;

  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(nodo as Record<string, unknown>)) {
    if (NO_SOPORTADAS.has(clave)) continue;
    salida[clave] = clave === 'type' && typeof valor === 'string' ? valor.toLowerCase() : aJsonSchema(valor);
  }
  if (salida.type === 'object' && salida.properties) {
    salida.additionalProperties = false;
    // Claude exige que `required` liste TODAS las propiedades del objeto.
    salida.required = Object.keys(salida.properties as Record<string, unknown>);
  }
  return salida;
}

@Injectable()
export class ClaudeClient implements ProveedorIa {
  private readonly logger = new Logger(ClaudeClient.name);

  readonly nombre = 'claude';

  get modelo(): string {
    return process.env.CLAUDE_MODELO?.trim() || MODELO_POR_DEFECTO;
  }

  estaConfigurado(): boolean {
    return !!process.env.ANTHROPIC_API_KEY?.trim();
  }

  private cliente(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('El asistente de IA no está configurado en este servidor.');
    }
    return new Anthropic({ apiKey, timeout: TIMEOUT_MS });
  }

  /**
   * Un PDF va como bloque `document` y una imagen como `image`; mandar uno con
   * el tipo del otro da 400. El bloque del archivo va ANTES del texto: es lo
   * que recomienda Anthropic para que el modelo lea el documento y después la
   * instrucción.
   */
  private partes(entrada: EntradaIa): Anthropic.Beta.BetaContentBlockParam[] {
    const bloques: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (entrada.archivo) {
      const { buffer, mime } = entrada.archivo;
      const data = buffer.toString('base64');
      if (mime === 'application/pdf') {
        bloques.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
      } else if (mime === 'text/plain') {
        bloques.push({ type: 'document', source: { type: 'text', media_type: 'text/plain', data: buffer.toString('utf8') } });
      } else {
        bloques.push({
          type: 'image',
          source: { type: 'base64', media_type: mime as 'image/jpeg' | 'image/png' | 'image/webp', data },
        });
      }
    }
    bloques.push({ type: 'text', text: entrada.texto });
    return bloques;
  }

  private async pedir(
    entrada: EntradaIa,
    esquema?: Record<string, unknown>,
  ): Promise<string> {
    const cliente = this.cliente();

    let respuesta: Anthropic.Beta.BetaMessage;
    try {
      respuesta = await cliente.beta.messages.create({
        model: this.modelo,
        max_tokens: MAX_TOKENS,
        // Si los clasificadores de seguridad rechazan la petición, el servidor
        // la reintenta solo en otro modelo en vez de devolvernos el rechazo.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        ...(esquema
          ? {
              output_config: {
                format: { type: 'json_schema' as const, schema: aJsonSchema(esquema) as Record<string, unknown> },
              },
            }
          : {}),
        messages: [{ role: 'user', content: this.partes(entrada) }],
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) {
        // "sin cuota" y "algo falló" piden acciones distintas del usuario.
        throw new ServiceUnavailableException('Se agotó la cuota del asistente de IA por ahora. Intenta más tarde.');
      }
      const detalle = e instanceof Error ? e.message : String(e);
      this.logger.error(`Claude falló: ${detalle.slice(0, 300)}`);
      if (e instanceof Anthropic.APIConnectionTimeoutError) {
        throw new BadGatewayException(
          'El asistente de IA no respondió a tiempo. Puedes completar la rúbrica manualmente.',
        );
      }
      throw new BadGatewayException('El asistente de IA devolvió un error.');
    }

    // Hay que mirar `stop_reason` ANTES del contenido: en un rechazo la
    // respuesta llega con HTTP 200 y el contenido vacío o a medias.
    if (respuesta.stop_reason === 'refusal') {
      this.logger.warn(`Claude rechazó la solicitud: ${JSON.stringify(respuesta.stop_details ?? {}).slice(0, 200)}`);
      throw new BadGatewayException(
        'El asistente de IA no pudo procesar este documento. Puedes completar la rúbrica manualmente.',
      );
    }

    const texto = respuesta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    if (!texto) {
      this.logger.error(`Respuesta de Claude sin texto: ${JSON.stringify(respuesta.content).slice(0, 300)}`);
      throw new BadGatewayException('El asistente de IA devolvió una respuesta vacía.');
    }
    return texto;
  }

  async generar(entrada: EntradaIa): Promise<string> {
    return this.pedir(entrada);
  }

  async generarJson<T>(entrada: EntradaIa, esquema: Record<string, unknown>): Promise<T> {
    const texto = await this.pedir(entrada, esquema);
    try {
      return JSON.parse(texto) as T;
    } catch {
      this.logger.error(`Claude devolvió JSON inválido: ${texto.slice(0, 300)}`);
      throw new BadGatewayException('El asistente de IA devolvió una respuesta con formato inesperado.');
    }
  }
}
