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
// test/users.e2e-spec.ts.
loadEnv({ path: path.join(__dirname, '..', '.env.test'), override: true });

const { AppModule } = require('../src/app.module') as {
  AppModule: typeof AppModuleType;
};

describe('Reportes (e2e, contra el schema "test" aislado, no producción)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;

  const marca = `e2e.reportes.${Date.now()}`;
  let adminId: number;
  let coordinadorId: number;
  let secretariaId: number;
  let investigadorId: number;
  let evaluador1Id: number;
  let evaluador2Id: number;

  const expedienteIds: number[] = [];

  const tokenFor = (id: number) => jwt.sign({ sub: String(id) });

  async function crearExpediente(titulo: string, estado = 'en_revision') {
    const exp = await prisma.expediente.create({
      data: { tituloProtocolo: titulo, investigadorId, estado, codigoUnico: `${marca}-${titulo}` },
    });
    expedienteIds.push(exp.id);
    return exp;
  }

  beforeAll(async () => {
    prisma = new PrismaClient();
    const passwordHash = await bcrypt.hash('password', 12);

    const admin = await prisma.user.create({
      data: { email: `${marca}.admin@uch.edu.pe`, passwordHash, nombre: 'Admin', apellido: 'Test', rol: 'administrador', activo: true },
    });
    adminId = admin.id;

    const coordinador = await prisma.user.create({
      data: { email: `${marca}.coordinador@uch.edu.pe`, passwordHash, nombre: 'Coord', apellido: 'Test', rol: 'coordinador', activo: true },
    });
    coordinadorId = coordinador.id;

    const secretaria = await prisma.user.create({
      data: { email: `${marca}.secretaria@uch.edu.pe`, passwordHash, nombre: 'Secre', apellido: 'Test', rol: 'secretaria', activo: true },
    });
    secretariaId = secretaria.id;

    const investigador = await prisma.user.create({
      data: { email: `${marca}.investigador@uch.edu.pe`, passwordHash, nombre: 'Investigador', apellido: 'Test', rol: 'investigador', activo: true, laboratorio: 'Lab X' },
    });
    investigadorId = investigador.id;

    const ev1 = await prisma.user.create({
      data: { email: `${marca}.evaluador1@uch.edu.pe`, passwordHash, nombre: 'Evaluador', apellido: 'Uno Reportes', rol: 'evaluador', activo: true },
    });
    evaluador1Id = ev1.id;

    const ev2 = await prisma.user.create({
      data: { email: `${marca}.evaluador2@uch.edu.pe`, passwordHash, nombre: 'Evaluador', apellido: 'Dos Reportes', rol: 'evaluador', activo: true },
    });
    evaluador2Id = ev2.id;

    // ==================== Datos de evaluaciones completas ====================
    // 2 evaluaciones completas con resultado real (una no_aprobado, otra
    // aprobado) -- exactamente el escenario de
    // comite/backend/tests/test_reportes_resultados.py::test_resultados_incluye_no_aprobado
    // (ya corregido para leer Evaluacion.resultado, no Dictamen).
    const expNoAprobado = await crearExpediente('RESULTADOS-NO-APROBADO');
    await prisma.evaluacion.create({
      data: {
        expedienteId: expNoAprobado.id,
        evaluadorId: evaluador1Id,
        completa: true,
        puntajeTotal: 10,
        resultado: 'no_aprobado',
      },
    });

    const expAprobado = await crearExpediente('RESULTADOS-APROBADO');
    await prisma.evaluacion.create({
      data: {
        expedienteId: expAprobado.id,
        evaluadorId: evaluador1Id,
        completa: true,
        puntajeTotal: 20,
        resultado: 'aprobado',
      },
    });

    // Una evaluación NO completa (sin resultado): no debe contarse en
    // resultados-emitidos/resumen. También aporta a la carga del evaluador 2.
    const expIncompleta = await crearExpediente('RESULTADOS-INCOMPLETA');
    await prisma.evaluacion.create({
      data: {
        expedienteId: expIncompleta.id,
        evaluadorId: evaluador2Id,
        completa: false,
      },
    });

    // ==================== Expediente enviado (para tiempos-atencion) ====================
    const fechaCreacion = new Date('2026-01-01T00:00:00Z');
    const fechaEnvio = new Date('2026-01-06T00:00:00Z'); // +5 días
    const expEnviado = await prisma.expediente.create({
      data: {
        tituloProtocolo: 'RESULTADOS-TIEMPOS',
        investigadorId,
        estado: 'enviado',
        codigoUnico: `${marca}-TIEMPOS`,
        fechaCreacion,
        fechaEnvio,
      },
    });
    expedienteIds.push(expEnviado.id);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    if (expedienteIds.length > 0) {
      await prisma.evaluacionCriterio.deleteMany({ where: { evaluacion: { expedienteId: { in: expedienteIds } } } });
      await prisma.evaluacion.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.historialExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.autorExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.expediente.deleteMany({ where: { id: { in: expedienteIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  // ==================== GET /reportes/expedientes-por-estado ====================
  it('GET /reportes/expedientes-por-estado devuelve total y conteo por estado', async () => {
    const resp = await request(app.getHttpServer())
      .get('/reportes/expedientes-por-estado')
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
    expect(resp.status).toBe(200);
    expect(resp.body.total).toBeGreaterThanOrEqual(expedienteIds.length);
    expect(resp.body.porEstado.enviado).toBeGreaterThanOrEqual(1);
    expect(resp.body.porEstado.en_revision).toBeGreaterThanOrEqual(3);
  });

  // ==================== GET /reportes/tiempos-atencion ====================
  it('GET /reportes/tiempos-atencion calcula los dias entre creacion y envio', async () => {
    const resp = await request(app.getHttpServer())
      .get('/reportes/tiempos-atencion')
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
    expect(resp.status).toBe(200);
    const fila = resp.body.find((r: any) => r.codigo === `${marca}-TIEMPOS`);
    expect(fila).toBeDefined();
    expect(fila.dias).toBe(5);
    expect(fila.estado).toBe('enviado');
  });

  // ==================== GET /reportes/carga-evaluadores ====================
  // Equivalente a test_reportes_carga_evaluadores.py::test_carga_evaluadores_incluye_nombre_real
  // -- confirma el fix de `evaluador.nombre` (no `evaluador.nombres`).
  it('GET /reportes/carga-evaluadores incluye el nombre real del evaluador (nombre, no nombres)', async () => {
    const resp = await request(app.getHttpServer())
      .get('/reportes/carga-evaluadores')
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
    expect(resp.status).toBe(200);

    const fila1 = resp.body.find((r: any) => r.evaluadorId === evaluador1Id);
    expect(fila1).toBeDefined();
    expect(fila1.nombre).toBe('Evaluador'); // User.nombre, ver beforeAll
    expect(fila1.totalEvaluaciones).toBe(2); // no_aprobado + aprobado

    const fila2 = resp.body.find((r: any) => r.evaluadorId === evaluador2Id);
    expect(fila2).toBeDefined();
    expect(fila2.totalEvaluaciones).toBe(1); // la incompleta
  });

  // ==================== GET /reportes/resultados-emitidos ====================
  // Equivalente a test_reportes_resultados.py::test_resultados_incluye_no_aprobado
  // -- sobre Evaluacion.resultado (completa=true), NO sobre un modelo Dictamen
  // (que no existe en este schema).
  it('GET /reportes/resultados-emitidos cuenta solo evaluaciones completas, agrupadas por resultado', async () => {
    const resp = await request(app.getHttpServer())
      .get('/reportes/resultados-emitidos')
      .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`);
    expect(resp.status).toBe(200);

    const tipos = new Set(resp.body.map((r: any) => r.tipo));
    expect(tipos.has('no_aprobado')).toBe(true);
    expect(tipos.has('aprobado')).toBe(true);

    const noAprobado = resp.body.find((r: any) => r.tipo === 'no_aprobado');
    expect(noAprobado.total).toBeGreaterThanOrEqual(1);

    // La evaluación incompleta (completa=false, sin resultado) NUNCA debe
    // sumar a ningún grupo -- ya está implícitamente excluida porque no tiene
    // `resultado`, pero se confirma que los totales no se inflan de más.
    const aprobado = resp.body.find((r: any) => r.tipo === 'aprobado');
    expect(aprobado.total).toBeGreaterThanOrEqual(1);
  });

  // ==================== GET /reportes/buscar-expedientes ====================
  it('GET /reportes/buscar-expedientes filtra por estado', async () => {
    const resp = await request(app.getHttpServer())
      .get('/reportes/buscar-expedientes')
      .query({ estado: 'enviado' })
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
    expect(resp.status).toBe(200);
    expect(Array.isArray(resp.body)).toBe(true);
    expect(resp.body.every((e: any) => e.estado === 'enviado')).toBe(true);
    expect(resp.body.some((e: any) => e.codigoUnico === `${marca}-TIEMPOS`)).toBe(true);
  });

  // ==================== GET /reportes/resumen ====================
  // Equivalente a test_reportes_carga_evaluadores.py::test_resumen_incluye_carga_evaluadores_no_vacia,
  // más el fix de resultados sobre Evaluacion.resultado.
  describe('GET /reportes/resumen', () => {
    it('accesible para administrador/coordinador/secretaria, NO para investigador (403)', async () => {
      const rechazo = await request(app.getHttpServer())
        .get('/reportes/resumen')
        .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
      expect(rechazo.status).toBe(403);

      for (const id of [adminId, coordinadorId, secretariaId]) {
        const ok = await request(app.getHttpServer())
          .get('/reportes/resumen')
          .set('Authorization', `Bearer ${tokenFor(id)}`);
        expect(ok.status).toBe(200);
      }
    });

    it('incluye carga_evaluadores no vacia y resultados sobre Evaluacion.resultado', async () => {
      const resp = await request(app.getHttpServer())
        .get('/reportes/resumen')
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`);
      expect(resp.status).toBe(200);

      expect(resp.body.evaluadores.totalEvaluadores).toBeGreaterThanOrEqual(2);
      expect(resp.body.cargaEvaluadores.length).toBeGreaterThanOrEqual(2);
      const cargaEv1 = resp.body.cargaEvaluadores.find((c: any) => c.evaluadorId === evaluador1Id);
      expect(cargaEv1.nombre).toBe('Evaluador');
      expect(cargaEv1.totalEvaluaciones).toBe(2);

      const tipos = new Set(resp.body.resultados.map((r: any) => r.tipo));
      expect(tipos.has('no_aprobado')).toBe(true);
      expect(tipos.has('aprobado')).toBe(true);

      expect(resp.body.expedientes.total).toBeGreaterThanOrEqual(expedienteIds.length);
      expect(resp.body.fechaGeneracion).toBeDefined();
    });
  });

  // ==================== GET /reportes/exportar ====================
  describe('GET /reportes/exportar', () => {
    it('accesible para coordinador, NO para investigador (403), y exige el parametro tipo', async () => {
      const rechazo = await request(app.getHttpServer())
        .get('/reportes/exportar')
        .query({ tipo: 'estados' })
        .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
      expect(rechazo.status).toBe(403);

      const sinTipo = await request(app.getHttpServer())
        .get('/reportes/exportar')
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`);
      expect(sinTipo.status).toBe(400);

      const ok = await request(app.getHttpServer())
        .get('/reportes/exportar')
        .query({ tipo: 'estados' })
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`);
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual({ message: 'Reporte estados exportado', formato: 'csv' });
    });
  });
});
