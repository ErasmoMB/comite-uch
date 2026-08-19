import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { StorageService } from '../storage/storage.service';
import { EmailService, EmailAttachment } from '../email/email.service';
import { actualizarEstado } from '../expedientes/expedientes.service';
import {
  CRITERIOS_MAX_POR_KEY,
  CRITERIOS_RUBRICA,
  PUNTAJE_TOTAL_MAX,
  resultadoPorPuntaje,
} from './rubrica';
import { CreateEvaluacionDto } from './dto/create-evaluacion.dto';
import { UpdateEvaluacionDto } from './dto/update-evaluacion.dto';
import { AsignarEvaluadorDto } from './dto/asignar-evaluador.dto';

// Actor autenticado tal como lo deja `JwtStrategy.validate()` en
// `request.user` (mismo tipo que en ExpedientesService/UsersService).
type CurrentUser = { id: number; email: string; rol: string };

const ROLES_COORDINACION = ['administrador', 'coordinador'];

// Roles internos del comité: ven todos los expedientes (mismo criterio que
// `ExpedientesService.ROLES_VEN_TODO`).
const ROLES_VEN_TODO = ['administrador', 'coordinador', 'secretaria'];

// Forma completa de una evaluación con relaciones, tal como se necesita para
// construir la respuesta (equivalente a los `joinedload` de routes.py).
const INCLUDE_COMPLETO = {
  expediente: { include: { investigador: true } },
  criterios: true,
} satisfies Prisma.EvaluacionInclude;

type EvaluacionCompleta = Prisma.EvaluacionGetPayload<{ include: typeof INCLUDE_COMPLETO }>;

@Injectable()
export class EvaluacionService {
  private readonly logger = new Logger(EvaluacionService.name);

  constructor(
    private prisma: PrismaService,
    private pdf: PdfService,
    private storage: StorageService,
    private email: EmailService,
  ) {}

  // Forma de respuesta equivalente a `EvaluacionResponse`
  // (comite/backend/app/schemas/__init__.py:196-215). Los campos
  // `titulo_protocolo`/`investigador_nombre`/`rubrica_pdf_url`/
  // `dictamen_pdf_url` son @property en el modelo Python
  // (models/__init__.py:329-359) derivados del expediente asociado; aquí se
  // calculan igual a mano al armar la respuesta.
  private toResponse(ev: EvaluacionCompleta) {
    const investigadorNombre = ev.expediente?.investigador
      ? `${ev.expediente.investigador.nombre} ${ev.expediente.investigador.apellido}`.trim()
      : null;

    return {
      id: ev.id,
      expedienteId: ev.expedienteId,
      evaluadorId: ev.evaluadorId,
      recommendation: ev.recommendation,
      observaciones: ev.observaciones,
      completa: ev.completa ?? false,
      conflictoInteres: ev.conflictoInteres ?? false,
      tituloProtocolo: ev.expediente?.tituloProtocolo ?? null,
      investigadorNombre,
      expedienteFechaEnvio: ev.expediente?.fechaEnvio ?? null,
      criterios: ev.criterios.map((c) => ({
        criterioKey: c.criterioKey,
        puntaje: c.puntaje,
        observacion: c.observacion,
      })),
      puntajeTotal: ev.puntajeTotal,
      resultado: ev.resultado,
      rubricaPdfUrl: ev.rubricaPdfPath,
      dictamenPdfUrl: ev.dictamenPdfPath,
      createdAt: ev.fechaAsignacion,
    };
  }

  // GET /evaluacion/rubrica (routes.py:85-91).
  getRubrica() {
    return {
      criterios: CRITERIOS_RUBRICA,
      puntajeTotalMax: PUNTAJE_TOTAL_MAX,
      umbrales: { aprobado: '17-20', aprobado_observaciones: '13-16', no_aprobado: '0-12' },
    };
  }

  // GET /evaluacion/ (routes.py:93-97). Un evaluador solo ve las suyas; el
  // resto de roles ven todas.
  async findAll(user: CurrentUser, skip = 0, limit = 50) {
    const where = user.rol === 'evaluador' ? { evaluadorId: user.id } : {};
    const evaluaciones = await this.prisma.evaluacion.findMany({
      where,
      skip,
      take: limit,
      include: INCLUDE_COMPLETO,
    });
    return evaluaciones.map((e) => this.toResponse(e));
  }

