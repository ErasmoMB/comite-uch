import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { AppModule as AppModuleType } from '../src/app.module';

// Redirige DATABASE_URL/SECRET_KEY al schema Postgres "test" (aislado de
// producción) ANTES de cargar AppModule. Mismo patrón que
// test/expedientes.e2e-spec.ts.
loadEnv({ path: path.join(__dirname, '..', '.env.test'), override: true });

const { AppModule } = require('../src/app.module') as {
  AppModule: typeof AppModuleType;
};

// Equivalente a
// comite/backend/tests/test_descarga_pdf_url_s3.py::test_descargar_rubrica_redirige_si_es_url_s3
// (la variante de dictamen, en Python, vive en el módulo Expedientes -- fuera
// del alcance de esta tarea -- así que aquí se cubren ambos casos dentro de
// Evaluación: `descargar-rubrica` y `descargar-dictamen` comparten la misma
// lógica de "redirige si ya es una URL", fix aplicado hoy (2026-07-04) al
// Python real, ver routes.py:261-314).
//
// A diferencia de evaluacion.e2e-spec.ts, esta suite NO genera PDFs reales:
// crea directamente en la base de prueba una Evaluacion cuyo
// rubrica_pdf_path/dictamen_pdf_path YA es una URL "https://..." (simulando
// el caso real en que `PdfService.generarDictamen` devolvió un presigned
// URL), y confirma que el endpoint redirige en vez de intentar servir un
// archivo. No toca el bucket real -- no requiere limpieza de Storage.
describe('Evaluacion - descarga de PDF cuando el path guardado ya es una URL (e2e, schema "test")', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;

  const marca = `e2e.descarga-pdf-url.${Date.now()}`;
  let investigadorId: number;
  let evaluadorId: number;
  const expedienteIds: number[] = [];

  const tokenFor = (id: number) => jwtService.sign({ sub: String(id) });

  beforeAll(async () => {
    prisma = new PrismaClient();
    const passwordHash = await bcrypt.hash('password', 12);

    const investigador = await prisma.user.create({
      data: {
        email: `${marca}.investigador@uch.edu.pe`,
        passwordHash,
        nombre: 'Investigador',
        apellido: 'Test',
        rol: 'estudiante_pregrado',
        activo: true,
        codigoEstudiante: '2020300',
      },
    });
    investigadorId = investigador.id;

    const evaluador = await prisma.user.create({
      data: { email: `${marca}.evaluador@uch.edu.pe`, passwordHash, nombre: 'Evaluador', apellido: 'Test', rol: 'evaluador', activo: true },
    });
    evaluadorId = evaluador.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    if (expedienteIds.length > 0) {
      await prisma.evaluacion.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.expediente.deleteMany({ where: { id: { in: expedienteIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('descargar-rubrica redirige (302) si rubricaPdfPath ya es una URL S3', async () => {
    const exp = await prisma.expediente.create({
      data: { codigoUnico: `${marca}-EXP-1`, tituloProtocolo: 'T', investigadorId, estado: 'no_aprobado' },
    });
    expedienteIds.push(exp.id);
    const url = 'https://bucket.s3.amazonaws.com/evaluaciones/x.pdf?presigned=1';
    const ev = await prisma.evaluacion.create({
      data: {
        expedienteId: exp.id,
        evaluadorId,
        completa: true,
        puntajeTotal: 10,
        resultado: 'no_aprobado',
        rubricaPdfPath: url,
      },
    });

    const resp = await request(app.getHttpServer())
      .get(`/evaluacion/${ev.id}/descargar-rubrica`)
      .set('Authorization', `Bearer ${tokenFor(evaluadorId)}`)
      .redirects(0);

    expect([302, 307]).toContain(resp.status);
    expect(resp.headers.location).toBe(url);
  });

  it('descargar-dictamen redirige (302) si dictamenPdfPath ya es una URL S3', async () => {
    const exp = await prisma.expediente.create({
      data: { codigoUnico: `${marca}-EXP-2`, tituloProtocolo: 'T', investigadorId, estado: 'aprobado' },
    });
    expedienteIds.push(exp.id);
    const url = 'https://bucket.s3.amazonaws.com/dictamenes/y.pdf?presigned=1';
    const ev = await prisma.evaluacion.create({
      data: {
        expedienteId: exp.id,
        evaluadorId,
        completa: true,
        puntajeTotal: 20,
        resultado: 'aprobado',
        dictamenPdfPath: url,
      },
    });

    const resp = await request(app.getHttpServer())
      .get(`/evaluacion/${ev.id}/descargar-dictamen`)
      .set('Authorization', `Bearer ${tokenFor(evaluadorId)}`)
      .redirects(0);

    expect([302, 307]).toContain(resp.status);
    expect(resp.headers.location).toBe(url);
  });

  it('descargar-dictamen devuelve 404 si aun no se genero (evaluacion no completa)', async () => {
    const exp = await prisma.expediente.create({
      data: { codigoUnico: `${marca}-EXP-3`, tituloProtocolo: 'T', investigadorId, estado: 'en_revision' },
    });
    expedienteIds.push(exp.id);
    const ev = await prisma.evaluacion.create({ data: { expedienteId: exp.id, evaluadorId } });

    const resp = await request(app.getHttpServer())
      .get(`/evaluacion/${ev.id}/descargar-dictamen`)
      .set('Authorization', `Bearer ${tokenFor(evaluadorId)}`);

    expect(resp.status).toBe(404);
    expect(resp.body.message).toContain('aún no ha sido generado');
  });
});
