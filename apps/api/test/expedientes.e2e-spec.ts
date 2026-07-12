import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { AppModule as AppModuleType } from '../src/app.module';
import { validarCompletitud } from '../src/expedientes/expedientes.service';

describe('validarCompletitud', () => {
  it('un expediente pregrado sin documentos ni autores devuelve todos los faltantes', () => {
    const faltantes = validarCompletitud({
      tipoTramite: 'proyecto_nuevo',
      modalidad: 'pregrado',
      tituloProtocolo: null,
      programaEstudios: null,
      ciclo: null,
      nivelPosgrado: null,
      autores: [],
      documentos: [],
    } as any);
    expect(faltantes).toContain('Título del proyecto');
    expect(faltantes.some((f) => f.includes('Documento'))).toBe(true);
  });

  it('un expediente pregrado completo (todo presente) no tiene faltantes', () => {
    const faltantes = validarCompletitud({
      tipoTramite: 'proyecto_nuevo',
      modalidad: 'pregrado',
      tituloProtocolo: 'Mi proyecto',
      programaEstudios: 'Enfermería',
      ciclo: 'VIII',
      nivelPosgrado: null,
      autores: [
        {
          apellidosNombres: 'Perez Juan',
          correo: 'juan@uch.edu.pe',
          telefono: '999999999',
          codigoEstudiante: '2020001',
        },
      ],
      documentos: [
        { tipoDocumento: 'proyecto_pdf' },
        { tipoDocumento: 'proyecto_word' },
        { tipoDocumento: 'solicitud_evaluacion' },
        { tipoDocumento: 'carta_aprobacion' },
        { tipoDocumento: 'boleta_pago' },
      ],
    } as any);
    expect(faltantes).toEqual([]);
  });

  it('interno no exige código de estudiante al autor, pero pregrado/postgrado sí', () => {
    const base = {
      tipoTramite: 'proyecto_nuevo',
      tituloProtocolo: 'X',
      programaEstudios: 'Enfermería',
      ciclo: null,
      nivelPosgrado: null,
      documentos: [{ tipoDocumento: 'proyecto_pdf' }],
    };
    const autorSinCodigo = [{ apellidosNombres: 'A', correo: 'a@x.com', telefono: '1' }];

    const internoFaltantes = validarCompletitud({
      ...base,
      modalidad: 'interno',
      autores: autorSinCodigo,
    } as any);
    expect(internoFaltantes.some((f) => f.includes('código de estudiante'))).toBe(false);

    const pregradoFaltantes = validarCompletitud({
      ...base,
      modalidad: 'pregrado',
      ciclo: 'VIII',
      autores: autorSinCodigo,
    } as any);
    expect(pregradoFaltantes.some((f) => f.includes('código de estudiante'))).toBe(true);
  });

  // Rama distinta en Python (routes.py:56-82): el cambio de título valida un
  // conjunto de campos totalmente distinto al de un proyecto nuevo (numero_acta,
  // titulo_anterior, titulo_nuevo en vez de titulo_protocolo/ciclo/nivel_posgrado
  // condicionados por modalidad), y solo exige el documento
  // `solicitud_cambio_titulo` (no la lista completa de DOCUMENTOS_REQUERIDOS de
  // la modalidad).
  describe('rama cambio_titulo', () => {
    it('sin numero_acta/titulos/autores/documento, devuelve los faltantes propios del cambio de título', () => {
      const faltantes = validarCompletitud({
        tipoTramite: 'cambio_titulo',
        modalidad: 'pregrado',
        numeroActa: null,
        programaEstudios: null,
        ciclo: null,
        tituloAnterior: null,
        tituloNuevo: null,
        autores: [],
        documentos: [],
      } as any);
      expect(faltantes).toContain('N° de acta');
      expect(faltantes).toContain('Programa de estudios');
      expect(faltantes).toContain('Ciclo');
      expect(faltantes).toContain('Título antiguo (original)');
      expect(faltantes).toContain('Nuevo título');
      expect(faltantes).toContain('Al menos un integrante');
      expect(faltantes).toContain('Documento: Solicitud de cambio de título (PDF)');
      // La rama cambio_titulo NO exige título del proyecto/nivel de posgrado
      // (esos son campos de la rama proyecto_nuevo).
      expect(faltantes).not.toContain('Título del proyecto');
    });

    it('un cambio de título completo no tiene faltantes', () => {
      const faltantes = validarCompletitud({
        tipoTramite: 'cambio_titulo',
        modalidad: 'pregrado',
        numeroActa: '1',
        programaEstudios: 'Enfermería',
        ciclo: 'Egresado',
        tituloAnterior: 'Título viejo',
        tituloNuevo: 'Título nuevo',
        autores: [
          { apellidosNombres: 'Perez Juan', codigoEstudiante: '2020001', correo: 'juan@uch.edu.pe' },
        ],
        documentos: [{ tipoDocumento: 'solicitud_cambio_titulo' }],
      } as any);
      expect(faltantes).toEqual([]);
    });

    it('integrante de cambio_titulo sin código de estudiante SÍ falta (a diferencia de la rama interno de proyecto_nuevo)', () => {
      const faltantes = validarCompletitud({
        tipoTramite: 'cambio_titulo',
        modalidad: 'interno',
        numeroActa: '1',
        programaEstudios: 'Enfermería',
        ciclo: 'Egresado',
        tituloAnterior: 'Título viejo',
        tituloNuevo: 'Título nuevo',
        autores: [{ apellidosNombres: 'Perez Juan', correo: 'juan@uch.edu.pe' }],
        documentos: [{ tipoDocumento: 'solicitud_cambio_titulo' }],
      } as any);
      expect(faltantes.some((f) => f.includes('código de estudiante'))).toBe(true);
    });
  });
});