  // GET /evaluacion/mis-evaluaciones (routes.py:99-103).
  async findMisEvaluaciones(user: CurrentUser) {
    if (user.rol !== 'evaluador') {
      throw new ForbiddenException('Solo evaluadores');
    }
    const evaluaciones = await this.prisma.evaluacion.findMany({
      where: { evaluadorId: user.id },
      include: INCLUDE_COMPLETO,
    });
    return evaluaciones.map((e) => this.toResponse(e));
  }

  private async getOrThrow(id: number): Promise<EvaluacionCompleta> {
    const ev = await this.prisma.evaluacion.findUnique({ where: { id }, include: INCLUDE_COMPLETO });
    if (!ev) {
      throw new NotFoundException('Evaluación no encontrada');
    }
    return ev;
  }

  // GET /evaluacion/{id} (routes.py:105-110). Sin chequeo de dueño/rol
  // adicional -- se porta 1:1 el mismo comportamiento del Python real.
  async findOne(id: number) {
    return this.toResponse(await this.getOrThrow(id));
  }

  // POST /evaluacion/ (routes.py:112-128). REGLA DURA: 1 solo evaluador por
  // expediente -- rechaza si YA existe cualquier evaluación (de cualquier
  // evaluador) para ese expediente.
  async create(dto: CreateEvaluacionDto, user: CurrentUser) {
    if (!ROLES_COORDINACION.includes(user.rol)) {
      throw new ForbiddenException('Solo coordinadores pueden crear evaluaciones');
    }
    const exp = await this.prisma.expediente.findUnique({ where: { id: dto.expedienteId } });
    if (!exp) {
      throw new NotFoundException('Expediente no encontrado');
    }
    const existentes = await this.prisma.evaluacion.count({ where: { expedienteId: dto.expedienteId } });
    if (existentes >= 1) {
      throw new BadRequestException('Este expediente ya tiene un evaluador asignado');
    }

    // Autoasignación: quien crea la evaluación queda como evaluador (igual
    // que Python: `Evaluacion(expediente_id=..., evaluador_id=current_user.id)`).
    const nueva = await this.prisma.evaluacion.create({
      data: { expedienteId: dto.expedienteId, evaluadorId: user.id },
    });
    return this.findOne(nueva.id);
  }

  // POST /evaluacion/expediente/{id}/asignar (routes.py:341-412). Segundo
  // punto de la REGLA DURA de 1 solo evaluador por expediente.
  async asignar(expedienteId: number, dto: AsignarEvaluadorDto, user: CurrentUser) {
    if (!ROLES_COORDINACION.includes(user.rol)) {
      throw new ForbiddenException('Solo coordinadores pueden asignar evaluadores');
    }
    const exp = await this.prisma.expediente.findUnique({ where: { id: expedienteId } });
    if (!exp) {
      throw new NotFoundException('Expediente no encontrado');
    }
    const evaluador = await this.prisma.user.findUnique({ where: { id: dto.evaluadorId } });
    if (!evaluador) {
      throw new NotFoundException('Evaluador no encontrado');
    }
    if (evaluador.rol !== 'evaluador') {
      throw new BadRequestException('El usuario no tiene rol de evaluador');
    }
    if (!evaluador.activo) {
      throw new BadRequestException('El evaluador no está activo');
    }

    const evaluacionExistente = await this.prisma.evaluacion.findFirst({
      where: { expedienteId, evaluadorId: dto.evaluadorId },
    });
    if (evaluacionExistente) {
      throw new BadRequestException('Este evaluador ya está asignado a este expediente');
    }

    // Un solo evaluador por expediente (modelo de evaluación única con
    // rúbrica) -- REGLA DURA, sin excepciones.
    const evaluadoresActuales = await this.prisma.evaluacion.count({ where: { expedienteId } });
    if (evaluadoresActuales >= 1) {
      throw new BadRequestException('Este expediente ya tiene un evaluador asignado');
    }

    const nuevaEvaluacion = await this.prisma.$transaction(async (tx) => {
      const nueva = await tx.evaluacion.create({
        data: { expedienteId, evaluadorId: dto.evaluadorId, fechaAsignacion: new Date() },
      });
      await tx.notificacion.create({
        data: {
          usuarioId: dto.evaluadorId,
          expedienteId,
          titulo: 'Nueva evaluación asignada',
          mensaje: `Se te ha asignado la evaluación del expediente: ${exp.codigoUnico} - ${exp.tituloProtocolo}`,
        },
      });
      return nueva;
    });

    return {
      message: 'Evaluador asignado exitosamente',
      evaluacionId: nuevaEvaluacion.id,
      evaluador: { id: evaluador.id, nombre: evaluador.nombre, apellido: evaluador.apellido },
      expedienteCodigo: exp.codigoUnico,
    };
  }

