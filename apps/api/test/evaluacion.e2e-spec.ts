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
import { EmailService, EnviarEmailParams } from '../src/email/email.service';
import { CRITERIOS_RUBRICA, PUNTAJE_TOTAL_MAX, resultadoPorPuntaje } from '../src/evaluacion/rubrica';

// Redirige DATABASE_URL/SECRET_KEY al schema Postgres "test" (aislado de
// producción) ANTES de cargar AppModule. Mismo patrón que
// test/expedientes.e2e-spec.ts. El `import 'dotenv/config'` de arriba ya
// cargó R2_* desde `.env` -- ese override NO los toca (solo
// redefine DATABASE_URL/SECRET_KEY), así que la generación de PDFs sigue
// apuntando al bucket real de Cloudflare R2 (mismo patrón que
// expedientes-documentos.e2e-spec.ts).
loadEnv({ path: path.join(__dirname, '..', '.env.test'), override: true });

const { AppModule } = require('../src/app.module') as {
  AppModule: typeof AppModuleType;
};

// ==================== resultadoPorPuntaje (pura) ====================
// Idéntico a comite/backend/tests/test_rubrica.py::test_umbrales. Se corre
// y se confirma que FALLA antes de crear rubrica.ts (TDD, Step 2/3 del brief).
describe('resultadoPorPuntaje', () => {
  it.each([
    [0, 'no_aprobado'],
    [12, 'no_aprobado'],
    [13, 'aprobado_observaciones'],
    [16, 'aprobado_observaciones'],
    [17, 'aprobado'],
    [20, 'aprobado'],
  ])('%i puntos -> %s', (total, esperado) => {
    expect(resultadoPorPuntaje(total as number)).toBe(esperado);
  });
});

// Equivalente a test_rubrica.py::test_catalogo_suma_20_y_tiene_7_criterios.
describe('CRITERIOS_RUBRICA (catálogo)', () => {
  it('tiene 7 criterios que suman 20 puntos', () => {
    expect(CRITERIOS_RUBRICA).toHaveLength(7);
    expect(CRITERIOS_RUBRICA.reduce((acc, c) => acc + c.puntajeMax, 0)).toBe(20);
    expect(PUNTAJE_TOTAL_MAX).toBe(20);
    const keys = new Set(CRITERIOS_RUBRICA.map((c) => c.key));
    expect(keys).toEqual(
      new Set([
        'valor_pertinencia',
        'principios_eticos',
        'consentimiento_informado',
        'proteccion_participantes',
        'poblaciones_vulnerables',
        'confidencialidad_datos',
        'adecuacion_metodologica',
      ]),
    );
  });
});

// Puntajes por criterio para cada uno de los 3 posibles resultados (mismo
// orden que CRITERIOS_RUBRICA: valor_pertinencia(2), principios_eticos(4),
// consentimiento_informado(4), proteccion_participantes(3),
// poblaciones_vulnerables(2), confidencialidad_datos(3),
// adecuacion_metodologica(2)).
const PUNTAJES_NO_APROBADO = [1, 2, 2, 1, 1, 2, 1]; // total 10
const PUNTAJES_APROBADO_OBSERVACIONES = [2, 3, 3, 2, 1, 2, 1]; // total 14
// Puntajes por criterio en el orden de CRITERIOS_RUBRICA, respetando el
// maximo de cada uno segun el formato oficial (3/4/4/2/2/2/3).
const PUNTAJES_APROBADO = [3, 4, 4, 2, 2, 2, 2]; // total 19

function criteriosBody(puntajes: number[]) {
  return CRITERIOS_RUBRICA.map((c, i) => ({ key: c.key, puntaje: puntajes[i], observacion: `obs-${c.key}` }));
}

// `dictamenPdfUrl` expone tal cual lo persistido en `Evaluacion.dictamenPdfPath`,
// que hoy es la KEY del objeto en el bucket. Antes se guardaba ahí un presigned
// URL de 7 días (que al caducar dejaba el dictamen inaccesible para siempre);
// ver el comentario en PdfService.generarDictamen. Se conserva el fallback de
// parseo por si algún registro viejo todavía trae una URL completa.
function keyDeDictamen(valor: string, bucket: string): string {
  if (!valor.startsWith('http')) return valor;
  const u = new URL(valor);
  const marker = `/${bucket}/`;
  const idx = u.pathname.indexOf(marker);
  return decodeURIComponent(u.pathname.slice(idx + marker.length));
}

