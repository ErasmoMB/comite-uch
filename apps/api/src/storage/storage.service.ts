import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cliente de almacenamiento de objetos (API S3-compatible).
 *
 * Hoy apunta a Supabase Storage (via su endpoint S3-compatible), el mismo
 * bucket que ya usa el backend Python (comite/backend/app/utils/storage.py).
 * Cualquier proveedor S3-compatible funciona con solo cambiar las variables
 * de entorno SUPABASE_S3_*.
 */
@Injectable()
export class StorageService {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      endpoint: process.env.SUPABASE_S3_ENDPOINT,
      region: process.env.SUPABASE_S3_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
      },
      // Supabase Storage (y varios S3-compatibles) requieren addressing por
      // path, no virtual-hosted-style (bucket como subdominio).
      forcePathStyle: true,
    });
  }

  getClient() {
    return {
      headObject: (params: { Bucket: string; Key: string }) =>
        this.client.send(new HeadObjectCommand(params)),
      deleteObject: (params: { Bucket: string; Key: string }) =>
        this.client.send(new DeleteObjectCommand(params)),
    };
  }

  getBucket(): string {
    return process.env.SUPABASE_S3_BUCKET ?? 'comite-etica-documentos';
  }

  // Documentos guardados antes de que S3/Supabase Storage estuviera
  // configurado (ver docs de migración) quedaron con `rutaArchivo` en formato
  // de ruta local de Windows (`uploads\24\archivo.pdf`). Una key S3 solo
  // acepta '/' como separador -- con '\' la API rechaza el request entero con
  // `InvalidKey` antes de siquiera buscar el objeto. Normalizar aquí es el
  // único punto de entrada a S3, así que cubre todos los llamadores.
  private normalizeKey(key: string): string {
    return key.replace(/\\/g, '/');
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.getBucket(),
        Key: this.normalizeKey(key),
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getPresignedUrl(
    key: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.getBucket(), Key: this.normalizeKey(key) }),
      { expiresIn: expiresInSeconds },
    );
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const resp = await this.client.send(
      new GetObjectCommand({ Bucket: this.getBucket(), Key: this.normalizeKey(key) }),
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}
