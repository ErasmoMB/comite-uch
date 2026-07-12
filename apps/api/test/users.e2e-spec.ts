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
// producción) ANTES de cargar AppModule. Ver la explicación detallada del
// require() diferido en test/auth.e2e-spec.ts: si AppModule (y por tanto
// JwtModule.register({ secret: process.env.SECRET_KEY })) se importara antes
// de este loadEnv, quedaría fijado con el SECRET_KEY equivocado.
loadEnv({ path: path.join(__dirname, '..', '.env.test'), override: true });

const { AppModule } = require('../src/app.module') as {
  AppModule: typeof AppModuleType;
};

describe('UsersController (e2e, contra el schema "test" aislado, no producción)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;

  const marca = `e2e.users.${Date.now()}`;
  let adminId: number;
  let investigadorId: number;
  let otroInvestigadorId: number;

  // Fabrica tokens sin pasar por /auth/login, igual que el payload que firma
  // AuthService.login: `{ sub: String(user.id) }`.
  const tokenFor = (id: number) => jwt.sign({ sub: String(id) });

  beforeAll(async () => {
    prisma = new PrismaClient();

    const passwordHash = await bcrypt.hash('password', 12);
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

    const investigador = await prisma.user.create({
      data: {
        email: `${marca}.investigador@uch.edu.pe`,
        passwordHash,
        nombre: 'Investigador',
        apellido: 'Test',
        rol: 'investigador',
        activo: true,
        laboratorio: 'Lab X',
      },
    });
    investigadorId = investigador.id;

    const otroInvestigador = await prisma.user.create({
      data: {
        email: `${marca}.otro@uch.edu.pe`,
        passwordHash,
        nombre: 'Otro',
        apellido: 'Investigador',
        rol: 'investigador',
        activo: true,
        laboratorio: 'Lab Y',
      },
    });
    otroInvestigadorId = otroInvestigador.id;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('admin puede crear un usuario con rol interno (evaluador)', async () => {
    const resp = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${tokenFor(adminId)}`)
      .send({
        email: `${marca}.eval@uch.edu.pe`,
        password: 'password',
        nombre: 'Test',
        apellido: 'Eval',
        rol: 'evaluador',
      });
    expect(resp.status).toBe(201);
    expect(resp.body.rol).toBe('evaluador');
    expect(resp.body).toHaveProperty('id');
    expect(resp.body).not.toHaveProperty('passwordHash');
  });

  it('un no-admin NO puede crear usuarios', async () => {
    const resp = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`)
      .send({
        email: `${marca}.rechazo@uch.edu.pe`,
        password: 'password',
        nombre: 'X',
        apellido: 'Y',
        rol: 'evaluador',
      });
    expect(resp.status).toBe(403);
  });

  it('GET /users/me devuelve el perfil completo del usuario autenticado, sin passwordHash', async () => {
    const resp = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
    expect(resp.status).toBe(200);
    expect(resp.body).toMatchObject({
      id: investigadorId,
      rol: 'investigador',
    });
    expect(resp.body).not.toHaveProperty('passwordHash');
  });

  it('GET /users/{id} de un usuario inexistente responde 404', async () => {
    const resp = await request(app.getHttpServer())
      .get('/users/999999999')
      .set('Authorization', `Bearer ${tokenFor(adminId)}`);
    expect(resp.status).toBe(404);
  });

  it('un usuario puede editar su propio nombre/apellido, pero no su propio rol', async () => {
    const resp = await request(app.getHttpServer())
      .put(`/users/${investigadorId}`)
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`)
      .send({ nombre: 'NuevoNombre', rol: 'administrador' });
    expect(resp.status).toBe(200);
    expect(resp.body.nombre).toBe('NuevoNombre');
    expect(resp.body.rol).toBe('investigador');
  });

  it('un usuario NO puede editar el registro de otro usuario (403)', async () => {
    const resp = await request(app.getHttpServer())
      .put(`/users/${otroInvestigadorId}`)
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`)
      .send({ nombre: 'Hackeado' });
    expect(resp.status).toBe(403);
  });

  it('el admin sí puede cambiar el rol/activo de otro usuario', async () => {
    const resp = await request(app.getHttpServer())
      .put(`/users/${otroInvestigadorId}`)
      .set('Authorization', `Bearer ${tokenFor(adminId)}`)
      .send({ rol: 'evaluador', activo: false });
    expect(resp.status).toBe(200);
    expect(resp.body.rol).toBe('evaluador');
    expect(resp.body.activo).toBe(false);
  });

  it('DELETE /users/{id} por un no-admin responde 403', async () => {
    const resp = await request(app.getHttpServer())
      .delete(`/users/${otroInvestigadorId}`)
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
    expect(resp.status).toBe(403);
  });

  it('DELETE /users/{id} por el admin hace soft-delete (activo=false, la fila sigue existiendo)', async () => {
    const resp = await request(app.getHttpServer())
      .delete(`/users/${otroInvestigadorId}`)
      .set('Authorization', `Bearer ${tokenFor(adminId)}`);
    expect(resp.status).toBe(200);
    expect(resp.body).toEqual({ message: 'Usuario desactivado' });

    const row = await prisma.user.findUnique({
      where: { id: otroInvestigadorId },
    });
    expect(row).not.toBeNull();
    expect(row!.activo).toBe(false);
  });

  it('GET /users lista usuarios para cualquier usuario autenticado', async () => {
    const resp = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
    expect(resp.status).toBe(200);
    expect(Array.isArray(resp.body)).toBe(true);
    expect(resp.body.length).toBeGreaterThan(0);
    expect(resp.body[0]).not.toHaveProperty('passwordHash');
  });
});
