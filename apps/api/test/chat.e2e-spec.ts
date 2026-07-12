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
// test/evaluacion.e2e-spec.ts / test/expedientes.e2e-spec.ts.
loadEnv({ path: path.join(__dirname, '..', '.env.test'), override: true });

const { AppModule } = require('../src/app.module') as {
  AppModule: typeof AppModuleType;
};

// Puerto Jest de comite/backend/tests/test_chat.py (10 escenarios). A
// diferencia de los tests Python (SQLite en memoria, recreada por test vía
// `conftest.py::db`), aquí se corre contra el schema Postgres "test"
// compartido -- por eso cada test limpia `mensajesChat` en `beforeEach` (la
// tabla es de uso exclusivo de este módulo, ningún otro spec la toca) para
// reproducir la misma garantía de "bandeja vacía al empezar cada test" que
// da la fixture Python, necesaria para las aserciones exactas de
// `GET /chat/conversaciones` y `GET /chat/no-leidos` (cuentan TODOS los
// mensajes de la tabla, sin scope por expediente).
describe('Chat (e2e, contra el schema "test" aislado)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;

  const marca = `e2e.chat.${Date.now()}`;
  const usuarioIds: number[] = [];
  let contador = 0;

  const tokenFor = (id: number) => jwtService.sign({ sub: String(id) });

  async function crearUsuario(
    rol: string,
    opts: { email?: string; codigoEstudiante?: string } = {},
  ) {
    contador += 1;
    const passwordHash = await bcrypt.hash('password', 12);
    const user = await prisma.user.create({
      data: {
        email: opts.email ?? `${marca}.${rol}.${contador}@uch.edu.pe`,
        passwordHash,
        // nombre/apellido fijos ("Test"/rol) a propósito: el test de la
        // bandeja agrupada (test_bandeja_agrupada_con_datos_y_no_leidos)
        // verifica el nombre completo exacto "Test estudiante_pregrado".
        nombre: 'Test',
        apellido: rol,
        rol,
        activo: true,
        codigoEstudiante: opts.codigoEstudiante,
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

  beforeEach(async () => {
    // Bandeja limpia antes de cada test (ver nota del describe).
    await prisma.mensajeChat.deleteMany({});
  });

  afterAll(async () => {
    await prisma.mensajeChat.deleteMany({
      where: {
        OR: [
          { solicitanteId: { in: usuarioIds } },
          { autorId: { in: usuarioIds } },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  // ---------- Lado solicitante ----------

  // test_solicitante_envia_y_lee_su_hilo
  it('el solicitante envía un mensaje y lee su propio hilo', async () => {
    const est = await crearUsuario('estudiante_pregrado');

    const envio = await request(app.getHttpServer())
      .post('/chat/mios')
      .set('Authorization', `Bearer ${tokenFor(est.id)}`)
      .send({ texto: 'Hola, ¿qué documentos necesito?' });
    expect(envio.status).toBe(200);
    expect(envio.body.texto).toBe('Hola, ¿qué documentos necesito?');
    expect(envio.body.esDeSecretaria).toBe(false);

    const hilo = await request(app.getHttpServer())
      .get('/chat/mios')
      .set('Authorization', `Bearer ${tokenFor(est.id)}`);
    expect(hilo.status).toBe(200);
    expect(hilo.body).toHaveLength(1);
    expect(hilo.body[0].autorId).toBe(est.id);
  });

  // test_rol_interno_no_usa_endpoints_de_solicitante
  it('un rol interno (evaluador) no puede usar los endpoints de solicitante', async () => {
    const ev = await crearUsuario('evaluador');
    const token = tokenFor(ev.id);

    const get = await request(app.getHttpServer())
      .get('/chat/mios')
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(403);

    const post = await request(app.getHttpServer())
      .post('/chat/mios')
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: 'x' });
    expect(post.status).toBe(403);
  });

  // test_texto_vacio_o_muy_largo_da_400
  it('rechaza con 400 un texto vacío o mayor a 2000 caracteres', async () => {
    const est = await crearUsuario('estudiante_pregrado');
    const token = tokenFor(est.id);

    const vacio = await request(app.getHttpServer())
      .post('/chat/mios')
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: '   ' });
    expect(vacio.status).toBe(400);

    const largo = await request(app.getHttpServer())
      .post('/chat/mios')
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: 'x'.repeat(2001) });
    expect(largo.status).toBe(400);
  });

  // test_no_leidos_del_solicitante
  it('cuenta los no-leídos del solicitante y los marca leídos al abrir el hilo', async () => {
    const est = await crearUsuario('estudiante_pregrado');
    const sec = await crearUsuario('secretaria');

    await request(app.getHttpServer())
      .post(`/chat/${est.id}`)
      .set('Authorization', `Bearer ${tokenFor(sec.id)}`)
      .send({ texto: 'Le falta la boleta' });

    const noLeidos = await request(app.getHttpServer())
      .get('/chat/mios/no-leidos')
      .set('Authorization', `Bearer ${tokenFor(est.id)}`);
    expect(noLeidos.status).toBe(200);
    expect(noLeidos.body.noLeidos).toBe(1);

    // Abrir el hilo marca como leído.
    await request(app.getHttpServer())
      .get('/chat/mios')
      .set('Authorization', `Bearer ${tokenFor(est.id)}`);
    const tras = await request(app.getHttpServer())
      .get('/chat/mios/no-leidos')
      .set('Authorization', `Bearer ${tokenFor(est.id)}`);
    expect(tras.body.noLeidos).toBe(0);
  });

  // ---------- Lado secretaría ----------

  // test_solicitante_no_usa_endpoints_de_secretaria
  it('un solicitante no puede usar los endpoints de secretaría', async () => {
    const est = await crearUsuario('estudiante_pregrado');
    const otro = await crearUsuario('investigador');
    const token = tokenFor(est.id);

    expect(
      (
        await request(app.getHttpServer())
          .get('/chat/conversaciones')
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .get('/chat/solicitantes')
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/chat/${otro.id}`)
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .post(`/chat/${otro.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ texto: 'x' })
      ).status,
    ).toBe(403);
  });

  // test_bandeja_agrupada_con_datos_y_no_leidos
  it('la bandeja agrupada muestra una conversación por solicitante, ordenada por actividad y con no-leídos', async () => {
    const est = await crearUsuario('estudiante_pregrado', {
      email: `${marca}.a@uch.edu.pe`,
      codigoEstudiante: '2021001',
    });
    const inv = await crearUsuario('investigador', {
      email: `${marca}.b@uch.edu.pe`,
    });
    const sec = await crearUsuario('secretaria');

    await request(app.getHttpServer())
      .post('/chat/mios')
      .set('Authorization', `Bearer ${tokenFor(est.id)}`)
      .send({ texto: 'Duda 1' });
    await request(app.getHttpServer())
      .post('/chat/mios')
      .set('Authorization', `Bearer ${tokenFor(est.id)}`)
      .send({ texto: 'Duda 2' });
    await request(app.getHttpServer())
      .post('/chat/mios')
      .set('Authorization', `Bearer ${tokenFor(inv.id)}`)
      .send({ texto: 'Consulta del investigador' });

    const conv = await request(app.getHttpServer())
      .get('/chat/conversaciones')
      .set('Authorization', `Bearer ${tokenFor(sec.id)}`);
    expect(conv.status).toBe(200);
    const convs = conv.body;
    expect(convs).toHaveLength(2);
    // Ordenada por más reciente: el investigador escribió último.
    expect(convs[0].solicitanteId).toBe(inv.id);
    expect(convs[0].codigoEstudiante).toBeNull();
    expect(convs[0].ultimoMensaje).toBe('Consulta del investigador');

    const porId = Object.fromEntries(
      convs.map((c: any) => [c.solicitanteId, c]),
    );
    expect(porId[est.id].codigoEstudiante).toBe('2021001');
    expect(porId[est.id].noLeidos).toBe(2);
    expect(porId[est.id].nombre).toBe('Test estudiante_pregrado');

    const total = await request(app.getHttpServer())
      .get('/chat/no-leidos')
      .set('Authorization', `Bearer ${tokenFor(sec.id)}`);
    expect(total.body.noLeidos).toBe(3);
  });

  // test_secretaria_lee_hilo_y_marca_leidos
  it('la secretaría lee el hilo de un solicitante y marca sus mensajes como leídos', async () => {
    const est = await crearUsuario('estudiante_pregrado');
    const sec = await crearUsuario('secretaria');

    await request(app.getHttpServer())
      .post('/chat/mios')
      .set('Authorization', `Bearer ${tokenFor(est.id)}`)
      .send({ texto: 'Hola' });

    const hilo = await request(app.getHttpServer())
      .get(`/chat/${est.id}`)
      .set('Authorization', `Bearer ${tokenFor(sec.id)}`);
    expect(hilo.status).toBe(200);
    expect(hilo.body).toHaveLength(1);

    const total = await request(app.getHttpServer())
      .get('/chat/no-leidos')
      .set('Authorization', `Bearer ${tokenFor(sec.id)}`);
    expect(total.body.noLeidos).toBe(0);
  });

  // test_secretaria_inicia_conversacion
  it('la secretaría puede iniciar una conversación con un solicitante', async () => {
    const inv = await crearUsuario('investigador');
    const sec = await crearUsuario('secretaria');

    const envio = await request(app.getHttpServer())
      .post(`/chat/${inv.id}`)
      .set('Authorization', `Bearer ${tokenFor(sec.id)}`)
      .send({ texto: 'Su proyecto tiene una observación' });
    expect(envio.status).toBe(200);
    expect(envio.body.esDeSecretaria).toBe(true);

    const mensajes = await request(app.getHttpServer())
      .get('/chat/mios')
      .set('Authorization', `Bearer ${tokenFor(inv.id)}`);
    expect(mensajes.body).toHaveLength(1);
    expect(mensajes.body[0].esDeSecretaria).toBe(true);
  });

  // test_hilo_de_no_solicitante_da_404
  it('devuelve 404 al leer o escribir el hilo de un usuario que no es solicitante', async () => {
    const sec = await crearUsuario('secretaria');
    const coord = await crearUsuario('coordinador');
    const token = tokenFor(sec.id);

    expect(
      (
        await request(app.getHttpServer())
          .get('/chat/99999')
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app.getHttpServer())
          .post(`/chat/${coord.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ texto: 'x' })
      ).status,
    ).toBe(404);
  });

  // test_lista_de_solicitantes
  it('lista solo los solicitantes activos, ordenados, para que secretaría inicie una conversación', async () => {
    const est = await crearUsuario('estudiante_pregrado', {
      email: `${marca}.a2@uch.edu.pe`,
      codigoEstudiante: '2021001',
    });
    const inv = await crearUsuario('investigador', {
      email: `${marca}.b2@uch.edu.pe`,
    });
    const evaluador = await crearUsuario('evaluador', {
      email: `${marca}.c2@uch.edu.pe`,
    });
    const sec = await crearUsuario('secretaria');

    const resp = await request(app.getHttpServer())
      .get('/chat/solicitantes')
      .set('Authorization', `Bearer ${tokenFor(sec.id)}`);
    expect(resp.status).toBe(200);

    // Filtra a los propios de este test (la bandeja es global) antes de
    // comparar el set de roles -- evita falsos negativos por datos de otros
    // specs que compartan el mismo schema "test".
    const idsPropios = new Set([est.id, inv.id, evaluador.id, sec.id]);
    const propios = resp.body.filter((s: any) => idsPropios.has(s.id));
    const roles = new Set(propios.map((s: any) => s.rol));
    expect(roles).toEqual(new Set(['estudiante_pregrado', 'investigador']));

    const porRol = Object.fromEntries(propios.map((s: any) => [s.rol, s]));
    expect(porRol['estudiante_pregrado'].codigoEstudiante).toBe('2021001');
  });
});
