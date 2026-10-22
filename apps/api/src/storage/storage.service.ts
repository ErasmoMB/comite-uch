import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Almacenamiento de documentos.
 *
 * Por defecto apunta a Cloudflare R2 (API S3-compatible). Con
 * `STORAGE_DRIVER=local` guarda los archivos en una carpeta del disco
 * (`STORAGE_LOCAL_DIR`), para correr el sistema en un servidor propio sin R2.
 *
 * Cualquier proveedor S3-compatible funciona con solo cambiar las variables R2_*.
 */
@Injectable()
export class StorageService {
  private client?: S3Client;
  private readonly local: boolean;
  private readonly localRoot: string;

  constructor() {
    this.local = process.env.STORAGE_DRIVER === 'local';
    this.localRoot = resolve(process.env.STORAGE_LOCAL_DIR ?? join(process.cwd(), 'almacenamiento'));

    if (!this.local) {
      this.client = new S3Client({
        endpoint: process.env.R2_ENDPOINT,
        // R2 expone una unica region logica, siempre "auto".
        region: process.env.R2_REGION ?? 'auto',
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
        // R2 (y varios S3-compatibles) requieren addressing por path, no
        // virtual-hosted-style (bucket como subdominio).
        forcePathStyle: true,
      });
    }
  }

  getClient() {
    if (!this.client) {
      // Modo local: misma forma que el cliente S3 para que el código y las
      // pruebas que usan headObject/deleteObject sigan funcionando igual.
      return {
        headObject: async (params: { Bucket: string; Key: string }) => {
          const info = await stat(this.localPath(params.Key));
          return { ContentLength: info.size };
        },
        deleteObject: async (params: { Bucket: string; Key: string }) => {
          await rm(this.localPath(params.Key), { force: true });
          return {};
        },
      };
    }
    return {
      headObject: (params: { Bucket: string; Key: string }) =>
        this.client!.send(new HeadObjectCommand(params)),
      deleteObject: (params: { Bucket: string; Key: string }) =>
        this.client!.send(new DeleteObjectCommand(params)),
    };
  }

  getBucket(): string {
    return process.env.R2_BUCKET ?? 'comite-etica-documentos';
  }

  // Documentos guardados en la época en que las subidas caían al disco local
  // (antes de tener almacenamiento de objetos) quedaron con `rutaArchivo` en
  // formato de ruta de Windows (`uploads\24\archivo.pdf`). Una key S3 solo
  // acepta '/' como separador -- con '\' la API rechaza el request entero con
  // `InvalidKey` antes de siquiera buscar el objeto. Normalizar aquí es el
  // único punto de entrada a S3, así que cubre todos los llamadores.
  private normalizeKey(key: string): string {
    return key.replace(/\\/g, '/');
  }

  // Ruta física de una key dentro de la carpeta local. Rechaza cualquier key
  // que salga de esa carpeta (p. ej. con '..').
  private localPath(key: string): string {
    const path = resolve(this.localRoot, this.normalizeKey(key));
    if (!path.startsWith(this.localRoot + sep)) {
      throw new Error('Ruta de almacenamiento inválida');
    }
    return path;
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    if (this.local) {
      const path = this.localPath(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
      return;
    }
    await this.client!.send(
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
    if (this.local) {
      throw new Error('Las URL firmadas no están disponibles con STORAGE_DRIVER=local');
    }
    return getSignedUrl(
      this.client!,
      new GetObjectCommand({ Bucket: this.getBucket(), Key: this.normalizeKey(key) }),
      { expiresIn: expiresInSeconds },
    );
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    if (this.local) {
      return readFile(this.localPath(key));
    }
    const resp = await this.client!.send(
      new GetObjectCommand({ Bucket: this.getBucket(), Key: this.normalizeKey(key) }),
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}