describe('Evaluacion (e2e, contra el schema "test" aislado + bucket REAL de Cloudflare R2)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let storage: StorageService;

  const marca = `e2e.evaluacion.${Date.now()}`;
  let adminId: number;
  let coordinadorId: number;
  let evaluador1Id: number;
  let evaluador2Id: number;
  let investigadorId: number;

  const expedienteIds: number[] = [];
  const clavesSubidas: string[] = []; // keys reales creadas en el bucket, para limpiar al final

  const tokenFor = (id: number) => jwtService.sign({ sub: String(id) });

  // codigoUnico real es corto (formato "N-AÑO", ej. "12-2026" -- ver
  // ExpedientesService.generarCodigoAnual): se usa un contador corto en vez
  // de `marca` completa para no inflar artificialmente el nombre del PDF de
  // dictamen (`DIC-{codigoUnico}`), que debe entrar en la columna
  // `dictamen_pdf_path` (VarChar(500), igual que en producción).
  let contadorCodigo = 0;
  async function crearExpediente(titulo: string) {
    contadorCodigo += 1;
    const exp = await prisma.expediente.create({
      data: { tituloProtocolo: titulo, investigadorId, estado: 'en_revision', codigoUnico: `${contadorCodigo}-2026-E2E` },
    });
    expedienteIds.push(exp.id);
    await prisma.autorExpediente.create({
      data: { expedienteId: exp.id, orden: 1, apellidosNombres: 'Autor De Prueba', esPrincipal: true },
    });
    return exp;
  }

  beforeAll(async () => {
    prisma = new PrismaClient();
    storage = new StorageService();
    const passwordHash = await bcrypt.hash('password', 12);

    const admin = await prisma.user.create({
      data: { email: `${marca}.admin@uch.edu.pe`, passwordHash, nombre: 'Admin', apellido: 'Test', rol: 'administrador', activo: true },
    });
    adminId = admin.id;

    const coordinador = await prisma.user.create({
      data: { email: `${marca}.coordinador@uch.edu.pe`, passwordHash, nombre: 'Coord', apellido: 'Test', rol: 'coordinador', activo: true },
    });
    coordinadorId = coordinador.id;

    const ev1 = await prisma.user.create({
      data: { email: `${marca}.evaluador1@uch.edu.pe`, passwordHash, nombre: 'Evaluador', apellido: 'Uno', rol: 'evaluador', activo: true },
    });
    evaluador1Id = ev1.id;

    const ev2 = await prisma.user.create({
      data: { email: `${marca}.evaluador2@uch.edu.pe`, passwordHash, nombre: 'Evaluador', apellido: 'Dos', rol: 'evaluador', activo: true },
    });
    evaluador2Id = ev2.id;

    const investigador = await prisma.user.create({
      data: {
        email: `${marca}.investigador@uch.edu.pe`,
        passwordHash,
        nombre: 'Investigador',
        apellido: 'Test',
        rol: 'estudiante_pregrado',
        activo: true,
        codigoEstudiante: '2020200',
      },
    });
    investigadorId = investigador.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    // Limpieza del bucket REAL de Cloudflare R2.
    const client = storage.getClient();
    for (const key of clavesSubidas) {
      await client.deleteObject({ Bucket: storage.getBucket(), Key: key }).catch(() => null);
    }

    if (expedienteIds.length > 0) {
      await prisma.evaluacionCriterio.deleteMany({
        where: { evaluacion: { expedienteId: { in: expedienteIds } } },
      });
      await prisma.evaluacion.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.notificacion.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.historialExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.autorExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.expediente.deleteMany({ where: { id: { in: expedienteIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /evaluacion/rubrica devuelve el catalogo de 7 criterios y el puntaje maximo', async () => {
    const resp = await request(app.getHttpServer())
      .get('/evaluacion/rubrica')
      .set('Authorization', `Bearer ${tokenFor(adminId)}`);
    expect(resp.status).toBe(200);
    expect(resp.body.criterios).toHaveLength(7);
    expect(resp.body.puntajeTotalMax).toBe(20);
    expect(resp.body.umbrales.aprobado).toBe('17-20');
  });

  // ==================== REGLA DURA: 1 solo evaluador (POST /evaluacion/) ====================
  describe('1 solo evaluador por expediente -- POST /evaluacion/', () => {
    it('coordinador crea (autoasigna) una evaluacion; un segundo intento es rechazado con 400', async () => {
      const exp = await crearExpediente('UN-EVALUADOR-CREATE');

      const r1 = await request(app.getHttpServer())
        .post('/evaluacion/')
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ expedienteId: exp.id });
      expect(r1.status).toBe(201);
      expect(r1.body.evaluadorId).toBe(coordinadorId);

      const r2 = await request(app.getHttpServer())
        .post('/evaluacion/')
        .set('Authorization', `Bearer ${tokenFor(adminId)}`)
        .send({ expedienteId: exp.id });
      expect(r2.status).toBe(400);
      expect(r2.body.message).toContain('ya tiene un evaluador asignado');
    });

    it('un rol no coordinador/administrador no puede crear evaluaciones (403)', async () => {
      const exp = await crearExpediente('CREATE-ROL-INVALIDO');
      const resp = await request(app.getHttpServer())
        .post('/evaluacion/')
        .set('Authorization', `Bearer ${tokenFor(investigadorId)}`)
        .send({ expedienteId: exp.id });
      expect(resp.status).toBe(403);
    });
  });

  // ==================== REGLA DURA: 1 solo evaluador (POST /evaluacion/expediente/{id}/asignar) ====================
  // Idéntico a comite/backend/tests/test_asignacion_un_evaluador.py.
  describe('1 solo evaluador por expediente -- POST /evaluacion/expediente/{id}/asignar', () => {
    it('rechaza un segundo evaluador para el mismo expediente', async () => {
      const exp = await crearExpediente('UN-EVALUADOR-ASIGNAR');

      const r1 = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador1Id });
      expect(r1.status).toBe(201);
      expect(r1.body.message).toBe('Evaluador asignado exitosamente');
      expect(r1.body.evaluador.id).toBe(evaluador1Id);

      const notificacion = await prisma.notificacion.findFirst({ where: { usuarioId: evaluador1Id, expedienteId: exp.id } });
      expect(notificacion).not.toBeNull();

      const r2 = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador2Id });
      expect(r2.status).toBe(400);
      expect(r2.body.message).toContain('ya tiene un evaluador asignado');
    });

    it('rechaza asignar un usuario que no tiene rol evaluador', async () => {
      const exp = await crearExpediente('ASIGNAR-ROL-INVALIDO');
      const resp = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: investigadorId });
      expect(resp.status).toBe(400);
      expect(resp.body.message).toContain('no tiene rol de evaluador');
    });
  });

  // ==================== PUT /evaluacion/{id} -- validaciones ====================
  describe('PUT /evaluacion/{id} -- validaciones de la rubrica', () => {
    it('rechaza un criterio desconocido', async () => {
      const exp = await crearExpediente('VALIDACION-CRITERIO-DESCONOCIDO');
      const asignacion = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador1Id });
      const evaluacionId = asignacion.body.evaluacionId;

      const resp = await request(app.getHttpServer())
        .put(`/evaluacion/${evaluacionId}`)
        .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`)
        .send({ criterios: [{ key: 'criterio_inventado', puntaje: 1 }] });
      expect(resp.status).toBe(400);
      expect(resp.body.message).toContain('Criterio desconocido');
    });

    it('rechaza un puntaje fuera de rango para un criterio', async () => {
      const exp = await crearExpediente('VALIDACION-RANGO');
      const asignacion = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador1Id });
      const evaluacionId = asignacion.body.evaluacionId;

      const resp = await request(app.getHttpServer())
        .put(`/evaluacion/${evaluacionId}`)
        .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`)
        .send({ criterios: [{ key: 'valor_pertinencia', puntaje: 99 }] });
      expect(resp.status).toBe(400);
      // 3 es el maximo de 'valor_pertinencia' en el formato oficial del Comite.
      expect(resp.body.message).toContain("debe estar entre 0 y 3");
    });

    it('rechaza completar sin los 7 criterios', async () => {
      const exp = await crearExpediente('VALIDACION-FALTAN-CRITERIOS');
      const asignacion = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador1Id });
      const evaluacionId = asignacion.body.evaluacionId;

      const resp = await request(app.getHttpServer())
        .put(`/evaluacion/${evaluacionId}`)
        .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`)
        .send({ criterios: [{ key: 'valor_pertinencia', puntaje: 2 }], completa: true });
      expect(resp.status).toBe(400);
      expect(resp.body.message).toContain('Faltan criterios');
    });

    it('un evaluador no asignado no puede modificar la evaluacion de otro (403)', async () => {
      const exp = await crearExpediente('VALIDACION-NO-DUENIO');
      const asignacion = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador1Id });
      const evaluacionId = asignacion.body.evaluacionId;

      const resp = await request(app.getHttpServer())
        .put(`/evaluacion/${evaluacionId}`)
        .set('Authorization', `Bearer ${tokenFor(evaluador2Id)}`)
        .send({ observaciones: 'intento ajeno' });
      expect(resp.status).toBe(403);
    });
  });

  // ==================== Completar rubrica: las 3 ramas de resultado ====================
  // El escenario más crítico del módulo: al completar, debe (a) calcular
  // puntajeTotal/resultado correctamente, (b) transicionar
  // expediente.estado + dejar historial, y (c) generar EXACTAMENTE los PDFs
  // que corresponden según el resultado (routes.py:179-191):
  //   aprobado               -> dictamen solamente
  //   aprobado_observaciones -> rúbrica + dictamen
  //   no_aprobado            -> rúbrica solamente
  describe('completar la rubrica genera los PDFs correctos segun el resultado', () => {
    it('no_aprobado (puntaje 10): genera SOLO el PDF de rubrica', async () => {
      const exp = await crearExpediente('COMPLETAR-NO-APROBADO');
      const asignacion = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador1Id });
      const evaluacionId = asignacion.body.evaluacionId;

      const resp = await request(app.getHttpServer())
        .put(`/evaluacion/${evaluacionId}`)
        .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`)
        .send({ criterios: criteriosBody(PUNTAJES_NO_APROBADO), completa: true, observaciones: 'No cumple varios criterios' });

      expect(resp.status).toBe(200);
      expect(resp.body.puntajeTotal).toBe(10);
      expect(resp.body.resultado).toBe('no_aprobado');
      expect(resp.body.rubricaPdfUrl).toBeTruthy();
      expect(resp.body.rubricaPdfUrl.startsWith('http')).toBe(false); // key S3, no URL
      expect(resp.body.dictamenPdfUrl).toBeFalsy();
      clavesSubidas.push(resp.body.rubricaPdfUrl);

      const expActualizado = await prisma.expediente.findUnique({ where: { id: exp.id } });
      expect(expActualizado?.estado).toBe('no_aprobado');
      const historial = await prisma.historialExpediente.findMany({ where: { expedienteId: exp.id } });
      expect(historial.some((h) => h.estadoNuevo === 'no_aprobado')).toBe(true);

      // Equivalente de comite/backend/tests/test_modelo_criterios.py::test_crear_evaluacion_con_criterios:
      // los EvaluacionCriterio quedan persistidos individualmente con su
      // criterioKey/puntaje, no solo agregados en puntajeTotal.
      const criteriosPersistidos = await prisma.evaluacionCriterio.findMany({
        where: { evaluacionId: Number(evaluacionId) },
      });
      expect(criteriosPersistidos).toHaveLength(7);
      const porKey = Object.fromEntries(criteriosPersistidos.map((c) => [c.criterioKey, c.puntaje]));
      CRITERIOS_RUBRICA.forEach((c, i) => {
        expect(porKey[c.key]).toBe(PUNTAJES_NO_APROBADO[i]);
      });

      // Verifica que el PDF de rúbrica realmente existe en el bucket y se
      // puede descargar via el endpoint (key S3 -- sirve el buffer, no redirige).
      const descarga = await request(app.getHttpServer())
        .get(`/evaluacion/${evaluacionId}/descargar-rubrica`)
        .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`);
      expect(descarga.status).toBe(200);
      expect(descarga.headers['content-type']).toBe('application/pdf');
      expect(Buffer.from(descarga.body).slice(0, 4).toString()).toBe('%PDF');
    }, 30000);

    it('aprobado_observaciones (puntaje 14): genera rubrica Y dictamen', async () => {
      const exp = await crearExpediente('COMPLETAR-APROBADO-OBSERVACIONES');
      const asignacion = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador1Id });
      const evaluacionId = asignacion.body.evaluacionId;

      const resp = await request(app.getHttpServer())
        .put(`/evaluacion/${evaluacionId}`)
        .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`)
        .send({ criterios: criteriosBody(PUNTAJES_APROBADO_OBSERVACIONES), completa: true, observaciones: 'Aprobado con observaciones menores' });

      expect(resp.status).toBe(200);
      expect(resp.body.puntajeTotal).toBe(14);
      expect(resp.body.resultado).toBe('aprobado_observaciones');
      expect(resp.body.rubricaPdfUrl).toBeTruthy();
      expect(resp.body.dictamenPdfUrl).toBeTruthy();
      // Se persiste la KEY del objeto, no un presigned URL (que caducaba a los
      // 7 días dejando el dictamen inaccesible). Ver PdfService.generarDictamen.
      expect(resp.body.dictamenPdfUrl.startsWith('http')).toBe(false);
      expect(resp.body.dictamenPdfUrl.startsWith('dictamenes/')).toBe(true);
      clavesSubidas.push(resp.body.rubricaPdfUrl);
      clavesSubidas.push(keyDeDictamen(resp.body.dictamenPdfUrl, storage.getBucket()));

      const expActualizado = await prisma.expediente.findUnique({ where: { id: exp.id } });
      expect(expActualizado?.estado).toBe('aprobado_observaciones');

      // Al ser una key (no una URL), la descarga sirve los bytes del PDF
      // directamente desde el bucket en vez de redirigir a un enlace efímero.
      const descarga = await request(app.getHttpServer())
        .get(`/evaluacion/${evaluacionId}/descargar-dictamen`)
        .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`)
        .redirects(0);
      expect(descarga.status).toBe(200);
      expect(descarga.body.subarray(0, 4).toString()).toBe('%PDF');
    }, 30000);

    // La rubrica es el formato oficial de evaluacion: se emite SIEMPRE, apruebe
    // o no. El dictamen solo se suma cuando el proyecto queda aprobado.
    it('aprobado (puntaje 19): genera el dictamen ademas de la rubrica', async () => {
      const exp = await crearExpediente('COMPLETAR-APROBADO');
      const asignacion = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador1Id });
      const evaluacionId = asignacion.body.evaluacionId;

      const resp = await request(app.getHttpServer())
        .put(`/evaluacion/${evaluacionId}`)
        .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`)
        .send({ criterios: criteriosBody(PUNTAJES_APROBADO), completa: true, observaciones: 'Cumple todos los criterios' });

      expect(resp.status).toBe(200);
      expect(resp.body.puntajeTotal).toBe(19);
      expect(resp.body.resultado).toBe('aprobado');
      expect(resp.body.dictamenPdfUrl).toBeTruthy();
      expect(resp.body.dictamenPdfUrl.startsWith('http')).toBe(false);
      expect(resp.body.dictamenPdfUrl.startsWith('dictamenes/')).toBe(true);
      expect(resp.body.rubricaPdfUrl).toBeTruthy();
      expect(resp.body.rubricaPdfUrl.startsWith('evaluaciones/')).toBe(true);
      clavesSubidas.push(resp.body.rubricaPdfUrl);
      clavesSubidas.push(keyDeDictamen(resp.body.dictamenPdfUrl, storage.getBucket()));

      const expActualizado = await prisma.expediente.findUnique({ where: { id: exp.id } });
      expect(expActualizado?.estado).toBe('aprobado');
    }, 30000);
  });

  // ==================== Email al completar (Task 10, EmailService) ====================
  // Verifica el bloque que reemplazó al TODO de la Task 8 en
  // EvaluacionService (routes.py:195-252): quiénes reciben el correo, el
  // asunto/cuerpo según el resultado y los adjuntos. Como no hay SMTP_HOST
  // en .env/.env.test, EmailService cae en su modo simulado (console.log) --
  // se prueban ambos ángulos: (a) que EvaluacionService llama a
  // EmailService.enviarEmail con los argumentos correctos (mockeando el
  // envío real, para no depender del formato del log), y (b) que, SIN
  // mockear nada, el fallback simulado de EmailService realmente se dispara
  // (spy sobre console.log) -- confirma que SMTP_HOST sigue sin configurar
  // en este entorno de test y que el flujo llega de punta a punta.
  describe('Notificacion por email al completar la rubrica', () => {
    let enviarEmailSpy: jest.SpyInstance<Promise<boolean>, [EnviarEmailParams]>;

    beforeEach(() => {
      enviarEmailSpy = jest
        .spyOn(EmailService.prototype, 'enviarEmail')
        .mockResolvedValue(true);
    });

    afterEach(() => {
      enviarEmailSpy.mockRestore();
    });

    it('no_aprobado: notifica (fallback al investigador, autor sin correo) con la rubrica adjunta', async () => {
      const exp = await crearExpediente('EMAIL-NO-APROBADO');
      const asignacion = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador1Id });
      const evaluacionId = asignacion.body.evaluacionId;

      const resp = await request(app.getHttpServer())
        .put(`/evaluacion/${evaluacionId}`)
        .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`)
        .send({ criterios: criteriosBody(PUNTAJES_NO_APROBADO), completa: true, observaciones: 'obs' });
      expect(resp.status).toBe(200);
      clavesSubidas.push(resp.body.rubricaPdfUrl);

      expect(enviarEmailSpy).toHaveBeenCalledTimes(1);
      const params = enviarEmailSpy.mock.calls[0][0];
      expect(params.to).toEqual([`${marca}.investigador@uch.edu.pe`]);
      expect(params.subject).toBe(`Resultado de evaluación - ${exp.codigoUnico}`);
      expect(params.body).toContain('No aprobado');
      expect(params.body).toContain('Puntaje: 10/20');
      expect(params.body).toContain('Adjunto encontrará la rúbrica de evaluación.');
      expect(params.attachments).toHaveLength(1);
      expect(params.attachments?.[0].filename).toBe(`rubrica_evaluacion_${evaluacionId}.pdf`);
      expect(Buffer.isBuffer(params.attachments?.[0].content)).toBe(true);
    }, 30000);

    it('aprobado_observaciones: notifica al correo del autor (no al investigador) con rubrica + dictamen adjuntos', async () => {
      const exp = await crearExpediente('EMAIL-APROBADO-OBSERVACIONES');
      await prisma.autorExpediente.updateMany({
        where: { expedienteId: exp.id },
        data: { correo: `${marca}.autor@uch.edu.pe` },
      });
      const asignacion = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador1Id });
      const evaluacionId = asignacion.body.evaluacionId;

      const resp = await request(app.getHttpServer())
        .put(`/evaluacion/${evaluacionId}`)
        .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`)
        .send({ criterios: criteriosBody(PUNTAJES_APROBADO_OBSERVACIONES), completa: true, observaciones: 'obs' });
      expect(resp.status).toBe(200);
      clavesSubidas.push(resp.body.rubricaPdfUrl);
      clavesSubidas.push(keyDeDictamen(resp.body.dictamenPdfUrl, storage.getBucket()));

      expect(enviarEmailSpy).toHaveBeenCalledTimes(1);
      const params = enviarEmailSpy.mock.calls[0][0];
      expect(params.to).toEqual([`${marca}.autor@uch.edu.pe`]);
      expect(params.body).toContain('Aprobado con observaciones');
      expect(params.body).toContain('Adjunto encontrará la rúbrica de evaluación y el dictamen correspondiente.');
      expect(params.attachments).toHaveLength(2);
      const nombres = params.attachments?.map((a) => a.filename);
      expect(nombres).toEqual(
        expect.arrayContaining([`rubrica_evaluacion_${evaluacionId}.pdf`, `dictamen_evaluacion_${evaluacionId}.pdf`]),
      );
    }, 30000);

    it('aprobado: notifica adjuntando la rubrica y el dictamen', async () => {
      const exp = await crearExpediente('EMAIL-APROBADO');
      const asignacion = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador1Id });
      const evaluacionId = asignacion.body.evaluacionId;

      const resp = await request(app.getHttpServer())
        .put(`/evaluacion/${evaluacionId}`)
        .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`)
        .send({ criterios: criteriosBody(PUNTAJES_APROBADO), completa: true, observaciones: 'obs' });
      expect(resp.status).toBe(200);
      clavesSubidas.push(resp.body.rubricaPdfUrl);
      clavesSubidas.push(keyDeDictamen(resp.body.dictamenPdfUrl, storage.getBucket()));

      expect(enviarEmailSpy).toHaveBeenCalledTimes(1);
      const params = enviarEmailSpy.mock.calls[0][0];
      expect(params.body).toContain('Adjunto encontrará la rúbrica de evaluación y el dictamen correspondiente.');
      expect(params.attachments).toHaveLength(2);
      expect(params.attachments?.[0].filename).toBe(`rubrica_evaluacion_${evaluacionId}.pdf`);
      expect(params.attachments?.[1].filename).toBe(`dictamen_evaluacion_${evaluacionId}.pdf`);
    }, 30000);

    it('sin RESEND_API_KEY configurada, EmailService cae en modo simulado y loguea con console.log', async () => {
      enviarEmailSpy.mockRestore(); // deja correr el EmailService real (sin mockear) para este caso puntual

      // `import 'dotenv/config'` carga el .env real, que SÍ trae RESEND_API_KEY.
      // Sin desactivarla aquí, este test dispararía un envío real contra la API
      // de Resend (consumiendo cuota por cada corrida de la suite).
      const apiKeyOriginal = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      try {
        const exp = await crearExpediente('EMAIL-SIMULADO-CONSOLE-LOG');
        const asignacion = await request(app.getHttpServer())
          .post(`/evaluacion/expediente/${exp.id}/asignar`)
          .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
          .send({ evaluadorId: evaluador1Id });
        const evaluacionId = asignacion.body.evaluacionId;

        const resp = await request(app.getHttpServer())
          .put(`/evaluacion/${evaluacionId}`)
          .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`)
          .send({ criterios: criteriosBody(PUNTAJES_APROBADO), completa: true, observaciones: 'obs' });
        expect(resp.status).toBe(200);
        clavesSubidas.push(resp.body.rubricaPdfUrl);
        clavesSubidas.push(keyDeDictamen(resp.body.dictamenPdfUrl, storage.getBucket()));

        const llamadaEmail = consoleLogSpy.mock.calls.find(([msg]) =>
          typeof msg === 'string' && msg.includes('[EMAIL] RESEND_API_KEY no configurada'),
        );
        expect(llamadaEmail).toBeDefined();
        const mensaje = llamadaEmail?.[0] as string;
        expect(mensaje).toContain(`${marca}.investigador@uch.edu.pe`);
        expect(mensaje).toContain(`Resultado de evaluación - ${exp.codigoUnico}`);
      } finally {
        consoleLogSpy.mockRestore();
        if (apiKeyOriginal !== undefined) process.env.RESEND_API_KEY = apiKeyOriginal;
      }
    }, 30000);
  });

  // ==================== conflicto / guardar-parcial ====================
  describe('POST /evaluacion/{id}/conflicto y /guardar-parcial', () => {
    it('el evaluador asignado puede declarar conflicto de interes', async () => {
      const exp = await crearExpediente('CONFLICTO');
      const asignacion = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador1Id });
      const evaluacionId = asignacion.body.evaluacionId;

      const resp = await request(app.getHttpServer())
        .post(`/evaluacion/${evaluacionId}/conflicto`)
        .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`);
      expect(resp.status).toBe(200);

      const otro = await request(app.getHttpServer())
        .post(`/evaluacion/${evaluacionId}/conflicto`)
        .set('Authorization', `Bearer ${tokenFor(evaluador2Id)}`);
      expect(otro.status).toBe(403);
    });

    it('guardar-parcial guarda observaciones sin exigir los 7 criterios', async () => {
      const exp = await crearExpediente('GUARDAR-PARCIAL');
      const asignacion = await request(app.getHttpServer())
        .post(`/evaluacion/expediente/${exp.id}/asignar`)
        .set('Authorization', `Bearer ${tokenFor(coordinadorId)}`)
        .send({ evaluadorId: evaluador1Id });
      const evaluacionId = asignacion.body.evaluacionId;

      const resp = await request(app.getHttpServer())
        .post(`/evaluacion/${evaluacionId}/guardar-parcial`)
        .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`)
        .send({ observaciones: 'avance parcial' });
      expect(resp.status).toBe(200);
      expect(resp.body.message).toBe('Guardado parcial exitoso');

      const guardada = await prisma.evaluacion.findUnique({ where: { id: evaluacionId } });
      expect(guardada?.observaciones).toBe('avance parcial');
      expect(guardada?.completa).not.toBe(true);
    });
  });

  // ==================== GET /evaluacion/mis-evaluaciones ====================
  it('GET /evaluacion/mis-evaluaciones solo es accesible para evaluadores', async () => {
    const resp = await request(app.getHttpServer())
      .get('/evaluacion/mis-evaluaciones')
      .set('Authorization', `Bearer ${tokenFor(adminId)}`);
    expect(resp.status).toBe(403);

    const respOk = await request(app.getHttpServer())
      .get('/evaluacion/mis-evaluaciones')
      .set('Authorization', `Bearer ${tokenFor(evaluador1Id)}`);
    expect(respOk.status).toBe(200);
    expect(Array.isArray(respOk.body)).toBe(true);
  });
});
