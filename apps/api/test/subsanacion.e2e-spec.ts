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

// Task 7 — el escenario más crítico: `submit_subsanacion` (routes.py:870-905)
// tras el fix aplicado hoy (2026-07-04) al Python real DEBE reingresar el
// expediente a la cola de revisión (estado `enviado`), no solo dejar
// constancia en bitácora. Este test se escribe y se corre ANTES de tocar
// ExpedientesService/Controller (TDD): debe fallar primero (ruta no existe).
describe('Subsanacion (e2e, contra el schema "test" aislado, no producción)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;

  const marca = `e2e.subsanacion.${Date.now()}`;
  let investigadorId: number;
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
        apellido: 'Subsanacion',
        rol: 'estudiante_pregrado',
        activo: true,
        codigoEstudiante: '2020099',
      },
    });
    investigadorId = investigador.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    if (expedienteIds.length > 0) {
      await prisma.historialExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.bitacora.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.expediente.deleteMany({ where: { id: { in: expedienteIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('subsanacion reingresa el expediente a estado enviado y deja registro en el historial', async () => {
    const exp = await prisma.expediente.create({
      data: { tituloProtocolo: 'NEST-SUBSANACION-TEST', investigadorId, estado: 'subsanacion' },
    });
    expedienteIds.push(exp.id);

    const resp = await request(app.getHttpServer())
      .post(`/expedientes/${exp.id}/subsanacion`)
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`)
      .send({ observaciones: 'Correccion de prueba nest' });

    expect(resp.status).toBe(201);
    expect(resp.body.estado).toBe('enviado');

    const historial = await prisma.historialExpediente.findMany({ where: { expedienteId: exp.id } });
    expect(historial.some((h) => h.estadoNuevo === 'enviado')).toBe(true);

    const actualizado = await prisma.expediente.findUnique({ where: { id: exp.id } });
    expect(actualizado?.estado).toBe('enviado');
  });

  it('rechaza subsanacion si el expediente no esta en estado subsanacion', async () => {
    const exp = await prisma.expediente.create({
      data: { tituloProtocolo: 'NEST-SUBSANACION-CONTROL', investigadorId, estado: 'enviado' },
    });
    expedienteIds.push(exp.id);

    const resp = await request(app.getHttpServer())
      .post(`/expedientes/${exp.id}/subsanacion`)
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`)
      .send({ observaciones: 'x' });

    expect(resp.status).toBe(400);

    const sinCambios = await prisma.expediente.findUnique({ where: { id: exp.id } });
    expect(sinCambios?.estado).toBe('enviado');
  });
});
