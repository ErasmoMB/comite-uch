/**
 * Contrato común de los proveedores de IA.
 *
 * El resto del sistema habla SOLO con esta interfaz: cambiar de Gemini a Claude
 * (o agregar un tercero) es escribir otro archivo que la implemente, sin tocar
 * `ia.service.ts` ni las pantallas. Mismo criterio con el que `storage.service`
 * aisló a R2.
 */

/** Un documento del expediente adjunto al prompt. */
export interface ArchivoIa {
  buffer: Buffer;
  /** MIME real del archivo: `application/pdf`, `image/jpeg`, … */
  mime: string;
}

export interface EntradaIa {
  /** Opcional: hay consultas que no necesitan adjuntar nada. */
  archivo?: ArchivoIa;
  texto: string;
}

export interface ProveedorIa {
  /** Nombre corto para logs y para `GET /ia/estado`: `gemini` | `claude`. */
  readonly nombre: string;

  /** Modelo concreto en uso; se guarda junto a cada sugerencia generada. */
  readonly modelo: string;

  /** La función de IA se oculta en la interfaz cuando esto es false. */
  estaConfigurado(): boolean;

  /** Texto libre. */
  generar(entrada: EntradaIa): Promise<string>;

  /** Respuesta que debe cumplir un esquema JSON. */
  generarJson<T>(entrada: EntradaIa, esquema: Record<string, unknown>): Promise<T>;
}

/** Token de inyección: en Nest una interfaz no existe en tiempo de ejecución. */
export const PROVEEDOR_IA = Symbol('PROVEEDOR_IA');
