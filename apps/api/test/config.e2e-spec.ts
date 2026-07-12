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
// test/users.e2e-spec.ts / test/auth.e2e-spec.ts.
loadEnv({ path: path.join(__dirname, '..', '.env.test'), override: true });

const { AppModule } = require('../src/app.module') as {
  AppModule: typeof AppModuleType;
};

const CLAVE_FECHA_LIMITE = 'fecha_limite_envio';

// NOTA sobre aislamiento: a diferencia de otras tablas (User, Expediente...),
// `configuracion` es un singleton GLOBAL por clave (no se puede filtrar por
// una `marca` única de este archivo). Los tests que necesitan una fecha
// límite vencida/vigente la fijan y la restauran a `null` en un
// try/finally alrededor de la MISMA petición que la usa (ventana mínima),
// para no interferir con otros archivos e2e (p.ej. el "flujo completo" de
// expedientes.e2e-spec.ts) que también llaman a `enviar()`. Además, un
// `afterAll` la deja en `null` como red de seguridad.
async function limpiarFechaLimite(prisma: PrismaClient) {
  await prisma.configuracion.deleteMany({ where: { clave: CLAVE_FECHA_LIMITE } });
}

describe('Config (e2e, contra el schema "test" aislado, no producción)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;

  const marca = `e2e.config.${Date.now()}`;
  let adminId: number;
  let investigadorId: number;

  const expedienteIds: number[] = [];

  const tokenFor = (id: number) => jwt.sign({ sub: String(id) });

  // Crea un expediente "interno" (rol investigador) completo -- mismo patrón
  // que el flujo de expedientes.e2e-spec.ts:414 ("flujo completo: crear
  // (interno)..."): un solo documento obligatorio (proyecto_pdf) para la
  // modalidad interno.
  async function crearExpedienteInternoCompleto(): Promise<number> {
    const exp = await prisma.expediente.create({
      data: {
        tituloProtocolo: 'Proyecto interno para test de fecha límite',
        investigadorId,
        tipoTramite: 'proyecto_nuevo',
        modalidad: 'interno',
        estado: 'borrador',
        programaEstudios: 'Enfermería',
      },
    });
    expedienteIds.push(exp.id);
    await prisma.autorExpediente.create({
      data: {
        expedienteId: exp.id,
        apellidosNombres: 'Investigador Interno',
        correo: `${marca}.autor@uch.edu.pe`,
        telefono: '999999999',
        esPrincipal: true,
      },
    });
    await prisma.documento.create({
      data: {
        expedienteId: exp.id,
        nombreArchivo: 'proyecto.pdf',
        tipoDocumento: 'proyecto_pdf',
        esObligatorio: true,
      },
    });
    return exp.id;
  }

  // Crea un expediente de tipo cambio_titulo, completo, directo por Prisma
  // (se salta el flujo real de elegibilidad de POST /expedientes/cambio-titulo
  // -- fuera del alcance de este test -- para poder probar puntualmente que
  // `enviar()` SALTA el chequeo de fecha límite quando `tipoTramite ===
  // 'cambio_titulo'`, igual que el Python de referencia).
  async function crearCambioTituloCompleto(): Promise<number> {
    const exp = await prisma.expediente.create({
      data: {
        tituloProtocolo: 'Cambio de título (no aplica, ver tituloAnterior/tituloNuevo)',
        investigadorId,
        tipoTramite: 'cambio_titulo',
        estado: 'borrador',
        numeroActa: '123-2026',
        programaEstudios: 'Enfermería',
        ciclo: 'VIII',
        tituloAnterior: 'Título viejo',
        tituloNuevo: 'Título nuevo',
      },
    });
    expedienteIds.push(exp.id);
    await prisma.autorExpediente.create({
      data: {
        expedienteId: exp.id,
        apellidosNombres: 'Investigador Interno',
        codigoEstudiante: '2020001',
        correo: `${marca}.cambio@uch.edu.pe`,
        esPrincipal: true,
      },
    });
    await prisma.documento.create({
      data: {
        expedienteId: exp.id,
        nombreArchivo: 'solicitud.pdf',
        tipoDocumento: 'solicitud_cambio_titulo',
        esObligatorio: true,
      },
    });
    return exp.id;
  }

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

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    jwt = moduleRef.get(JwtService);

    // Estado inicial limpio, por si una corrida anterior falló a mitad de
    // camino y dejó la clave configurada.
    await limpiarFechaLimite(prisma);
  });

  afterAll(async () => {
    await limpiarFechaLimite(prisma); // red de seguridad final
    if (expedienteIds.length > 0) {
      await prisma.documento.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.autorExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.bitacora.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.historialExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.expediente.deleteMany({ where: { id: { in: expedienteIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  // ==================== GET /config/fecha-limite ====================
  it('GET /config/fecha-limite es accesible para cualquier usuario autenticado y arranca en null', async () => {
    const resp = await request(app.getHttpServer())
      .get('/config/fecha-limite')
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
    expect(resp.status).toBe(200);
    expect(resp.body).toEqual({ fechaLimite: null });
  });

  // ==================== PUT /config/fecha-limite -- solo administrador ====================
  it('PUT /config/fecha-limite solo lo puede hacer el administrador', async () => {
    const rechazo = await request(app.getHttpServer())
      .put('/config/fecha-limite')
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`)
      .send({ fechaLimite: '2099-12-31T23:59:59Z' });
    expect(rechazo.status).toBe(403);

    // Confirma que el intento ajeno no dejó nada configurado.
    const lectura = await request(app.getHttpServer())
      .get('/config/fecha-limite')
      .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
    expect(lectura.body).toEqual({ fechaLimite: null });

    try {
      const okAdmin = await request(app.getHttpServer())
        .put('/config/fecha-limite')
        .set('Authorization', `Bearer ${tokenFor(adminId)}`)
        .send({ fechaLimite: '2099-12-31T23:59:59Z' });
      expect(okAdmin.status).toBe(200);
      expect(okAdmin.body).toEqual({ fechaLimite: '2099-12-31T23:59:59Z' });

      const lecturaTrasSet = await request(app.getHttpServer())
        .get('/config/fecha-limite')
        .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
      expect(lecturaTrasSet.body).toEqual({ fechaLimite: '2099-12-31T23:59:59Z' });
    } finally {
      await limpiarFechaLimite(prisma);
    }
  });

  it('PUT /config/fecha-limite con una cadena no-fecha responde 400 y no guarda nada', async () => {
    const resp = await request(app.getHttpServer())
      .put('/config/fecha-limite')
      .set('Authorization', `Bearer ${tokenFor(adminId)}`)
      .send({ fechaLimite: 'esto-no-es-una-fecha' });
    expect(resp.status).toBe(400);

    const lectura = await request(app.getHttpServer())
      .get('/config/fecha-limite')
      .set('Authorization', `Bearer ${tokenFor(adminId)}`);
    expect(lectura.body).toEqual({ fechaLimite: null });
  });

  it('PUT /config/fecha-limite con fechaLimite=null quita el límite configurado', async () => {
    try {
      await request(app.getHttpServer())
        .put('/config/fecha-limite')
        .set('Authorization', `Bearer ${tokenFor(adminId)}`)
        .send({ fechaLimite: '2099-01-01T00:00:00Z' });

      const quitar = await request(app.getHttpServer())
        .put('/config/fecha-limite')
        .set('Authorization', `Bearer ${tokenFor(adminId)}`)
        .send({ fechaLimite: null });
      expect(quitar.status).toBe(200);
      expect(quitar.body).toEqual({ fechaLimite: null });
    } finally {
      await limpiarFechaLimite(prisma);
    }
  });

  // ==================== Wiring del chequeo de fecha límite en enviar() ====================
  // Equivalente a lo verificado en producción hoy (2026-07-04) con una fecha
  // límite real de 2026-12-25.
  describe('POST /expedientes/{id}/enviar respeta la fecha límite global (routes.py:407-420)', () => {
    it('bloquea el envio de un expediente si la fecha limite ya vencio (403)', async () => {
      const id = await crearExpedienteInternoCompleto();

      // Confirma primero que, SIN fecha límite, el expediente está en
      // condiciones de enviarse (para aislar que un eventual 403 más abajo
      // es por la fecha límite y no por incompletitud).
      const requisitos = await request(app.getHttpServer())
        .get(`/expedientes/${id}/requisitos`)
        .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
      expect(requisitos.body.completo).toBe(true);

      try {
        await request(app.getHttpServer())
          .put('/config/fecha-limite')
          .set('Authorization', `Bearer ${tokenFor(adminId)}`)
          .send({ fechaLimite: '2020-01-01T00:00:00Z' }); // vencida

        const resp = await request(app.getHttpServer())
          .post(`/expedientes/${id}/enviar`)
          .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
        expect(resp.status).toBe(403);
        expect(resp.body.message).toContain('fecha límite ya venció');

        // El expediente NO quedó enviado (sigue en borrador).
        const detalle = await request(app.getHttpServer())
          .get(`/expedientes/${id}`)
          .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
        expect(detalle.body.estado).toBe('borrador');
      } finally {
        await limpiarFechaLimite(prisma);
      }
    });

    it('permite enviar si la fecha limite esta en el futuro (avanza hasta el chequeo de completitud)', async () => {
      const id = await crearExpedienteInternoCompleto();

      try {
        await request(app.getHttpServer())
          .put('/config/fecha-limite')
          .set('Authorization', `Bearer ${tokenFor(adminId)}`)
          .send({ fechaLimite: '2099-12-31T23:59:59Z' }); // vigente

        const resp = await request(app.getHttpServer())
          .post(`/expedientes/${id}/enviar`)
          .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
        expect(resp.status).toBe(200);
        expect(resp.body.message).toBe('Expediente enviado exitosamente');
      } finally {
        await limpiarFechaLimite(prisma);
      }
    });

    it('permite enviar si no hay fecha limite configurada (unset)', async () => {
      const id = await crearExpedienteInternoCompleto();
      await limpiarFechaLimite(prisma); // asegura estado "sin configurar"

      const resp = await request(app.getHttpServer())
        .post(`/expedientes/${id}/enviar`)
        .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
      expect(resp.status).toBe(200);
      expect(resp.body.message).toBe('Expediente enviado exitosamente');
    });

    it('cambio_titulo IGNORA la fecha límite aunque ya haya vencido', async () => {
      const id = await crearCambioTituloCompleto();

      try {
        await request(app.getHttpServer())
          .put('/config/fecha-limite')
          .set('Authorization', `Bearer ${tokenFor(adminId)}`)
          .send({ fechaLimite: '2020-01-01T00:00:00Z' }); // vencida

        const resp = await request(app.getHttpServer())
          .post(`/expedientes/${id}/enviar`)
          .set('Authorization', `Bearer ${tokenFor(investigadorId)}`);
        // No debe ser el 403 de fecha límite (puede ser 200 si el expediente
        // quedó completo, pero NUNCA el mensaje de fecha límite vencida).
        if (resp.status === 403) {
          expect(resp.body.message).not.toContain('fecha límite');
        } else {
          expect(resp.status).toBe(200);
        }
      } finally {
        await limpiarFechaLimite(prisma);
      }
    });
  });
});
