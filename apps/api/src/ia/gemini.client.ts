import { Injectable, Logger, ServiceUnavailableException, BadGatewayException } from '@nestjs/common';

/**
 * Único punto del sistema que habla con la API de Gemini.
 *
 * Todo lo específico del proveedor vive aquí: la URL, la forma del cuerpo, cómo
 * se adjunta un PDF y cómo se pide salida estructurada. Si mañana se cambia a
 * Claude u otro proveedor, se reemplaza este archivo y nada más — el mismo
 * criterio con el que `StorageService` aisló a R2.
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Modelo por defecto medido contra la API real (ver el diseño): responde en
// ~2.6s frente a ~9.6s de gemini-3.5-flash, con la misma calidad estructural.
// Para un evaluador que está esperando, esa diferencia se nota.
const MODELO_POR_DEFECTO = 'gemini-3.1-flash-lite';

// Un análisis de un proyecto largo puede tardar; pasado este tiempo se aborta y
// el evaluador sigue con la rúbrica manual, que nunca deja de funcionar.
const TIMEOUT_MS = 90_000;

export interface ParteTexto {
  text: string;
}
export interface ParteArchivo {
  inline_data: { mime_type: string; data: string };
}
export type Parte = ParteTexto | ParteArchivo;

export interface OpcionesGenerar {
  /** Esquema JSON que debe cumplir la respuesta. Si se omite, devuelve texto. */
  esquema?: Record<string, unknown>;
  /** Bajo por defecto: evaluar una rúbrica no debe dar resultados distintos en cada intento. */
  temperatura?: number;
}

@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);

  get modelo(): string {
    return process.env.GEMINI_MODELO?.trim() || MODELO_POR_DEFECTO;
  }

  /** La función de IA se oculta en la interfaz cuando esto es false. */
  estaConfigurado(): boolean {
    return !!process.env.GEMINI_API_KEY?.trim();
  }

  private assertConfigurado(): string {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'El asistente de IA no está configurado en este servidor.',
      );
    }
    return key;
  }

  /** Devuelve el texto crudo de la respuesta del modelo. */
  async generar(partes: Parte[], opciones: OpcionesGenerar = {}): Promise<string> {
    const key = this.assertConfigurado();

    const generationConfig: Record<string, unknown> = {
      temperature: opciones.temperatura ?? 0.2,
    };
    if (opciones.esquema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = opciones.esquema;
    }

    const abort = new AbortController();
    const cancelar = setTimeout(() => abort.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/models/${this.modelo}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: partes }], generationConfig }),
        signal: abort.signal,
      });
    } catch {
      throw new BadGatewayException(
        'El asistente de IA no respondió a tiempo. Puedes completar la rúbrica manualmente.',
      );
    } finally {
      clearTimeout(cancelar);
    }

    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      this.logger.error(`Gemini HTTP ${res.status}: ${detalle.slice(0, 300)}`);
      // 429 se distingue a propósito: "sin cuota" y "algo falló" piden acciones
      // distintas del usuario (esperar vs reintentar o avisar al admin).
      if (res.status === 429) {
        throw new ServiceUnavailableException(
          'Se agotó la cuota del asistente de IA por hoy. Intenta más tarde.',
        );
      }
      throw new BadGatewayException('El asistente de IA devolvió un error.');
    }

    const cuerpo = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const texto = cuerpo.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto) {
      this.logger.error(`Respuesta de Gemini sin texto: ${JSON.stringify(cuerpo).slice(0, 300)}`);
      throw new BadGatewayException('El asistente de IA devolvió una respuesta vacía.');
    }
    return texto;
  }

  /** Igual que `generar`, pero parsea la respuesta como JSON. */
  async generarJson<T>(partes: Parte[], esquema: Record<string, unknown>): Promise<T> {
    const texto = await this.generar(partes, { esquema });
    try {
      return JSON.parse(texto) as T;
    } catch {
      this.logger.error(`Gemini devolvió JSON inválido: ${texto.slice(0, 300)}`);
      throw new BadGatewayException('El asistente de IA devolvió una respuesta con formato inesperado.');
    }
  }

  /** Adjunta un documento (PDF) al prompt. */
  static archivo(buffer: Buffer, mimeType = 'application/pdf'): ParteArchivo {
    return { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } };
  }
}
