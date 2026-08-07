import 'dotenv/config';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { Controller, Get, INestApplication, Req, UseGuards } from '@nestjs/common';
import request from 'supertest';
import type { AppModule as AppModuleType } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { Roles } from '../src/auth/roles.decorator';

describe('Auth - compatibilidad de hashes existentes', () => {
  it('un hash bcrypt creado por el backend Python valida correctamente en Node', async () => {
    const prisma = new PrismaClient();
    const admin = await prisma.user.findUnique({ where: { email: 'admin@uch.edu.pe' } });
    expect(admin).not.toBeNull();
    const coincide = await bcrypt.compare('password', admin!.passwordHash);
    expect(coincide).toBe(true);
    await prisma.$disconnect();
  });
});

// Controller mínimo de solo-prueba: existe únicamente para verificar que
// JwtAuthGuard/RolesGuard dejan `{ id, email, rol }` en `request.user`, tal
// como lo consumirán los módulos futuros (Expedientes, Evaluaciones, etc.).
@Controller('__test_protegido')
class ProtectedTestController {
  @UseGuards(JwtAuthGuard)
  @Get('perfil')
  perfil(@Req() req: any) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Get('solo-admin')
  soloAdmin(@Req() req: any) {
    return req.user;
  }
}

describe('Auth - registro/login/guards (contra el schema "test" aislado, no producción)', () => {
  let app: INestApplication;
  const email = `e2e.auth.${Date.now()}@uch.edu.pe`;

  beforeAll(async () => {
    // Redirige DATABASE_URL/SECRET_KEY al schema Postgres "test" (misma
    // instancia Neon, aislado de `public`/producción) ANTES de cargar
    // AppModule. Es crucial hacerlo con require() diferido (no con un
    // `import` estático arriba del archivo): `JwtModule.register({ secret:
    // process.env.SECRET_KEY })` dentro del decorador de AuthModule se
    // evalúa en el momento en que el módulo se importa/require-ea (no cuando
    // se instancia), así que si `AppModule` ya se hubiera importado arriba
    // del archivo, el JwtModule quedaría con el SECRET_KEY de producción
    // mientras que `JwtStrategy` (que sí lee `process.env.SECRET_KEY` recién
    // en su constructor, en `compile()`) usaría el de test -> firma y
    // verificación con secretos distintos -> 401 con un JWT válido.
    loadEnv({ path: path.join(__dirname, '..', '.env.test'), override: true });

    const { AppModule } = require('../src/app.module') as { AppModule: typeof AppModuleType };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedTestController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    const prisma = new PrismaClient();
    await prisma.user.deleteMany({ where: { email: { contains: 'e2e.auth.' } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('rechaza auto-registro con un rol interno no permitido (403)', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: `interno.${Date.now()}@uch.edu.pe`,
      password: '123456',
      nombre: 'X',
      apellido: 'Y',
      rol: 'administrador',
    });
    expect(res.status).toBe(403);
  });

  it('rechaza estudiante sin codigoEstudiante (400)', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: `estudiante.${Date.now()}@uch.edu.pe`,
      password: '123456',
      nombre: 'X',
      apellido: 'Y',
      rol: 'estudiante_pregrado',
    });
    expect(res.status).toBe(400);
  });

  it('rechaza investigador sin laboratorio (400)', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: `investigador.${Date.now()}@uch.edu.pe`,
      password: '123456',
      nombre: 'X',
      apellido: 'Y',
      rol: 'investigador',
    });
    expect(res.status).toBe(400);
  });

  it('registra un investigador válido, hace login y el JWT funciona contra un endpoint protegido', async () => {
    const registerRes = await request(app.getHttpServer()).post('/auth/register').send({
      email,
      password: '123456',
      nombre: 'Test',
      apellido: 'E2E',
      rol: 'investigador',
      laboratorio: 'Lab X',
    });
    expect(registerRes.status).toBe(201);
    // Forma completa equivalente a `UserResponse` de Python (paridad de
    // campos), sin exponer nunca el hash de la contraseña.
    expect(registerRes.body).toMatchObject({
      email,
      nombre: 'Test',
      apellido: 'E2E',
      rol: 'investigador',
      activo: true,
      laboratorio: 'Lab X',
      codigoEstudiante: null,
    });
    expect(registerRes.body).toHaveProperty('id');
    expect(registerRes.body).toHaveProperty('createdAt');
    expect(registerRes.body).not.toHaveProperty('passwordHash');
    expect(registerRes.body).not.toHaveProperty('updatedAt');

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: email, password: '123456' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token_type).toBe('bearer');
    expect(typeof loginRes.body.access_token).toBe('string');
    const token = loginRes.body.access_token;

    const perfilRes = await request(app.getHttpServer())
      .get('/__test_protegido/perfil')
      .set('Authorization', `Bearer ${token}`);
    expect(perfilRes.status).toBe(200);
    expect(perfilRes.body).toMatchObject({ email, rol: 'investigador' });
    expect(perfilRes.body).toHaveProperty('id');

    // El rol del usuario es 'investigador', no 'administrador' -> RolesGuard bloquea.
    const adminRes = await request(app.getHttpServer())
      .get('/__test_protegido/solo-admin')
      .set('Authorization', `Bearer ${token}`);
    expect(adminRes.status).toBe(403);
  });

  it('sin token, el endpoint protegido responde 401', async () => {
    const res = await request(app.getHttpServer()).get('/__test_protegido/perfil');
    expect(res.status).toBe(401);
  });

  it('con contraseña incorrecta, login responde 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: email, password: 'contraseña-incorrecta' });
    expect(res.status).toBe(401);
  });

  it('rechaza doble registro con el mismo correo (400, paridad con Python routes.py:30-32)', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email,
      password: '123456',
      nombre: 'Test',
      apellido: 'E2E',
      rol: 'investigador',
      laboratorio: 'Lab X',
    });
    expect(res.status).toBe(400);
  });
});
