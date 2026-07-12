import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';

// Mismas etiquetas/colores que client/src/lib/mappers.ts (ESTADO_LABEL) y
// client/src/pages/Reportes.tsx (ESTADO_COLOR) -- el PDF debe verse
// consistente con los gráficos que el admin ya ve en pantalla.
const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  en_revision: 'En revisión',
  subsanacion: 'Subsanación',
  aprobado: 'Aprobado',
  aprobado_observaciones: 'Aprobado c/ observ.',
  no_aprobado: 'No aprobado',
  archivado: 'Archivado',
};
const ESTADO_COLOR: Record<string, string> = {
  borrador: '#98a2b3',
  enviado: '#0b57b7',
  en_revision: '#6941c6',
  subsanacion: '#b54708',
  aprobado: '#067647',
  aprobado_observaciones: '#b54708',
  no_aprobado: '#d92d20',
  archivado: '#98a2b3',
};

// Equivalente 1:1 a comite/backend/app/api/reportes/routes.py -- YA con los 2
// bugs corregidos hoy (2026-07-04) en el Python de referencia incorporados
// desde el principio (no se porta la versión vieja/rota):
//   1. `evaluador.nombre` (nuestro modelo User de Prisma nunca tuvo el typo
//      `nombres`, así que no aplica introducirlo aquí).
//   2. `/resultados-emitidos` y la sección "resultados" de `/resumen` leen
//      `Evaluacion.resultado` (filtrado `completa=true`) -- NO existe un
//      modelo `Dictamen` en este schema Prisma (nunca existió).
const TIPOS_RESULTADO_VALIDOS = ['aprobado', 'aprobado_observaciones', 'no_aprobado'];

function estadoOSinEstado(estado: string | null): string {
  return estado ?? 'sin estado';
}