// Redirige DATABASE_URL/SECRET_KEY al schema Postgres "test" (aislado de
// producción) ANTES de cargar AppModule. Mismo patrón que
// test/auth.e2e-spec.ts / test/users.e2e-spec.ts.
loadEnv({ path: path.join(__dirname, '..', '.env.test'), override: true });

const { AppModule } = require('../src/app.module') as {
  AppModule: typeof AppModuleType;
};

describe('ExpedientesController (e2e, contra el schema "test" aislado, no producción)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;

  const marca = `e2e.expedientes.${Date.now()}`;
  let pregradoId: number;
  let otroPregradoId: number;
  let internoId: number;
  let adminId: number;

  const expedienteIds: number[] = [];

  const tokenFor = (id: number) => jwt.sign({ sub: String(id) });

  beforeAll(async () => {
    prisma = new PrismaClient();
    const passwordHash = await bcrypt.hash('password', 12);

    const pregrado = await prisma.user.create({
      data: {
        email: `${marca}.pregrado@uch.edu.pe`,
        passwordHash,
        nombre: 'Pregrado',
        apellido: 'Test',
        rol: 'estudiante_pregrado',
        activo: true,
        codigoEstudiante: '2020001',
      },
    });
    pregradoId = pregrado.id;

    const otroPregrado = await prisma.user.create({
      data: {
        email: `${marca}.otro-pregrado@uch.edu.pe`,
        passwordHash,
        nombre: 'Otro',
        apellido: 'Pregrado',
        rol: 'estudiante_pregrado',
        activo: true,
        codigoEstudiante: '2020002',
      },
    });
    otroPregradoId = otroPregrado.id;

    const interno = await prisma.user.create({
      data: {
        email: `${marca}.interno@uch.edu.pe`,
        passwordHash,
        nombre: 'Investigador',
        apellido: 'Interno',
        rol: 'investigador',
        activo: true,
        laboratorio: 'Lab X',
      },
    });
    internoId = interno.id;

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

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    // Orden de borrado: dependencias de expediente primero, luego los
    // expedientes con proyectoOrigenId apuntando a otro (cambio de título)
    // antes que su origen, y por último los usuarios. Mismo orden que
    // ExpedientesService.remove().
    if (expedienteIds.length > 0) {
      await prisma.documento.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.autorExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.bitacora.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.historialExpediente.deleteMany({ where: { expedienteId: { in: expedienteIds } } });
      await prisma.expediente.deleteMany({ where: { proyectoOrigenId: { in: expedienteIds } } });
      await prisma.expediente.deleteMany({ where: { id: { in: expedienteIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /expedientes/catalogos deriva la modalidad del rol de sesión', async () => {
    const resp = await request(app.getHttpServer())
      .get('/expedientes/catalogos')
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);
    expect(resp.status).toBe(200);
    expect(resp.body.modalidad).toBe('pregrado');
    expect(resp.body.programasEstudios).toContain('Enfermería');
    expect(resp.body.cambioTitulo.ciclos).toContain('Egresado');
  });

  it('GET /expedientes/catalogos para un rol interno (admin) devuelve modalidad null', async () => {
    const resp = await request(app.getHttpServer())
      .get('/expedientes/catalogos')
      .set('Authorization', `Bearer ${tokenFor(adminId)}`);
    expect(resp.status).toBe(200);
    expect(resp.body.modalidad).toBeNull();
  });

  it('POST /expedientes deriva la modalidad del rol e IGNORA cualquier modalidad enviada por el cliente', async () => {
    const resp = await request(app.getHttpServer())
      .post('/expedientes')
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
      .send({
        tituloProtocolo: 'Proyecto de prueba NEST-VERIFY',
        modalidad: 'postgrado', // debe ser ignorado por completo
        autores: [{ apellidosNombres: 'Perez Juan', codigoEstudiante: '2020001', correo: 'juan@uch.edu.pe', telefono: '999999999' }],
      });
    expect(resp.status).toBe(201);
    expect(resp.body.estado).toBe('borrador');
    expect(resp.body.modalidad).toBe('pregrado');
    expect(resp.body.codigoUnico).toBeNull();
    expedienteIds.push(resp.body.id);
  });

  it('un rol interno sin modalidad asociada (admin) NO puede crear expedientes (403)', async () => {
    const resp = await request(app.getHttpServer())
      .post('/expedientes')
      .set('Authorization', `Bearer ${tokenFor(adminId)}`)
      .send({ tituloProtocolo: 'No debería crearse' });
    expect(resp.status).toBe(403);
  });

  it('GET /expedientes/{id}/requisitos devuelve los faltantes de un borrador incompleto', async () => {
    const id = expedienteIds[0];
    const resp = await request(app.getHttpServer())
      .get(`/expedientes/${id}/requisitos`)
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);
    expect(resp.status).toBe(200);
    expect(resp.body.completo).toBe(false);
    expect(resp.body.faltantes.length).toBeGreaterThan(0);
    expect(resp.body.documentosRequeridos.length).toBeGreaterThan(0);
  });

  it('otro investigador NO puede ver el expediente ajeno (403), pero el admin sí', async () => {
    const id = expedienteIds[0];
    const ajeno = await request(app.getHttpServer())
      .get(`/expedientes/${id}`)
      .set('Authorization', `Bearer ${tokenFor(otroPregradoId)}`);
    expect(ajeno.status).toBe(403);

    const comoAdmin = await request(app.getHttpServer())
      .get(`/expedientes/${id}`)
      .set('Authorization', `Bearer ${tokenFor(adminId)}`);
    expect(comoAdmin.status).toBe(200);
  });

  it('el dueño puede editar su expediente mientras está en Borrador', async () => {
    const id = expedienteIds[0];
    const resp = await request(app.getHttpServer())
      .put(`/expedientes/${id}`)
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
      .send({ tituloProtocolo: 'Título actualizado' });
    expect(resp.status).toBe(200);
    expect(resp.body.tituloProtocolo).toBe('Título actualizado');
  });

  // FIX DE SEGURIDAD (divergencia intencional y autorizada respecto a
  // Python, ver comentario sobre `ExpedientesService.update` en
  // expedientes.service.ts): el `update_expediente` de referencia
  // (routes.py:357-375) NO valida dueño mientras el expediente está en
  // BORRADOR, así que cualquier otro usuario autenticado podía editar (e
  // incluso forzar el `estado` de) un borrador ajeno. Este test prueba que
  // ese hueco ya NO existe en NestJS.
  it('otro solicitante NO puede editar un expediente ajeno en Borrador (403), aunque el dueño sí puede', async () => {
    const id = expedienteIds[0];

    const ajeno = await request(app.getHttpServer())
      .put(`/expedientes/${id}`)
      .set('Authorization', `Bearer ${tokenFor(otroPregradoId)}`)
      .send({ tituloProtocolo: 'Intento de edición ajena', estado: 'aprobado' });
    expect(ajeno.status).toBe(403);

    // Confirma que el intento ajeno no alteró nada (ni título ni estado).
    const tras = await request(app.getHttpServer())
      .get(`/expedientes/${id}`)
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);
    expect(tras.body.tituloProtocolo).not.toBe('Intento de edición ajena');
    expect(tras.body.estado).toBe('borrador');

    // El dueño real conserva su capacidad de editar su propio borrador.
    const propio = await request(app.getHttpServer())
      .put(`/expedientes/${id}`)
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
      .send({ tituloProtocolo: 'Edición legítima del dueño' });
    expect(propio.status).toBe(200);
    expect(propio.body.tituloProtocolo).toBe('Edición legítima del dueño');
  });

  it('GET /expedientes lista solo lo propio para un rol externo, y todo para un rol interno', async () => {
    const propio = await request(app.getHttpServer())
      .get('/expedientes')
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);
    expect(propio.status).toBe(200);
    expect(propio.body.every((e: any) => e.investigadorId === pregradoId)).toBe(true);

    const todo = await request(app.getHttpServer())
      .get('/expedientes')
      .set('Authorization', `Bearer ${tokenFor(adminId)}`);
    expect(todo.status).toBe(200);
    expect(todo.body.some((e: any) => e.id === expedienteIds[0])).toBe(true);
  });

  it('DELETE de un expediente en Borrador por su dueño funciona; luego ya no existe (404)', async () => {
    const creado = await request(app.getHttpServer())
      .post('/expedientes')
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
      .send({ tituloProtocolo: 'Para borrar' });
    expect(creado.status).toBe(201);
    const id = creado.body.id;

    const del = await request(app.getHttpServer())
      .delete(`/expedientes/${id}`)
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ message: 'Proyecto eliminado' });

    const getRes = await request(app.getHttpServer())
      .get(`/expedientes/${id}`)
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);
    expect(getRes.status).toBe(404);
  });

  it('otro usuario NO puede eliminar un expediente ajeno (403)', async () => {
    const id = expedienteIds[0];
    const resp = await request(app.getHttpServer())
      .delete(`/expedientes/${id}`)
      .set('Authorization', `Bearer ${tokenFor(otroPregradoId)}`);
    expect(resp.status).toBe(403);
  });

  it('POST /expedientes/{id}/enviar con faltantes responde 400 con el detalle de lo que falta', async () => {
    const id = expedienteIds[0];
    const resp = await request(app.getHttpServer())
      .post(`/expedientes/${id}/enviar`)
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);
    expect(resp.status).toBe(400);
    // `new BadRequestException({ mensaje, faltantes })` con un objeto (no un
    // string) como payload: Nest usa ese objeto TAL CUAL como cuerpo de la
    // respuesta (no lo envuelve bajo `message`), igual que FastAPI con
    // `detail={"mensaje": ..., "faltantes": [...]}`.
    expect(resp.body.faltantes.length).toBeGreaterThan(0);
    expect(resp.body.mensaje).toContain('incompleto');
  });

  it('flujo completo: crear (interno), completar documentos/autor, enviar -> código real N-AÑO asignado', async () => {
    const creado = await request(app.getHttpServer())
      .post('/expedientes')
      .set('Authorization', `Bearer ${tokenFor(internoId)}`)
      .send({
        tituloProtocolo: 'Proyecto interno completo',
        programaEstudios: 'Enfermería',
        autores: [{ apellidosNombres: 'Investigador Interno', correo: 'interno@uch.edu.pe', telefono: '999999999' }],
      });
    expect(creado.status).toBe(201);
    const id = creado.body.id;
    expedienteIds.push(id);

    // El documento requerido de la modalidad "interno" (solo proyecto_pdf) se
    // inserta directamente por Prisma: la subida real de documentos es Task 7
    // (fuera del alcance de esta tarea), pero validarCompletitud/enviar sí
    // deben poder operar sobre expedientes que ya tienen documentos.
    await prisma.documento.create({
      data: {
        expedienteId: id,
        nombreArchivo: 'proyecto.pdf',
        tipoDocumento: 'proyecto_pdf',
        esObligatorio: true,
      },
    });

    const requisitos = await request(app.getHttpServer())
      .get(`/expedientes/${id}/requisitos`)
      .set('Authorization', `Bearer ${tokenFor(internoId)}`);
    expect(requisitos.body.completo).toBe(true);

    const enviar = await request(app.getHttpServer())
      .post(`/expedientes/${id}/enviar`)
      .set('Authorization', `Bearer ${tokenFor(internoId)}`);
    expect(enviar.status).toBe(200); // forzado a 200 (paridad con FastAPI, ver ExpedientesController.enviar)
    expect(enviar.body.message).toBe('Expediente enviado exitosamente');
    expect(enviar.body.codigo).toMatch(/^\d+-\d{4}$/);

    const detalle = await request(app.getHttpServer())
      .get(`/expedientes/${id}`)
      .set('Authorization', `Bearer ${tokenFor(internoId)}`);
    expect(detalle.body.estado).toBe('enviado');
    expect(detalle.body.codigoUnico).toBe(enviar.body.codigo);

    // Enviar dos veces seguidas falla (ya no está en Borrador).
    const segundoEnvio = await request(app.getHttpServer())
      .post(`/expedientes/${id}/enviar`)
      .set('Authorization', `Bearer ${tokenFor(internoId)}`);
    expect(segundoEnvio.status).toBe(400);

    // El dueño ya no puede editar un expediente enviado.
    const putRes = await request(app.getHttpServer())
      .put(`/expedientes/${id}`)
      .set('Authorization', `Bearer ${tokenFor(internoId)}`)
      .send({ tituloProtocolo: 'Intento de edición' });
    expect(putRes.status).toBe(403);

    // Tampoco puede eliminarlo (ya no está en Borrador).
    const delRes = await request(app.getHttpServer())
      .delete(`/expedientes/${id}`)
      .set('Authorization', `Bearer ${tokenFor(internoId)}`);
    expect(delRes.status).toBe(400);

    const historial = await request(app.getHttpServer())
      .get(`/expedientes/${id}/historial`)
      .set('Authorization', `Bearer ${tokenFor(internoId)}`);
    expect(historial.status).toBe(200);
    expect(
      historial.body.some((h: any) => h.estadoAnterior === 'borrador' && h.estadoNuevo === 'enviado'),
    ).toBe(true);

    const bitacora = await request(app.getHttpServer())
      .get(`/expedientes/${id}/bitacora`)
      .set('Authorization', `Bearer ${tokenFor(internoId)}`);
    expect(bitacora.status).toBe(200);
    expect(bitacora.body.some((b: any) => b.accion === 'Expediente enviado formalmente')).toBe(true);

    // Paridad con Python (routes.py:437-440): la respuesta solo trae
    // {id, accion, detalle, created_at} -- nada de expedienteId/usuarioId.
    const item = bitacora.body[0];
    expect(Object.keys(item).sort()).toEqual(['accion', 'createdAt', 'detalle', 'id'].sort());
    expect(item).not.toHaveProperty('expedienteId');
    expect(item).not.toHaveProperty('usuarioId');
  }, 20000);

  it('flujo cambio de título: solo sobre un proyecto propio ya aprobado, con numero_acta derivado del código de origen', async () => {
    // El proyecto origen se inserta directo por Prisma ya "aprobado" (la
    // evaluación real es la Task 8, fuera de esta tarea).
    const origen = await prisma.expediente.create({
      data: {
        tituloProtocolo: 'Proyecto original aprobado',
        investigadorId: pregradoId,
        tipoTramite: 'proyecto_nuevo',
        modalidad: 'pregrado',
        estado: 'aprobado',
        codigoUnico: '7-2025',
      },
    });
    expedienteIds.push(origen.id);

    const rechazoOtro = await request(app.getHttpServer())
      .post('/expedientes/cambio-titulo')
      .set('Authorization', `Bearer ${tokenFor(otroPregradoId)}`)
      .send({
        proyectoOrigenId: origen.id,
        programaEstudios: 'Enfermería',
        ciclo: 'Egresado',
        tituloNuevo: 'Nuevo título robado',
      });
    expect(rechazoOtro.status).toBe(404);

    const creado = await request(app.getHttpServer())
      .post('/expedientes/cambio-titulo')
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
      .send({
        proyectoOrigenId: origen.id,
        programaEstudios: 'Enfermería',
        ciclo: 'Egresado',
        tituloNuevo: 'Título corregido',
        autores: [{ apellidosNombres: 'Perez Juan', codigoEstudiante: '2020001', correo: 'juan@uch.edu.pe' }],
      });
    expect(creado.status).toBe(201);
    expect(creado.body.tipoTramite).toBe('cambio_titulo');
    expect(creado.body.numeroActa).toBe('7');
    expect(creado.body.tituloAnterior).toBe('Proyecto original aprobado');
    expect(creado.body.tituloNuevo).toBe('Título corregido');
    expedienteIds.push(creado.body.id);

    const elegibles = await request(app.getHttpServer())
      .get('/expedientes/elegibles-cambio-titulo')
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);
    expect(elegibles.status).toBe(200);
    expect(elegibles.body.some((p: any) => p.id === origen.id)).toBe(true);
    // El propio cambio de título recién creado NO debe aparecer como elegible
    // (tipo_tramite === 'cambio_titulo' está excluido en la consulta).
    expect(elegibles.body.some((p: any) => p.id === creado.body.id)).toBe(false);
  }, 20000);

  // Equivalente de comite/backend/tests/test_cambio_titulo_regla.py::test_elegibles_solo_aprobados
  // y ::test_cambio_titulo_rechaza_no_aprobado. El test anterior solo probaba
  // la inclusión positiva (estado "aprobado"); aquí se prueba explícitamente
  // que "enviado" y "no_aprobado" quedan excluidos de elegibles-cambio-titulo,
  // y que cambio-titulo sobre un origen no aprobado devuelve 400.
  it('elegibles-cambio-titulo excluye estados enviado/no_aprobado; cambio-titulo sobre un origen no aprobado da 400', async () => {
    const enviado = await prisma.expediente.create({
      data: {
        tituloProtocolo: 'Proyecto enviado (no elegible)',
        investigadorId: pregradoId,
        tipoTramite: 'proyecto_nuevo',
        modalidad: 'pregrado',
        estado: 'enviado',
        codigoUnico: '8-2025',
      },
    });
    expedienteIds.push(enviado.id);

    const noAprobado = await prisma.expediente.create({
      data: {
        tituloProtocolo: 'Proyecto no aprobado (no elegible)',
        investigadorId: pregradoId,
        tipoTramite: 'proyecto_nuevo',
        modalidad: 'pregrado',
        estado: 'no_aprobado',
        codigoUnico: '9-2025',
      },
    });
    expedienteIds.push(noAprobado.id);

    const elegibles = await request(app.getHttpServer())
      .get('/expedientes/elegibles-cambio-titulo')
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`);
    expect(elegibles.status).toBe(200);
    expect(elegibles.body.some((p: any) => p.id === enviado.id)).toBe(false);
    expect(elegibles.body.some((p: any) => p.id === noAprobado.id)).toBe(false);

    const rechazado = await request(app.getHttpServer())
      .post('/expedientes/cambio-titulo')
      .set('Authorization', `Bearer ${tokenFor(pregradoId)}`)
      .send({
        proyectoOrigenId: enviado.id,
        programaEstudios: 'Enfermería',
        ciclo: 'Egresado',
        tituloNuevo: 'Intento sobre proyecto no aprobado',
        autores: [{ apellidosNombres: 'Perez Juan', codigoEstudiante: '2020001', correo: 'juan@uch.edu.pe' }],
      });
    expect(rechazado.status).toBe(400);
  }, 20000);
});