  // PUT /evaluacion/{id} (routes.py:130-259) -- el endpoint central del
  // módulo.
  async update(id: number, dto: UpdateEvaluacionDto, user: CurrentUser) {
    const ev = await this.getOrThrow(id);
    if (ev.evaluadorId !== user.id && user.rol !== 'administrador') {
      throw new ForbiddenException('No puedes modificar esta evaluación');
    }

    // Valida rango por criterio ANTES de escribir nada (igual que Python:
    // primero valida los 7, recién después hace `criterios.clear()` +
    // reinsertar) -- routes.py:147-156.
    if (dto.criterios !== undefined) {
      for (const c of dto.criterios) {
        const maximo = CRITERIOS_MAX_POR_KEY[c.key];
        if (maximo === undefined) {
          throw new BadRequestException(`Criterio desconocido: ${c.key}`);
        }
        if (c.puntaje < 0 || c.puntaje > maximo) {
          throw new BadRequestException(`Puntaje de '${c.key}' debe estar entre 0 y ${maximo}`);
        }
      }
    }

    // Criterios "finales" (los que quedarán tras este PUT): si el request
    // trae `criterios`, reemplazan a los existentes (upsert = borrar todo +
    // reinsertar, igual que Python); si no, se conservan los que ya había.
    const criteriosFinales =
      dto.criterios !== undefined
        ? dto.criterios.map((c) => ({ criterioKey: c.key, puntaje: c.puntaje, observacion: c.observacion ?? null }))
        : ev.criterios.map((c) => ({ criterioKey: c.criterioKey, puntaje: c.puntaje, observacion: c.observacion }));

    let seCompleto = false;
    let resultadoCalculado: string | null = null;
    let totalCalculado: number | null = null;

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.EvaluacionUpdateInput = {};
      if (dto.recommendation !== undefined) data.recommendation = dto.recommendation;
      if (dto.observaciones !== undefined) data.observaciones = dto.observaciones;

      if (dto.criterios !== undefined) {
        await tx.evaluacionCriterio.deleteMany({ where: { evaluacionId: id } });
        if (dto.criterios.length > 0) {
          await tx.evaluacionCriterio.createMany({
            data: dto.criterios.map((c) => ({
              evaluacionId: id,
              criterioKey: c.key,
              puntaje: c.puntaje,
              observacion: c.observacion ?? null,
            })),
          });
        }
      }

      if (dto.completa !== undefined) {
        data.completa = dto.completa;
        if (dto.completa) {
          const keysPresentes = new Set(criteriosFinales.map((c) => c.criterioKey));
          const keysRequeridas = new Set(Object.keys(CRITERIOS_MAX_POR_KEY));
          const mismasKeys =
            keysPresentes.size === keysRequeridas.size &&
            [...keysRequeridas].every((k) => keysPresentes.has(k));
          if (!mismasKeys) {
            throw new BadRequestException('Faltan criterios por evaluar (se requieren los 7)');
          }
          totalCalculado = criteriosFinales.reduce((acc, c) => acc + c.puntaje, 0);
          resultadoCalculado = resultadoPorPuntaje(totalCalculado);
          data.puntajeTotal = totalCalculado;
          data.resultado = resultadoCalculado;
          data.fechaEnvio = new Date();
          seCompleto = true;
        }
      }

      if (Object.keys(data).length > 0) {
        await tx.evaluacion.update({ where: { id }, data });
      }

      // Transiciona el estado del expediente atómicamente con lo anterior.
      // DIVERGENCIA INTENCIONAL respecto a Python: el Python de referencia
      // (routes.py:168-169) hace `evaluacion.expediente.estado =
      // evaluacion.resultado` a pelo, SIN pasar por `actualizar_estado` --
      // no deja registro en `historial_expediente` para esta transición. La
      // Task 8 pide explícitamente reutilizar
      // `ExpedientesService.actualizarEstado` (misma función que ya usan
      // enviar/subsanación), así que aquí SÍ queda historial de esta
      // transición. Se documenta como mejora deliberada, no como bug de
      // paridad.
      if (seCompleto && ev.expediente && resultadoCalculado) {
        await actualizarEstado(
          tx,
          ev.expediente,
          resultadoCalculado,
          `Evaluación completada por el comité (puntaje: ${totalCalculado}/${PUNTAJE_TOTAL_MAX})`,
        );
      }
    });

    let evActualizada = await this.getOrThrow(id);

    // --- Post-envío: generar PDFs según el resultado ---
    // Igual que Python (routes.py:175-257): esto ocurre DESPUÉS de haber
    // confirmado (commit) el puntaje/resultado, en un bloque best-effort
    // separado -- si la generación de PDF falla, la evaluación ya completada
    // NO se revierte, solo se loguea el error (mismo criterio que el
    // `except Exception` + `print(...)` de Python).
    const yaFueEnviada = Boolean(evActualizada.completa) && Boolean(evActualizada.resultado);
    if (yaFueEnviada) {
      try {
        await this.generarPdfsPostEnvio(evActualizada);
        evActualizada = await this.getOrThrow(id);

        // Email a los autores notificando el resultado (routes.py:195-252).
        // Propio try/catch: un fallo enviando el correo NO debe tumbar esta
        // respuesta (misma regla que la generación de PDFs, ver catch de
        // abajo), y tampoco debe impedir que ya se hayan generado/persistido
        // los PDFs correspondientes.
        try {
          await this.enviarEmailResultado(evActualizada);
        } catch (emailErr) {
          this.logger.error(
            `Error enviando email post-evaluacion (evaluacionId=${id}): ${(emailErr as Error).stack ?? emailErr}`,
          );
        }
      } catch (err) {
        // Igual que Python (`except Exception as e: print(...)`): un fallo
        // generando PDFs no debe tumbar la respuesta -- la evaluación ya
        // quedó completa y con su resultado calculado.
        this.logger.error(`Error en post-evaluacion (evaluacionId=${id}): ${(err as Error).stack ?? err}`);
      }
    }

    return this.toResponse(evActualizada);
  }

  // Genera los PDFs de la evaluación y persiste sus paths en el registro.
  //
  // El Python de referencia (routes.py:179-191) condicionaba la rúbrica al
  // resultado (solo `aprobado_observaciones`/`no_aprobado`) y el dictamen a
  // los aprobados. Eso producía un bug observado: con resultado `aprobado`
  // nunca existía rúbrica, pero la pantalla del evaluador ofrece el botón
  // "Descargar rúbrica" siempre -> 404 -> "No se pudo descargar el archivo".
  // Además la rúbrica ES el formato oficial de evaluación del Comité (la
  // tabla de criterios con el puntaje asignado), así que corresponde
  // emitirla en TODOS los casos, apruebe o no. El dictamen sí sigue siendo
  // solo para los aprobados: es el acta de aprobación.
  private async generarPdfsPostEnvio(ev: EvaluacionCompleta): Promise<void> {
    const data: Prisma.EvaluacionUpdateInput = {};

    const rubricaPath = await this.generarPdfRubrica(ev);
    if (rubricaPath) {
      data.rubricaPdfPath = rubricaPath;
    }

    if (ev.resultado === 'aprobado' || ev.resultado === 'aprobado_observaciones') {
      const dictamenPath = await this.generarPdfDictamen(ev);
      if (dictamenPath) {
        data.dictamenPdfPath = dictamenPath;
      }
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.evaluacion.update({ where: { id: ev.id }, data });
    }
  }

  // Equivalente al bloque de envío de email de routes.py:195-252. Destinatarios:
  // correos de los autores del expediente (ordenados por `orden`), filtrando
  // los vacíos; si ninguno tiene correo, se usa como fallback el email del
  // investigador dueño del expediente.
  private async enviarEmailResultado(ev: EvaluacionCompleta): Promise<void> {
    const expediente = ev.expediente;
    if (!expediente) return;

    const autores = await this.prisma.autorExpediente.findMany({
      where: { expedienteId: expediente.id },
      orderBy: { orden: 'asc' },
    });

    let destinatarios = autores
      .map((a) => a.correo)
      .filter((correo): correo is string => Boolean(correo));
    if (destinatarios.length === 0 && expediente.investigador?.email) {
      destinatarios = [expediente.investigador.email];
    }
    if (destinatarios.length === 0) {
      return;
    }

    const resultadoLabel: Record<string, string> = {
      aprobado: 'Aprobado',
      aprobado_observaciones: 'Aprobado con observaciones',
      no_aprobado: 'No aprobado',
    };
    const label = resultadoLabel[ev.resultado ?? ''] ?? (ev.resultado ?? '');

    // La rúbrica (formato oficial de evaluación) va siempre; el dictamen solo
    // cuando el proyecto quedó aprobado. Ver `generarPdfsPostEnvio`.
    const notaAdjunto =
      ev.resultado === 'no_aprobado'
        ? 'Adjunto encontrará la rúbrica de evaluación.'
        : 'Adjunto encontrará la rúbrica de evaluación y el dictamen correspondiente.';

    const subject = `Resultado de evaluación - ${expediente.codigoUnico ?? ''}`;
    const body =
      `Estimado(a) investigador(a),\n\n` +
      `Se ha completado la evaluación ética de su proyecto:\n` +
      `  Título: ${expediente.tituloProtocolo}\n` +
      `  Código: ${expediente.codigoUnico ?? ''}\n` +
      `  Resultado: ${label}\n` +
      `  Puntaje: ${ev.puntajeTotal}/${PUNTAJE_TOTAL_MAX}\n\n` +
      `${notaAdjunto}\n\n` +
      `Saludos cordiales,\nComité de Ética en Investigación`;

    const attachments = await this.recolectarAdjuntosPdf(ev);

    await this.email.enviarEmail({ to: destinatarios, subject, body, attachments });
  }

  // Descarga los PDFs generados (rúbrica y/o dictamen) como adjuntos para el
  // email. Hoy tanto `rubricaPdfPath` como `dictamenPdfPath` son keys propias
  // del bucket, y se traen con `StorageService.getObjectBuffer`. Se conserva la
  // rama "http" porque registros antiguos podrían guardar todavía un presigned
  // URL completo (así se persistía el dictamen antes; ver PdfService.generarDictamen).
  private async recolectarAdjuntosPdf(ev: EvaluacionCompleta): Promise<EmailAttachment[]> {
    const adjuntos: EmailAttachment[] = [];

    if (ev.rubricaPdfPath) {
      const buffer = ev.rubricaPdfPath.startsWith('http')
        ? await this.descargarPdfDeUrl(ev.rubricaPdfPath)
        : await this.storage.getObjectBuffer(ev.rubricaPdfPath);
      adjuntos.push({ filename: `rubrica_evaluacion_${ev.id}.pdf`, content: buffer });
    }

    if (ev.dictamenPdfPath) {
      const buffer = ev.dictamenPdfPath.startsWith('http')
        ? await this.descargarPdfDeUrl(ev.dictamenPdfPath)
        : await this.storage.getObjectBuffer(ev.dictamenPdfPath);
      adjuntos.push({ filename: `dictamen_evaluacion_${ev.id}.pdf`, content: buffer });
    }

    return adjuntos;
  }

  private async descargarPdfDeUrl(url: string): Promise<Buffer> {
    const resp = await fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Equivalente a `_generar_pdf_para_evaluacion` (routes.py:52-82).
  private async generarPdfRubrica(ev: EvaluacionCompleta): Promise<string | null> {
    const expediente = ev.expediente;
    if (!expediente) return null;

    const evaluador = await this.prisma.user.findUnique({ where: { id: ev.evaluadorId } });
    const autores = await this.prisma.autorExpediente.findMany({
      where: { expedienteId: ev.expedienteId },
      orderBy: { orden: 'asc' },
    });

    const puntajePorKey = new Map(ev.criterios.map((c) => [c.criterioKey, c]));
    const criteriosConPuntajes = CRITERIOS_RUBRICA.map((c) => {
      const match = puntajePorKey.get(c.key);
      return {
        nombre: c.nombre,
        descripcion: c.descripcion,
        puntajeMax: c.puntajeMax,
        puntaje: match?.puntaje ?? 0,
        observacion: match?.observacion ?? null,
      };
    });

    const autorStr =
      autores.length > 0
        ? autores.map((a) => a.apellidosNombres).join(', ')
        : (expediente.investigador ? `${expediente.investigador.nombre} ${expediente.investigador.apellido}`.trim() : '');

    const evaluadorNombre = evaluador ? `${evaluador.nombre} ${evaluador.apellido}`.trim() : '';

    const ahora = new Date();
    const fechaStr = `${String(ahora.getDate()).padStart(2, '0')}/${String(ahora.getMonth() + 1).padStart(2, '0')}/${ahora.getFullYear()} ${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

    return this.pdf.generarEvaluacionCompleta({
      evaluacionId: ev.id,
      codigoUnico: expediente.codigoUnico,
      tituloProtocolo: expediente.tituloProtocolo,
      autorStr,
      evaluadorNombre,
      fechaStr,
      criterios: criteriosConPuntajes,
      puntajeTotal: ev.puntajeTotal ?? 0,
      puntajeMaximo: PUNTAJE_TOTAL_MAX,
      observaciones: ev.observaciones,
      resultado: ev.resultado,
    });
  }

  // Equivalente a `_generar_dictamen_para_evaluacion` (routes.py:18-49), pero
  // maquetado sobre la plantilla oficial del Comité (ver PdfService): el
  // dictamen ya no es un párrafo suelto, lleva el mismo encabezado, la misma
  // tabla de datos generales y el mismo bloque de casillas que el formato en
  // Word que usa el Comité en papel.
  private async generarPdfDictamen(ev: EvaluacionCompleta): Promise<string | null> {
    const expediente = ev.expediente;
    if (!expediente) return null;

    const evaluador = await this.prisma.user.findUnique({ where: { id: ev.evaluadorId } });
    const autores = await this.prisma.autorExpediente.findMany({
      where: { expedienteId: ev.expedienteId },
      orderBy: { orden: 'asc' },
    });

    const numero = `DIC-${(expediente.codigoUnico ?? String(expediente.id)).replace(/\//g, '-')}`;
    const ahora = new Date();
    const fecha = `${String(ahora.getDate()).padStart(2, '0')}/${String(ahora.getMonth() + 1).padStart(2, '0')}/${ahora.getFullYear()}`;

    // Mismo criterio que la rúbrica: manda la lista de autores del
    // expediente y solo si está vacía se cae al dueño de la cuenta.
    const investigadorNombre =
      autores.length > 0
        ? autores.map((a) => a.apellidosNombres).join(', ')
        : expediente.investigador
          ? `${expediente.investigador.nombre} ${expediente.investigador.apellido}`.trim()
          : '';

    return this.pdf.generarDictamen({
      numeroDictamen: numero,
      codigoUnico: expediente.codigoUnico,
      titulo: expediente.tituloProtocolo ?? '',
      investigadorNombre,
      evaluadorNombre: evaluador ? `${evaluador.nombre} ${evaluador.apellido}`.trim() : '',
      fecha,
      puntajeTotal: ev.puntajeTotal ?? 0,
      puntajeMaximo: PUNTAJE_TOTAL_MAX,
      observaciones: ev.observaciones,
      resultado: ev.resultado,
    });
  }

  // GET /evaluacion/{id}/descargar-rubrica y /descargar-dictamen
  // (routes.py:261-314). Ambos comparten la misma lógica: hoy los dos paths
  // son keys propias del bucket, así que se trae el objeto y se sirve. Se
  // mantiene la rama "http" (REDIRIGIR) solo por compatibilidad con registros
  // antiguos que hayan quedado con un presigned URL completo guardado.
  private async resolverDescarga(
    path: string | null,
    mensajeNoGenerado: string,
    nombreArchivo: string,
  ): Promise<{ redirectUrl: string } | { buffer: Buffer; contentType: string; nombreArchivo: string }> {
    if (!path) {
      throw new NotFoundException(mensajeNoGenerado);
    }
    if (path.startsWith('http')) {
      return { redirectUrl: path };
    }
    let buffer: Buffer;
    try {
      buffer = await this.storage.getObjectBuffer(path);
    } catch {
      throw new NotFoundException('El archivo no está disponible en el almacenamiento.');
    }
    return { buffer, contentType: 'application/pdf', nombreArchivo };
  }

  // Estos PDFs llevan el nombre del autor, el título del proyecto y el juicio
  // ético del comité, así que NO pueden quedar accesibles a cualquier usuario
  // autenticado (antes bastaba con iterar ids para leer la evaluación de otro
  // estudiante). Pueden descargarlos: el evaluador asignado, el dueño del
  // expediente -- que es justamente quien necesita su propio dictamen -- y los
  // roles internos, que de todos modos ya ven todos los expedientes.
  private assertAccesoDescarga(ev: EvaluacionCompleta, user: CurrentUser) {
    if (ROLES_VEN_TODO.includes(user.rol)) return;
    if (ev.evaluadorId === user.id) return;
    if (ev.expediente?.investigadorId === user.id) return;
    throw new ForbiddenException('No tienes acceso a esta evaluación');
  }

  async descargarRubrica(id: number, user: CurrentUser) {
    const ev = await this.getOrThrow(id);
    this.assertAccesoDescarga(ev, user);
    return this.resolverDescarga(
      ev.rubricaPdfPath,
      'La rúbrica PDF aún no ha sido generada. Debes enviar la evaluación primero.',
      `rubrica_evaluacion_${id}.pdf`,
    );
  }

  async descargarDictamen(id: number, user: CurrentUser) {
    const ev = await this.getOrThrow(id);
    this.assertAccesoDescarga(ev, user);
    return this.resolverDescarga(
      ev.dictamenPdfPath,
      'El dictamen PDF aún no ha sido generado. Solo se genera para evaluaciones aprobadas.',
      `dictamen_evaluacion_${id}.pdf`,
    );
  }

  // POST /evaluacion/{id}/conflicto (routes.py:317-326).
  async declararConflicto(id: number, user: CurrentUser) {
    const ev = await this.prisma.evaluacion.findUnique({ where: { id } });
    if (!ev) {
      throw new NotFoundException('Evaluación no encontrada');
    }
    if (ev.evaluadorId !== user.id) {
      throw new ForbiddenException('No puedes declarar conflicto por otro evaluador');
    }
    await this.prisma.evaluacion.update({ where: { id }, data: { conflictoInteres: true } });
    return { message: 'Conflicto de interés declarado' };
  }

  // POST /evaluacion/{id}/guardar-parcial (routes.py:328-338).
  async guardarParcial(id: number, dto: UpdateEvaluacionDto, user: CurrentUser) {
    const ev = await this.prisma.evaluacion.findUnique({ where: { id } });
    if (!ev) {
      throw new NotFoundException('Evaluación no encontrada');
    }
    if (ev.evaluadorId !== user.id) {
      throw new ForbiddenException('No tienes acceso');
    }
    if (dto.observaciones !== undefined) {
      await this.prisma.evaluacion.update({ where: { id }, data: { observaciones: dto.observaciones } });
    }
    return { message: 'Guardado parcial exitoso' };
  }
}
