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

// Levantamiento de las 4 observaciones del Comité de Ética (spec
// docs/superpowers/specs/2026-09-07-observaciones-comite-design.md):
//   1. tipoProyecto (ARTICULO/TESIS/OTRO)
//   2. alerta a Secretaría por título similar (no bloquea)
//   3. rechazo automático por duplicado exacto
//   4. reenvío con tope de 3 intentos + "mis proyectos rechazados"
// Cada escenario arma uno o dos expedientes completos (autores + los 5
// documentos obligatorios) contra Neon antes de llamar al endpoint: los 5 s
// por defecto de Jest no alcanzan para esa ida y vuelta.
jest.setTimeout(30_000);

describe('Observaciones del Comité (e2e, schema "test" aislado)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;

  const marca = `e2e.observaciones.${Date.now()}`;
  let pregradoId: number;
  let otroPregradoId: number;
  let secretariaId: number;

  const expedienteIds: number[] = [];

  const tokenFor = (id: number) => jwt.sign({ sub: String(id) });

  // Documentos que `validarCompletitud` exige para poder enviar un expediente
  // de pregrado. Se insertan directo por Prisma (subirlos por HTTP exigiría
  // el bucket real, que no es lo que estos tests verifican).
  const DOCS_PREGRADO = [
    'proyecto_pdf',
    'proyecto_word',
    'solicitud_evaluacion',
    'carta_aprobacion',
    'boleta_pago',
  ];

  async function crearExpedienteEnviable(opts: {
    titulo: string;
    investigadorId: number;
    autores: string[];
    ciclo?: string | null;
    programaEstudios?: string;
    facultad?: string | null;
    estado?: string;
    intentos?: number;
  }) {
    const exp = await prisma.expediente.create({
      data: {
        tituloProtocolo: opts.titulo,
        investigadorId: opts.investigadorId,
        tipoTramite: 'proyecto_nuevo',
        modalidad: 'pregrado',
        programaEstudios: opts.programaEstudios ?? 'Enfermería',
        ciclo: opts.ciclo === undefined ? 'VII' : opts.ciclo,
        facultad: opts.facultad ?? null,
        estado: opts.estado ?? 'borrador',
        intentos: opts.intentos ?? 1,
      },
    });
    expedienteIds.push(exp.id);
    for (let i = 0; i < opts.autores.length; i++) {
      await prisma.autorExpediente.create({
        data: {
          expedienteId: exp.id,
          orden: i + 1,
          apellidosNombres: opts.autores[i],
          codigoEstudiante: `20200${i}${exp.id}`.slice(0, 12),
          correo: `autor${i}@uch.edu.pe`,
          telefono: '999999999',
          esPrincipal: i === 0,
        },
      });
    }
    for (const tipo of DOCS_PREGRADO) {
      await prisma.documento.create({
        data: {
          expedienteId: exp.id,
          nombreArchivo: `${tipo}.pdf`,
          tipoDocumento: tipo,
          rutaArchivo: `uploads/${exp.id}/${tipo}.pdf`,
          esObligatorio: true,
        },
      });
    }
    return exp;
  }

  beforeAll(async () => {
    prisma = new PrismaClient();
    const passwordHash = await bcrypt.hash('password', 12);

    const pregrado = await prisma.user.create({
      data: {
        email: `${marca}.pregrado@uch.edu.pe`,
        passwordHash,
        nombre: 'Pregrado',
        apellido: 'Observaciones',
        rol: 'estudiante_pregrado',
        activo: true,
        codigoEstudiante: '2020501',
      },
    });
    pregradoId = pregrado.id;

    const otro = await prisma.user.create({
      data: {
        email: `${marca}.otro@uch.edu.pe`,
        passwordHash,
        nombre: 'Otro',
        apellido: 'Pregrado',
        rol: 'estudiante_pregrado',
        activo: true,
        codigoEstudiante: '2020502',
      },
    });
    otroPregradoId = otro.id;

    const secretaria = await prisma.user.create({
      data: {
        email: `${marca}.secretaria@uch.edu.pe`,
        passwordHash,
        nombre: 'Secre',
        apellido: 'Observaciones',
        rol: 'secretaria',
        activo: true,
      },
    });
    secretariaId = secretaria.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    // Se limpia por dueño y no solo por `expedienteIds`: un test que falla a
    // mitad puede dejar filas creadas por HTTP sin registrar en el array, y
    // esas filas romperían el DELETE de usuarios por FK.
    const usuarios = [pregradoId, otroPregradoId, secretariaId].filter(Boolean);
    const propios = await prisma.expediente.findMany({
      where: { investigadorId: { in: usuarios } },
      select: { id: true },
    });
    const ids = Array.from(new Set([...expedienteIds, ...propios.map((e) => e.id)]));
    if (ids.length > 0) {
      await prisma.notificacion.deleteMany({ where: { expedienteId: { in: ids } } });
      await prisma.documento.deleteMany({ where: { expedienteId: { in: ids } } });
      await prisma.autorExpediente.deleteMany({ where: { expedienteId: { in: ids } } });
      await prisma.bitacora.deleteMany({ where: { expedienteId: { in: ids } } });
      await prisma.historialExpediente.deleteMany({ where: { expedienteId: { in: ids } } });
      await prisma.expediente.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.notificacion.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  // ==================== OBSERVACIÓN 1: tipoProyecto ====================

  describe('observación 1 — tipoProyecto', () => {
    it('GET /expedientes/catalogos expone los tipos de proyecto y la preselección por ciclo', async () => {
      const resp = await request(app.getHttpServer())
        .get('/expedientes/catalogos')
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);
      expect(resp.status).toBe(200);
      expect(resp.body.tiposProyecto.map((t: any) => t.valor)).toEqual(['ARTICULO', 'TESIS', 'OTRO']);
      expect(resp.body.tipoProyectoPorCiclo).toEqual({ VII: 'ARTICULO', IX: 'TESIS' });
    });

    it('POST /expedientes guarda y devuelve el tipoProyecto enviado', async () => {
      const resp = await request(app.getHttpServer())
        .post('/expedientes')
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
        .send({
          tituloProtocolo: 'Proyecto con tipo TESIS declarado',
          ciclo: 'IX',
          tipoProyecto: 'TESIS',
          autores: [{ apellidosNombres: 'Perez Juan', correo: 'j@uch.edu.pe', telefono: '999' }],
        });
      expect(resp.status).toBe(201);
      expect(resp.body.tipoProyecto).toBe('TESIS');
      expect(resp.body.intentos).toBe(1);
      expedienteIds.push(resp.body.id);
    });

    it('POST /expedientes rechaza un tipoProyecto fuera del catálogo (400)', async () => {
      const resp = await request(app.getHttpServer())
        .post('/expedientes')
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
        .send({ tituloProtocolo: 'Proyecto con tipo invalido', tipoProyecto: 'MONOGRAFIA' });
      expect(resp.status).toBe(400);
    });

    it('PUT /expedientes/{id} permite corregir el tipoProyecto del borrador', async () => {
      const crear = await request(app.getHttpServer())
        .post('/expedientes')
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
        .send({ tituloProtocolo: 'Proyecto a corregir tipo', ciclo: 'VII', tipoProyecto: 'ARTICULO' });
      expect(crear.status).toBe(201);
      expedienteIds.push(crear.body.id);

      const resp = await request(app.getHttpServer())
        .put(`/expedientes/${crear.body.id}`)
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
        .send({ tipoProyecto: 'OTRO' });
      expect(resp.status).toBe(200);
      expect(resp.body.tipoProyecto).toBe('OTRO');
    });
  });

  // ==================== OBSERVACIÓN 3: duplicado exacto ====================

  describe('observación 3 — rechazo automático por duplicado exacto', () => {
    it('al enviar un expediente idéntico a otro activo, queda no_aprobado sin pasar por revisión', async () => {
      const titulo = 'Prevalencia de anemia en gestantes del distrito de Comas 2026';
      const autores = ['Quispe Rojas, Maria', 'Torres Diaz, Luis'];

      const original = await crearExpedienteEnviable({
        titulo,
        investigadorId: pregradoId,
        autores,
        estado: 'en_revision',
      });

      // Mismo título (con distinta capitalización/tildes/espacios), mismos
      // autores en otro orden, mismo ciclo y mismo programa.
      const copia = await crearExpedienteEnviable({
        titulo: '  PREVALENCIA de Anemia en GESTANTES del distrito de Comas 2026 ',
        investigadorId: pregradoId,
        autores: [...autores].reverse(),
      });

      const resp = await request(app.getHttpServer())
        .post(`/expedientes/${copia.id}/enviar`)
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);

      expect(resp.status).toBe(200);
      expect(resp.body.rechazoAutomatico).toBe(true);
      expect(resp.body.duplicadoDeId).toBe(original.id);

      const actualizado = await prisma.expediente.findUnique({ where: { id: copia.id } });
      expect(actualizado?.estado).toBe('no_aprobado');

      const historial = await prisma.historialExpediente.findMany({ where: { expedienteId: copia.id } });
      expect(historial.some((h) => h.estadoNuevo === 'no_aprobado')).toBe(true);
      expect(historial.some((h) => h.estadoNuevo === 'en_revision')).toBe(false);

      // El solicitante queda notificado del rechazo automático.
      const notis = await prisma.notificacion.findMany({ where: { expedienteId: copia.id } });
      expect(notis.some((n) => n.usuarioId === pregradoId)).toBe(true);
    });

    it('un título igual pero con autores distintos NO es duplicado exacto: se envía normal', async () => {
      const titulo = 'Calidad del sueño y rendimiento académico en internos de enfermería';
      await crearExpedienteEnviable({
        titulo,
        investigadorId: pregradoId,
        autores: ['Alfa Uno, Ana'],
        estado: 'en_revision',
      });

      const otro = await crearExpedienteEnviable({
        titulo,
        investigadorId: otroPregradoId,
        autores: ['Beta Dos, Bruno'],
      });

      const resp = await request(app.getHttpServer())
        .post(`/expedientes/${otro.id}/enviar`)
        .set('Authorization', `Bearer ${tokenFor(otroPregradoId)}`);

      expect(resp.status).toBe(200);
      expect(resp.body.rechazoAutomatico).toBeFalsy();
      const actualizado = await prisma.expediente.findUnique({ where: { id: otro.id } });
      expect(actualizado?.estado).toBe('enviado');
    });
  });

  // ==================== OBSERVACIÓN 2: alerta de título similar ====================

  describe('observación 2 — alerta de título similar a Secretaría', () => {
    it('un título muy parecido a uno activo notifica a secretaría pero NO bloquea el envío', async () => {
      await crearExpedienteEnviable({
        titulo: 'Efecto del mindfulness en la ansiedad de estudiantes de enfermeria de una universidad privada',
        investigadorId: pregradoId,
        autores: ['Gamma Tres, Gina'],
        estado: 'en_revision',
      });

      const parecido = await crearExpedienteEnviable({
        titulo: 'Efectos del mindfulness en la ansiedad de estudiantes de enfermeria de una universidad privada',
        investigadorId: otroPregradoId,
        autores: ['Delta Cuatro, Diana'],
      });

      const resp = await request(app.getHttpServer())
        .post(`/expedientes/${parecido.id}/enviar`)
        .set('Authorization', `Bearer ${tokenFor(otroPregradoId)}`);

      // No bloquea: el envío es exitoso y el expediente queda enviado.
      expect(resp.status).toBe(200);
      expect(resp.body.rechazoAutomatico).toBeFalsy();
      expect(resp.body.alertaSimilitud).toBeTruthy();
      const actualizado = await prisma.expediente.findUnique({ where: { id: parecido.id } });
      expect(actualizado?.estado).toBe('enviado');

      // Secretaría recibe la alerta.
      const notis = await prisma.notificacion.findMany({
        where: { expedienteId: parecido.id, usuarioId: secretariaId },
      });
      expect(notis.length).toBeGreaterThan(0);
      expect(notis[0].titulo.toLowerCase()).toContain('similar');

      // Queda traza en el historial del expediente.
      const historial = await prisma.historialExpediente.findMany({ where: { expedienteId: parecido.id } });
      expect(historial.some((h) => (h.observaciones ?? '').toLowerCase().includes('similar'))).toBe(true);
    });

    it('un título sin parecido con ninguno activo no genera alerta a secretaría', async () => {
      const solo = await crearExpedienteEnviable({
        titulo: 'Uso de biomarcadores hepaticos en el tamizaje ocupacional minero altoandino',
        investigadorId: pregradoId,
        autores: ['Epsilon Cinco, Elsa'],
      });

      const resp = await request(app.getHttpServer())
        .post(`/expedientes/${solo.id}/enviar`)
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);

      expect(resp.status).toBe(200);
      expect(resp.body.alertaSimilitud).toBeFalsy();
      const notis = await prisma.notificacion.findMany({
        where: { expedienteId: solo.id, usuarioId: secretariaId },
      });
      expect(notis.length).toBe(0);
    });
  });

  // ==================== OBSERVACIÓN 4: reenvío con tope de 3 ====================

  describe('observación 4 — reenvío de rechazados con tope de 3 intentos', () => {
    it('GET /expedientes/mis-rechazados lista los propios rechazados/observados con sus observaciones', async () => {
      const rechazado = await crearExpedienteEnviable({
        titulo: 'Proyecto rechazado para la vista de rechazados',
        investigadorId: pregradoId,
        autores: ['Zeta Seis, Zoe'],
        estado: 'no_aprobado',
      });
      await prisma.historialExpediente.create({
        data: {
          expedienteId: rechazado.id,
          estadoAnterior: 'en_revision',
          estadoNuevo: 'no_aprobado',
          observaciones: 'Falta el consentimiento informado firmado.',
        },
      });

      const resp = await request(app.getHttpServer())
        .get('/expedientes/mis-rechazados')
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);

      expect(resp.status).toBe(200);
      const fila = resp.body.find((e: any) => e.id === rechazado.id);
      expect(fila).toBeDefined();
      expect(fila.intentos).toBe(1);
      expect(fila.intentosMaximos).toBe(3);
      expect(fila.puedeReenviar).toBe(true);
      expect(fila.observaciones.some((o: any) => o.texto.includes('consentimiento informado'))).toBe(true);
    });

    it('mis-rechazados NO incluye expedientes de otros usuarios ni aprobados', async () => {
      const ajeno = await crearExpedienteEnviable({
        titulo: 'Rechazado de otro usuario',
        investigadorId: otroPregradoId,
        autores: ['Ajeno Uno, Aldo'],
        estado: 'no_aprobado',
      });
      const aprobado = await crearExpedienteEnviable({
        titulo: 'Aprobado con observaciones no reenviable',
        investigadorId: pregradoId,
        autores: ['Aprob Ado, Ana'],
        estado: 'aprobado_observaciones',
      });

      const resp = await request(app.getHttpServer())
        .get('/expedientes/mis-rechazados')
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);

      expect(resp.status).toBe(200);
      expect(resp.body.some((e: any) => e.id === ajeno.id)).toBe(false);
      expect(resp.body.some((e: any) => e.id === aprobado.id)).toBe(false);
    });

    it('reenviar incrementa intentos y devuelve el expediente a la cola; al 3.º queda bloqueado', async () => {
      const exp = await crearExpedienteEnviable({
        titulo: 'Proyecto que agota sus tres intentos de reenvio',
        investigadorId: pregradoId,
        autores: ['Omega Siete, Omar'],
        estado: 'no_aprobado',
      });

      // 1.er reenvío: intentos 1 -> 2.
      const r1 = await request(app.getHttpServer())
        .post(`/expedientes/${exp.id}/reenviar`)
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
        .send({ observaciones: 'Se levantó la observación del consentimiento.' });
      expect(r1.status).toBe(200);
      expect(r1.body.intentos).toBe(2);
      expect(r1.body.estado).toBe('enviado');

      // Rechazado otra vez por el Comité.
      await prisma.expediente.update({ where: { id: exp.id }, data: { estado: 'no_aprobado' } });

      // 2.º reenvío: intentos 2 -> 3 (último permitido).
      const r2 = await request(app.getHttpServer())
        .post(`/expedientes/${exp.id}/reenviar`)
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
        .send({ observaciones: 'Se corrigió la metodología.' });
      expect(r2.status).toBe(200);
      expect(r2.body.intentos).toBe(3);

      // Rechazado por tercera vez: ya no puede reenviar.
      await prisma.expediente.update({ where: { id: exp.id }, data: { estado: 'no_aprobado' } });

      const listado = await request(app.getHttpServer())
        .get('/expedientes/mis-rechazados')
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);
      const fila = listado.body.find((e: any) => e.id === exp.id);
      expect(fila.puedeReenviar).toBe(false);
      expect(fila.motivoBloqueo).toBeTruthy();

      const r3 = await request(app.getHttpServer())
        .post(`/expedientes/${exp.id}/reenviar`)
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
        .send({ observaciones: 'Tercer intento, no debería pasar.' });
      expect(r3.status).toBe(400);

      const final = await prisma.expediente.findUnique({ where: { id: exp.id } });
      expect(final?.estado).toBe('no_aprobado');
      expect(final?.intentos).toBe(3);
    });

    it('no se puede reenviar un expediente de otro usuario (403)', async () => {
      const ajeno = await crearExpedienteEnviable({
        titulo: 'Rechazado ajeno que no se puede reenviar',
        investigadorId: otroPregradoId,
        autores: ['Ajeno Dos, Bea'],
        estado: 'no_aprobado',
      });

      const resp = await request(app.getHttpServer())
        .post(`/expedientes/${ajeno.id}/reenviar`)
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
        .send({ observaciones: 'Intento indebido.' });
      expect(resp.status).toBe(403);
    });

    it('no se puede reenviar un expediente que no está rechazado ni observado (400)', async () => {
      const enviado = await crearExpedienteEnviable({
        titulo: 'Proyecto en revision que no admite reenvio',
        investigadorId: pregradoId,
        autores: ['Enrev Ision, Eva'],
        estado: 'en_revision',
      });

      const resp = await request(app.getHttpServer())
        .post(`/expedientes/${enviado.id}/reenviar`)
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
        .send({ observaciones: 'No corresponde.' });
      expect(resp.status).toBe(400);
    });

    it('la subsanación también consume un intento (misma lógica de reenvío)', async () => {
      const exp = await crearExpedienteEnviable({
        titulo: 'Proyecto en subsanacion que consume intento',
        investigadorId: pregradoId,
        autores: ['Subsa Nacion, Sara'],
        estado: 'subsanacion',
      });

      const resp = await request(app.getHttpServer())
        .post(`/expedientes/${exp.id}/subsanacion`)
        .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
        .send({ observaciones: 'Se levantaron las observaciones de secretaría.' });

      expect(resp.status).toBe(201);
      expect(resp.body.estado).toBe('enviado');
      const actualizado = await prisma.expediente.findUnique({ where: { id: exp.id } });
      expect(actualizado?.intentos).toBe(2);
    });
  });
});