@Injectable()
export class ReportesService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {}

  // GET /reportes/expedientes-por-estado (routes.py:17-25).
  async expedientesPorEstado() {
    const total = await this.prisma.expediente.count();
    const grupos = await this.prisma.expediente.groupBy({
      by: ['estado'],
      _count: { id: true },
    });
    const porEstado: Record<string, number> = {};
    for (const g of grupos) {
      porEstado[estadoOSinEstado(g.estado)] = g._count.id;
    }
    return { total, porEstado };
  }

  // GET /reportes/tiempos-atencion (routes.py:27-40).
  async tiemposAtencion() {
    const expedientes = await this.prisma.expediente.findMany({
      where: { fechaEnvio: { not: null } },
    });
    const datos: { expedienteId: number; codigo: string | null; dias: number; estado: string }[] = [];
    for (const exp of expedientes) {
      if (exp.fechaEnvio && exp.fechaCreacion) {
        const dias = Math.floor(
          (exp.fechaEnvio.getTime() - exp.fechaCreacion.getTime()) / 86_400_000,
        );
        datos.push({
          expedienteId: exp.id,
          codigo: exp.codigoUnico,
          dias,
          estado: exp.estado ?? 'desconocido',
        });
      }
    }
    return datos;
  }

  // GET /reportes/carga-evaluadores (routes.py:42-62). El Python envuelve
  // todo en try/except y devuelve [] ante cualquier error -- se replica igual
  // aquí para mantener paridad de comportamiento defensivo.
  async cargaEvaluadores() {
    try {
      const grupos = await this.prisma.evaluacion.groupBy({
        by: ['evaluadorId'],
        _count: { id: true },
      });

      const datos: { evaluadorId: number; nombre: string | null; totalEvaluaciones: number }[] = [];
      for (const g of grupos) {
        const evaluador = await this.prisma.user.findUnique({ where: { id: g.evaluadorId } });
        datos.push({
          evaluadorId: g.evaluadorId,
          nombre: evaluador ? evaluador.nombre : null,
          totalEvaluaciones: g._count.id,
        });
      }
      return datos;
    } catch (e) {
      console.error(`Error en carga_evaluadores: ${(e as Error).message}`);
      return [];
    }
  }

  // GET /reportes/resultados-emitidos (routes.py:64-89, YA CORREGIDO: sobre
  // Evaluacion.resultado, no Dictamen). Reporta evaluaciones completas,
  // agrupadas por tipo de resultado (aprobado, aprobado_observaciones,
  // no_aprobado).
  async resultadosEmitidos() {
    const grupos = await this.prisma.evaluacion.groupBy({
      by: ['resultado'],
      where: {
        completa: true,
        resultado: { in: TIPOS_RESULTADO_VALIDOS },
      },
      _count: { id: true },
    });

    const datos: { tipo: string; total: number }[] = [];
    for (const g of grupos) {
      const tipo = g.resultado ?? 'sin tipo';
      if (!TIPOS_RESULTADO_VALIDOS.includes(tipo.toLowerCase())) {
        continue;
      }
      datos.push({ tipo, total: g._count.id });
    }
    return datos;
  }

  // GET /reportes/buscar-expedientes (routes.py:91-106).
  async buscarExpedientes(estado?: string, fechaInicio?: string, fechaFin?: string) {
    const where: Record<string, unknown> = {};
    if (estado) {
      where.estado = estado;
    }
    const fechaCreacion: Record<string, Date> = {};
    if (fechaInicio) {
      fechaCreacion.gte = new Date(fechaInicio);
    }
    if (fechaFin) {
      fechaCreacion.lte = new Date(fechaFin);
    }
    if (Object.keys(fechaCreacion).length > 0) {
      where.fechaCreacion = fechaCreacion;
    }
    return this.prisma.expediente.findMany({ where });
  }

  // GET /reportes/resumen (routes.py:108-197). El acceso por rol
  // (administrador/coordinador/secretaria) lo hace RolesGuard +
  // @Roles(...) en el controller. El Python envuelve todo en try/except y
  // devuelve un reporte vacío (no un 500) ante cualquier error -- se replica
  // igual aquí.
  async resumen() {
    try {
      const totalExpedientes = await this.prisma.expediente.count();
      const porEstadoQuery = await this.prisma.expediente.groupBy({
        by: ['estado'],
        _count: { id: true },
      });
      const porEstado: Record<string, number> = {};
      for (const g of porEstadoQuery) {
        porEstado[estadoOSinEstado(g.estado)] = g._count.id;
      }

      const totalEvaluadores = await this.prisma.user.count({ where: { rol: 'evaluador' } });

      const cargaPorEvaluador = await this.prisma.evaluacion.groupBy({
        by: ['evaluadorId'],
        _count: { id: true },
      });
      const cargas = cargaPorEvaluador.map((g) => g._count.id);
      const cargaPromedio = cargas.length > 0 ? cargas.reduce((a, b) => a + b, 0) / cargas.length : 0.0;
      const cargaMaxima = cargas.length > 0 ? Math.max(...cargas) : 0;

      const tiempos: { expedienteId: number; codigo: string | null; dias: number; estado: string }[] = [];
      const expedientesEnviados = await this.prisma.expediente.findMany({
        where: { fechaEnvio: { not: null } },
      });
      for (const exp of expedientesEnviados) {
        if (exp.fechaEnvio && exp.fechaCreacion) {
          const dias = Math.floor(
            (exp.fechaEnvio.getTime() - exp.fechaCreacion.getTime()) / 86_400_000,
          );
          tiempos.push({
            expedienteId: exp.id,
            codigo: exp.codigoUnico,
            dias,
            estado: exp.estado ?? 'desconocido',
          });
        }
      }

      const cargaEvaluadores: { evaluadorId: number; nombre: string | null; totalEvaluaciones: number }[] = [];
      for (const g of cargaPorEvaluador) {
        const evaluador = await this.prisma.user.findUnique({ where: { id: g.evaluadorId } });
        cargaEvaluadores.push({
          evaluadorId: g.evaluadorId,
          nombre: evaluador ? evaluador.nombre : null,
          totalEvaluaciones: g._count.id,
        });
      }

      // Resultados emitidos (routes.py:159-173, YA CORREGIDO: sobre
      // Evaluacion.resultado). A diferencia de /resultados-emitidos, esta
      // sección de /resumen NO filtra por TIPOS_VALIDOS -- solo exige
      // `completa=true` y `resultado != null` (paridad exacta con Python).
      const resultadosQuery = await this.prisma.evaluacion.groupBy({
        by: ['resultado'],
        where: { completa: true, resultado: { not: null } },
        _count: { id: true },
      });
      const resultados = resultadosQuery.map((g) => ({
        tipo: g.resultado ?? 'sin tipo',
        total: g._count.id,
      }));

      return {
        fechaGeneracion: new Date(),
        expedientes: { total: totalExpedientes, porEstado },
        evaluadores: {
          totalEvaluadores,
          cargaPromedio,
          cargaMaxima,
        },
        tiemposAtencion: tiempos,
        cargaEvaluadores,
        resultados,
      };
    } catch (e) {
      console.error(`Error en resumen_general: ${(e as Error).message}`);
      return {
        fechaGeneracion: new Date(),
        expedientes: { total: 0, porEstado: {} },
        evaluadores: { totalEvaluadores: 0, cargaPromedio: 0.0, cargaMaxima: 0 },
        tiemposAtencion: [],
        cargaEvaluadores: [],
        resultados: [],
      };
    }
  }

  // GET /reportes/exportar?tipo=expedientes|evaluaciones -- a diferencia del
  // stub original (routes.py:199-207, que no generaba ningún archivo real),
  // esto arma un PDF real con cara institucional (el admin pidió PDF en vez
  // de CSV plano). "resultados" se sacó de las opciones: son solo 3 números
  // que ya se ven completos en el gráfico "Resultados emitidos".
  async exportarListadoPdf(tipo: 'expedientes' | 'evaluaciones'): Promise<{ filename: string; buffer: Buffer }> {
    const fechaGeneracion = new Date().toLocaleDateString('es-PE');

    if (tipo === 'expedientes') {
      const expedientes = await this.prisma.expediente.findMany({
        include: { investigador: true },
        orderBy: { id: 'asc' },
      });
      const buffer = await this.pdfService.generarListadoExpedientes({
        fechaGeneracion,
        filas: expedientes.map((e) => ({
          codigo: e.codigoUnico ?? '—',
          titulo: e.tituloProtocolo,
          estado: ESTADO_LABEL[e.estado ?? ''] ?? e.estado ?? '—',
          investigador: e.investigador ? `${e.investigador.nombre} ${e.investigador.apellido}`.trim() : '—',
          modalidad: e.modalidad ?? '—',
          fechaEnvio: formatearFechaPdf(e.fechaEnvio),
        })),
      });
      return { filename: `expedientes_${Date.now()}.pdf`, buffer };
    }

    const evaluaciones = await this.prisma.evaluacion.findMany({
      include: { expediente: true, evaluador: true },
      orderBy: { id: 'asc' },
    });
    const buffer = await this.pdfService.generarListadoEvaluaciones({
      fechaGeneracion,
      filas: evaluaciones.map((ev) => ({
        codigoExpediente: ev.expediente?.codigoUnico ?? '—',
        evaluador: ev.evaluador ? `${ev.evaluador.nombre} ${ev.evaluador.apellido}`.trim() : '—',
        completa: ev.completa ? 'Sí' : 'No',
        puntaje: ev.puntajeTotal != null ? String(ev.puntajeTotal) : '—',
        resultado: ESTADO_LABEL[ev.resultado ?? ''] ?? ev.resultado ?? '—',
        fechaAsignacion: formatearFechaPdf(ev.fechaAsignacion),
      })),
    });
    return { filename: `evaluaciones_${Date.now()}.pdf`, buffer };
  }

  // El botón "Reporte con gráficos (PDF)" del admin: antes abría el diálogo
  // de impresión del navegador (el usuario pidió que en vez de eso se
  // descargue directo), así que esto arma un PDF real con los mismos
  // datos/colores que ve en pantalla.
  async exportarReportePdf(): Promise<Buffer> {
    const r = await this.resumen();
    return this.pdfService.generarReporteGestion({
      fechaGeneracion: r.fechaGeneracion.toLocaleDateString('es-PE'),
      metricas: [
        { label: 'Expedientes totales', valor: r.expedientes.total },
        { label: 'Evaluadores', valor: r.evaluadores.totalEvaluadores },
        { label: 'Carga promedio', valor: Math.round(r.evaluadores.cargaPromedio * 10) / 10 },
        { label: 'Carga máxima', valor: r.evaluadores.cargaMaxima },
      ],
      porEstado: Object.entries(r.expedientes.porEstado)
        .filter(([, total]) => total > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([estado, total]) => ({
          label: ESTADO_LABEL[estado] ?? estado,
          valor: total,
          color: ESTADO_COLOR[estado] ?? '#98a2b3',
        })),
      cargaEvaluadores: [...r.cargaEvaluadores]
        .sort((a, b) => b.totalEvaluaciones - a.totalEvaluaciones)
        .map((c) => ({ label: c.nombre ?? `Evaluador #${c.evaluadorId}`, valor: c.totalEvaluaciones })),
      resultados: r.resultados.map((res) => ({
        label: ESTADO_LABEL[res.tipo] ?? res.tipo,
        valor: res.total,
        color: ESTADO_COLOR[res.tipo] ?? '#98a2b3',
      })),
    });
  }
}

function formatearFechaPdf(fecha: Date | null): string {
  return fecha ? fecha.toLocaleDateString('es-PE') : '—';
}
