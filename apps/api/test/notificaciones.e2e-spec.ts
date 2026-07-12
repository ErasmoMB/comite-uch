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

// Redirige DATABASE_URL/SECRET_KEY al schema Postgres "test" (aislado de
// producción) ANTES de cargar AppModule. Mismo patrón que
// test/chat.e2e-spec.ts / test/evaluacion.e2e-spec.ts.
loadEnv({ path: path.join(__dirname, '..', '.env.test'), override: true });

const { AppModule } = require('../src/app.module') as {
  AppModule: typeof AppModuleType;
};

// Equivalente a comite/backend/app/api/notificaciones/routes.py. Sin
// restricción de rol: solo pertenencia (usuario_id == current_user.id).
describe('Notificaciones (e2e, contra el schema "test" aislado)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;

  const marca = `e2e.notif.${Date.now()}`;
  const usuarioIds: number[] = [];
  let contador = 0;

  const tokenFor = (id: number) => jwtService.sign({ sub: String(id) });

  async function crearUsuario(rol = 'estudiante_pregrado') {
    contador += 1;
    const passwordHash = await bcrypt.hash('password', 12);
    const user = await prisma.user.create({
      data: {
        email: `${marca}.${rol}.${contador}@uch.edu.pe`,
        passwordHash,
        nombre: 'Test',
        apellido: rol,
        rol,
        activo: true,
      },
    });
    usuarioIds.push(user.id);
    return user;
  }

  beforeAll(async () => {
    prisma = new PrismaClient();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await prisma.notificacion.deleteMany({
      where: { usuarioId: { in: usuarioIds } },
    });
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('POST /notificaciones/ crea una notificacion (200, no 201, igual que Python)', async () => {
    const user = await crearUsuario();

    const resp = await request(app.getHttpServer())
      .post('/notificaciones/')
      .set('Authorization', `Bearer ${tokenFor(user.id)}`)
      .send({
        usuarioId: user.id,
        titulo: 'Bienvenida',
        mensaje: 'Su cuenta fue creada',
      });

    expect(resp.status).toBe(200);
    expect(resp.body.usuarioId).toBe(user.id);
    expect(resp.body.titulo).toBe('Bienvenida');
    expect(resp.body.leida).toBe(false);
    expect(resp.body.createdAt).toBeTruthy();
  });

  it('GET /notificaciones/ lista solo las notificaciones del usuario autenticado, mas recientes primero', async () => {
    const user = await crearUsuario();
    const otro = await crearUsuario();

    await prisma.notificacion.create({
      data: {
        usuarioId: otro.id,
        titulo: 'Ajena',
        mensaje: 'No debe verse',
        leida: false,
      },
    });
    await prisma.notificacion.create({
      data: {
        usuarioId: user.id,
        titulo: 'Primera',
        mensaje: 'm1',
        leida: false,
      },
    });
    await prisma.notificacion.create({
      data: {
        usuarioId: user.id,
        titulo: 'Segunda',
        mensaje: 'm2',
        leida: false,
      },
    });

    const resp = await request(app.getHttpServer())
      .get('/notificaciones/')
      .set('Authorization', `Bearer ${tokenFor(user.id)}`);

    expect(resp.status).toBe(200);
    expect(resp.body).toHaveLength(2);
    expect(resp.body[0].titulo).toBe('Segunda');
    expect(resp.body[1].titulo).toBe('Primera');
    expect(resp.body.every((n: any) => n.usuarioId === user.id)).toBe(true);
  });

  it('GET /notificaciones/sin-leer cuenta solo las no leidas del usuario autenticado', async () => {
    const user = await crearUsuario();
    await prisma.notificacion.createMany({
      data: [
        { usuarioId: user.id, titulo: 'a', mensaje: 'a', leida: false },
        { usuarioId: user.id, titulo: 'b', mensaje: 'b', leida: false },
        { usuarioId: user.id, titulo: 'c', mensaje: 'c', leida: true },
      ],
    });

    const resp = await request(app.getHttpServer())
      .get('/notificaciones/sin-leer')
      .set('Authorization', `Bearer ${tokenFor(user.id)}`);

    expect(resp.status).toBe(200);
    expect(resp.body.sinLeer).toBe(2);
  });

  it('GET /notificaciones/{id} devuelve 404 si la notificacion es de otro usuario', async () => {
    const user = await crearUsuario();
    const otro = await crearUsuario();
    const notifOtro = await prisma.notificacion.create({
      data: { usuarioId: otro.id, titulo: 'Ajena', mensaje: 'x', leida: false },
    });

    const resp = await request(app.getHttpServer())
      .get(`/notificaciones/${notifOtro.id}`)
      .set('Authorization', `Bearer ${tokenFor(user.id)}`);
    expect(resp.status).toBe(404);

    const propia = await prisma.notificacion.create({
      data: {
        usuarioId: user.id,
        titulo: 'Propia',
        mensaje: 'x',
        leida: false,
      },
    });
    const respOk = await request(app.getHttpServer())
      .get(`/notificaciones/${propia.id}`)
      .set('Authorization', `Bearer ${tokenFor(user.id)}`);
    expect(respOk.status).toBe(200);
    expect(respOk.body.titulo).toBe('Propia');
  });

  it('PUT /notificaciones/{id} marca como leida solo si es del usuario autenticado', async () => {
    const user = await crearUsuario();
    const otro = await crearUsuario();

    const notif = await prisma.notificacion.create({
      data: {
        usuarioId: user.id,
        titulo: 'Propia',
        mensaje: 'x',
        leida: false,
      },
    });

    const ajena = await request(app.getHttpServer())
      .put(`/notificaciones/${notif.id}`)
      .set('Authorization', `Bearer ${tokenFor(otro.id)}`)
      .send({ leida: true });
    expect(ajena.status).toBe(404);

    const propia = await request(app.getHttpServer())
      .put(`/notificaciones/${notif.id}`)
      .set('Authorization', `Bearer ${tokenFor(user.id)}`)
      .send({ leida: true });
    expect(propia.status).toBe(200);
    expect(propia.body.leida).toBe(true);
  });

  it('POST /notificaciones/marcar-todas-leidas solo afecta las notificaciones propias del usuario que llama', async () => {
    const user = await crearUsuario();
    const otro = await crearUsuario();

    await prisma.notificacion.createMany({
      data: [
        { usuarioId: user.id, titulo: 'a', mensaje: 'a', leida: false },
        { usuarioId: user.id, titulo: 'b', mensaje: 'b', leida: false },
        { usuarioId: otro.id, titulo: 'c', mensaje: 'c', leida: false },
      ],
    });

    const resp = await request(app.getHttpServer())
      .post('/notificaciones/marcar-todas-leidas')
      .set('Authorization', `Bearer ${tokenFor(user.id)}`);
    expect(resp.status).toBe(200);
    expect(resp.body.message).toBe(
      'Todas las notificaciones marcadas como leídas',
    );

    const sinLeerUser = await prisma.notificacion.count({
      where: { usuarioId: user.id, leida: false },
    });
    expect(sinLeerUser).toBe(0);

    // Las del otro usuario NO deben verse afectadas.
    const sinLeerOtro = await prisma.notificacion.count({
      where: { usuarioId: otro.id, leida: false },
    });
    expect(sinLeerOtro).toBe(1);
  });

  it('requiere autenticacion (401 sin token)', async () => {
    const resp = await request(app.getHttpServer()).get('/notificaciones/');
    expect(resp.status).toBe(401);
  });
});
