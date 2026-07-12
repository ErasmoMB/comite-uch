import 'dotenv/config';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { AppModule as AppModuleType } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';

// Redirige DATABASE_URL/SECRET_KEY al schema Postgres "test" (aislado de
// producción) ANTES de cargar AppModule. Mismo patrón que
// test/expedientes.e2e-spec.ts. OJO: el `import 'dotenv/config'` de arriba ya
// cargó SUPABASE_S3_* desde `.env` -- ese override NO los toca (solo
// redefine DATABASE_URL/SECRET_KEY), así que la subida real sigue apuntando
// al bucket real de Supabase Storage (mismo patrón que storage.e2e-spec.ts).
loadEnv({ path: path.join(__dirname, '..', '.env.test'), override: true });

const { AppModule } = require('../src/app.module') as {
  AppModule: typeof AppModuleType;
};

// Un PDF mínimo pero válido (cabecera %PDF- + trailer) para que la subida sea
// un archivo real, no solo bytes arbitrarios con extensión falsa.
const PDF_VALIDO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
  'utf-8',
);

describe('Expedientes - documentos (e2e, contra el schema "test" aislado + bucket REAL de Supabase Storage)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let storage: StorageService;

  const marca = `e2e.documentos.${Date.now()}`;
  let duenioId: number;
  let ajenoId: number;
  let adminId: number;
  let evaluadorAsignadoId: number;
  let evaluadorNoAsignadoId: number;

  let expedienteBorradorId: number;
  let expedienteEnviadoId: number;

  const expedienteIds: number[] = [];
  const clavesSubidas: string[] = []; // keys reales creadas en el bucket, para limpiar al final

  const tokenFor = (id: number) => jwtService.sign({ sub: String(id) });

  beforeAll(async () => {
    prisma = new PrismaClient();
    storage = new StorageService();
    const passwordHash = await bcrypt.hash('password', 12);

    const duenio = await prisma.user.create({
      data: {
        email: `${marca}.duenio@uch.edu.pe`,
        passwordHash,
        nombre: 'Dueño',
        apellido: 'Test',
        rol: 'estudiante_pregrado',
        activo: true,
        codigoEstudiante: '2020100',
      },
    });
    duenioId = duenio.id;

    const ajeno = await prisma.user.create({
      data: {
        email: `${marca}.ajeno@uch.edu.pe`,
        passwordHash,
        nombre: 'Ajeno',
        apellido: 'Test',
        rol: 'estudiante_pregrado',
        activo: true,
        codigoEstudiante: '2020101',
      },
    });
    ajenoId = ajeno.id;

    const admin = await prisma.user.create({
      data: {
        email: `${marca}.admin@uch.edu.pe`,
        passwordHash,
        nombre: 'Admin',
        apellido: 'Test',
        rol: 'administrador',
        activo: true,
      },
    });
    adminId = admin.id;

    const evalAsignado = await prisma.user.create({
      data: {
        email: `${marca}.eval-asignado@uch.edu.pe`,
        passwordHash,
        nombre: 'Evaluador',
        apellido: 'Asignado',
        rol: 'evaluador',
        activo: true,
      },
    });
    evaluadorAsignadoId = evalAsignado.id;

    const evalNoAsignado = await prisma.user.create({
      data: {
        email: `${marca}.eval-no-asignado@uch.edu.pe`,
        passwordHash,
        nombre: 'Evaluador',
        apellido: 'NoAsignado',
        rol: 'evaluador',
        activo: true,
      },
    });
    evaluadorNoAsignadoId = evalNoAsignado.id;

    const borrador = await prisma.expediente.create({
      data: { tituloProtocolo: 'NEST-DOC-BORRADOR', investigadorId: duenioId, estado: 'borrador' },
    });
    expedienteBorradorId = borrador.id;
    expedienteIds.push(borrador.id);

    const enviado = await prisma.expediente.create({
      data: { tituloProtocolo: 'NEST-DOC-ENVIADO', investigadorId: duenioId, estado: 'enviado' },
    });
    expedienteEnviadoId = enviado.id;
    expedienteIds.push(enviado.id);

    // El evaluador asignado tiene una fila en `evaluaciones` para el
    // expediente en borrador (Task 8 -- módulo Evaluación -- todavía no
    // tiene endpoints propios, pero la tabla ya existe en el schema).
    await prisma.evaluacion.create({
      data: { expedienteId: expedienteBorradorId, evaluadorId: evaluadorAsignadoId },
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    // Limpieza del bucket REAL de Supabase Storage (mismo patrón que
    // storage.e2e-spec.ts): borra cada objeto que la subida haya creado.
    const client = storage.getClient();
    for (const key of clavesSubidas) {
      await client.deleteObject({ Bucket: storage.getBucket(), Key: key }).catch(() => null);
    }

    if (expedienteIds.length > 0) {
      await prisma.evaluacion.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.documento.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.bitacora.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.historialExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.expediente.deleteMany({ where: { id: { in: expedienteIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('rechaza una extension no permitida para el tipo de documento', async () => {
    const resp = await request(app.getHttpServer())
      .post(`/expedientes/${expedienteBorradorId}/documentos`)
      .set('Authorization', `Bearer ${tokenFor(duenioId)}`)
      .field('tipoDocumento', 'proyecto_pdf')
      .attach('file', Buffer.from('contenido'), { filename: 'malware.exe', contentType: 'application/octet-stream' });

    expect(resp.status).toBe(400);
    expect(resp.body.message).toContain('PDF');
  });

  it('rechaza un MIME que no corresponde a la extension declarada', async () => {
    const resp = await request(app.getHttpServer())
      .post(`/expedientes/${expedienteBorradorId}/documentos`)
      .set('Authorization', `Bearer ${tokenFor(duenioId)}`)
      .field('tipoDocumento', 'proyecto_pdf')
      .attach('file', PDF_VALIDO, { filename: 'proyecto.pdf', contentType: 'application/msword' });

    expect(resp.status).toBe(400);
    expect(resp.body.message).toContain('PDF');
  });

  it('rechaza un archivo que excede el tamaño maximo (10MB)', async () => {
    const grande = Buffer.alloc(10 * 1024 * 1024 + 100, 1);
    const resp = await request(app.getHttpServer())
      .post(`/expedientes/${expedienteBorradorId}/documentos`)
      .set('Authorization', `Bearer ${tokenFor(duenioId)}`)
      .field('tipoDocumento', 'proyecto_pdf')
      .attach('file', grande, { filename: 'grande.pdf', contentType: 'application/pdf' });

    expect(resp.status).toBe(400);
    expect(resp.body.message).toContain('Máximo permitido: 10 MB');
  }, 20000);

  it('rechaza la subida si el expediente no esta en Borrador/Subsanacion', async () => {
    const resp = await request(app.getHttpServer())
      .post(`/expedientes/${expedienteEnviadoId}/documentos`)
      .set('Authorization', `Bearer ${tokenFor(duenioId)}`)
      .field('tipoDocumento', 'proyecto_pdf')
      .attach('file', PDF_VALIDO, { filename: 'proyecto.pdf', contentType: 'application/pdf' });

    expect(resp.status).toBe(400);
    expect(resp.body.message).toContain('estado');
  });

  let documentoId: number;
  let rutaArchivo: string;

  it('sube un documento valido: queda en la base Y realmente en el bucket de Supabase Storage', async () => {
    const resp = await request(app.getHttpServer())
      .post(`/expedientes/${expedienteBorradorId}/documentos`)
      .set('Authorization', `Bearer ${tokenFor(duenioId)}`)
      .field('tipoDocumento', 'proyecto_pdf')
      .field('esObligatorio', 'true')
      .attach('file', PDF_VALIDO, { filename: 'proyecto valido.pdf', contentType: 'application/pdf' });

    expect(resp.status).toBe(201);
    expect(resp.body.tipoDocumento).toBe('proyecto_pdf');
    expect(resp.body.nombreArchivo).toBe('proyecto valido.pdf');
    expect(resp.body.rutaArchivo).toMatch(new RegExp(`^uploads/${expedienteBorradorId}/`));

    documentoId = resp.body.id;
    rutaArchivo = resp.body.rutaArchivo;
    clavesSubidas.push(rutaArchivo);

    // Verificación real contra Supabase Storage (mismo patrón que
    // storage.e2e-spec.ts): el objeto DEBE existir de verdad en el bucket.
    const head = await storage
      .getClient()
      .headObject({ Bucket: storage.getBucket(), Key: rutaArchivo })
      .catch(() => null);
    expect(head).not.toBeNull();
  }, 20000);

  it('GET .../documentos lista el documento recien subido', async () => {
    const resp = await request(app.getHttpServer())
      .get(`/expedientes/${expedienteBorradorId}/documentos`)
      .set('Authorization', `Bearer ${tokenFor(duenioId)}`);
    expect(resp.status).toBe(200);
    expect(resp.body.some((d: any) => d.id === documentoId)).toBe(true);
  });

  it('descargar: el dueño recibe el archivo real con Content-Disposition attachment', async () => {
    const resp = await request(app.getHttpServer())
      .get(`/expedientes/${expedienteBorradorId}/documentos/${documentoId}/descargar`)
      .set('Authorization', `Bearer ${tokenFor(duenioId)}`);

    expect(resp.status).toBe(200);
    expect(resp.headers['content-disposition']).toContain('attachment');
    expect(resp.headers['content-type']).toBe('application/pdf');
    expect(Buffer.compare(resp.body, PDF_VALIDO)).toBe(0);
  }, 15000);

  it('preview: mismo archivo pero con Content-Disposition inline', async () => {
    const resp = await request(app.getHttpServer())
      .get(`/expedientes/${expedienteBorradorId}/documentos/${documentoId}/preview`)
      .set('Authorization', `Bearer ${tokenFor(duenioId)}`);

    expect(resp.status).toBe(200);
    expect(resp.headers['content-disposition']).toContain('inline');
    expect(Buffer.compare(resp.body, PDF_VALIDO)).toBe(0);
  }, 15000);

  it('un investigador ajeno NO puede descargar el documento (403)', async () => {
    const resp = await request(app.getHttpServer())
      .get(`/expedientes/${expedienteBorradorId}/documentos/${documentoId}/descargar`)
      .set('Authorization', `Bearer ${tokenFor(ajenoId)}`);
    expect(resp.status).toBe(403);
  });

  it('un rol interno (admin) SÍ puede descargar cualquier documento', async () => {
    const resp = await request(app.getHttpServer())
      .get(`/expedientes/${expedienteBorradorId}/documentos/${documentoId}/descargar`)
      .set('Authorization', `Bearer ${tokenFor(adminId)}`);
    expect(resp.status).toBe(200);
  }, 15000);

  it('un evaluador NO asignado al expediente NO puede descargar (403)', async () => {
    const resp = await request(app.getHttpServer())
      .get(`/expedientes/${expedienteBorradorId}/documentos/${documentoId}/descargar`)
      .set('Authorization', `Bearer ${tokenFor(evaluadorNoAsignadoId)}`);
    expect(resp.status).toBe(403);
  });

  it('un evaluador SÍ asignado al expediente SÍ puede descargar (200)', async () => {
    const resp = await request(app.getHttpServer())
      .get(`/expedientes/${expedienteBorradorId}/documentos/${documentoId}/descargar`)
      .set('Authorization', `Bearer ${tokenFor(evaluadorAsignadoId)}`);
    expect(resp.status).toBe(200);
  }, 15000);
});
