import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { StorageService } from '../storage/storage.service';

/**
 * Genera los mismos dos tipos de PDF que el backend Python
 * (comite/backend/app/utils/pdf_generator.py) usando pdfkit en vez de
 * reportlab. El contenido/estructura de la información es equivalente;
 * el layout exacto (tablas con reportlab Table/TableStyle) se traduce a la
 * API nativa de tablas de pdfkit (doc.table(...)).
 */
@Injectable()
export class PdfService {
  constructor(private storage: StorageService) {}

  /** 1cm en puntos (72pt = 1 pulgada, 1 pulgada = 2.54cm). */
  private cm(n: number): number {
    return (n * 72) / 2.54;
  }

  private newDoc(options: PDFKit.PDFDocumentOptions): PDFKit.PDFDocument {
    const Ctor = PDFDocument as unknown as new (
      opts?: PDFKit.PDFDocumentOptions,
    ) => PDFKit.PDFDocument;
    return new Ctor(options);
  }

  private async buildPdfBuffer(
    options: PDFKit.PDFDocumentOptions,
    draw: (doc: PDFKit.PDFDocument) => void,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = this.newDoc(options);
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      draw(doc);
      doc.end();
    });
  }

  /** Timestamp compacto tipo YYYYMMDDHHmmss, equivalente al strftime %Y%m%d_%H%M%S de Python. */
  private timestamp(): string {
    return new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  }

  /** Celda "etiqueta" en negrita con fondo celeste, igual que la columna 0 de info_table en reportlab. */
  private labelCell(text: string) {
    return {
      text,
      font: { family: 'Helvetica-Bold' },
      backgroundColor: '#E8F0F5',
    };
  }

  /** Celda de encabezado de la tabla de rúbrica: fondo navy, texto blanco en negrita. */
  private headerCell(text: string) {
    return {
      text,
      font: { family: 'Helvetica-Bold', size: 8 },
      backgroundColor: '#003366',
      textColor: 'white',
    };
  }

  async generarDictamen(params: {
    numeroDictamen: string;
    titulo: string;
    contenido: string;
    investigadorNombre: string;
    fecha: string;
  }): Promise<string> {
    const buffer = await this.buildPdfBuffer(
      { size: 'letter', margin: 50 },
      (doc) => {
        // --- HEADER ---
        doc
          .fontSize(14)
          .fillColor('#003366')
          .text('COMITÉ DE ÉTICA EN INVESTIGACIÓN', { align: 'center' });
        doc.text('DICTAMEN', { align: 'center' });
        doc.moveDown();

        // --- DATOS DEL DICTAMEN (equivalente a info_table en reportlab) ---
        doc.fontSize(10).fillColor('black');
        doc.table({
          columnStyles: [{ width: 140 }, { width: 300 }],
          data: [
            [this.labelCell('Número de Dictamen:'), params.numeroDictamen],
            [this.labelCell('Fecha:'), params.fecha],
            [this.labelCell('Investigador:'), params.investigadorNombre],
          ],
        });
        doc.moveDown();

        // --- TÍTULO ---
        doc.fontSize(11).fillColor('#003366').text(params.titulo);
        doc.moveDown(0.5);

        // --- CONTENIDO ---
        doc
          .fontSize(10)
          .fillColor('black')
          .text(params.contenido, { align: 'justify' });
      },
    );

    const key = `dictamenes/${params.numeroDictamen}_${this.timestamp()}.pdf`;
    await this.storage.putObject(key, buffer, 'application/pdf');
    // Devuelve la KEY, no una URL firmada. Antes se guardaba en
    // `Evaluacion.dictamenPdfPath` un presigned URL de 7 dias: al caducar, la
    // descarga redirigia a un enlace muerto (400) y el dictamen quedaba
    // inaccesible para siempre. Ademas median ~489 chars en una columna
    // VARCHAR(500), al borde de desbordar. Con la key, `resolverDescarga`
    // sirve el objeto desde el bucket y el enlace nunca caduca.
    return key;
  }

  async generarEvaluacionCompleta(params: {
    evaluacionId: number;
    codigoUnico: string | null;
    tituloProtocolo: string | null;
    autorStr: string;
    evaluadorNombre: string;
    fechaStr: string;
    criterios: Array<{
      nombre: string;
      descripcion: string;
      puntajeMax: number;
      puntaje: number;
      observacion: string | null;
    }>;
    puntajeTotal: number;
    observaciones: string | null;
    resultado: string | null;
  }): Promise<string> {
    const buffer = await this.buildPdfBuffer(
      {
        size: 'A4',
        margins: {
          top: this.cm(2),
          bottom: this.cm(2),
          left: this.cm(2),
          right: this.cm(2),
        },
      },
      (doc) => {
        // --- HEADER ---
        doc
          .fontSize(14)
          .fillColor('#003366')
          .text('COMITÉ DE ÉTICA EN INVESTIGACIÓN', { align: 'center' });
        doc
          .fontSize(11)
          .text(
            'FORMATO DE EVALUACIÓN Y DICTAMEN ÉTICO DE PROYECTOS DE INVESTIGACIÓN',
            { align: 'center' },
          );
        doc.moveDown();

        // --- DATOS GENERALES ---
        doc.fontSize(11).fillColor('#003366').text('DATOS GENERALES');
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor('black');
        doc.table({
          columnStyles: [{ width: this.cm(4.5) }, { width: this.cm(11) }],
          data: [
            [
              this.labelCell('Código de expediente:'),
              params.codigoUnico ?? '',
            ],
            [this.labelCell('Fecha de revisión:'), params.fechaStr],
            [
              this.labelCell('Título del proyecto:'),
              params.tituloProtocolo ?? '',
            ],
            [
              this.labelCell('Investigador(a) / Estudiante(s):'),
              params.autorStr,
            ],
            [this.labelCell('Revisor:'), params.evaluadorNombre],
          ],
        });
        doc.moveDown();

        // --- EVALUACIÓN ÉTICA (tabla de rúbrica, 7 criterios) ---
        doc.fontSize(11).fillColor('#003366').text('EVALUACIÓN ÉTICA');
        doc.moveDown(0.3);
        doc.fontSize(8).fillColor('black');

        const header = [
          this.headerCell('Criterio'),
          this.headerCell('Descripción'),
          this.headerCell('Puntaje Máximo'),
          this.headerCell('Puntaje Obtenido'),
          this.headerCell('Observaciones'),
        ];
        const rows = params.criterios.map((c) => [
          c.nombre,
          c.descripcion,
          String(c.puntajeMax),
          String(c.puntaje),
          c.observacion ?? '',
        ]);

        doc.table({
          columnStyles: [
            { width: this.cm(3.2) },
            { width: this.cm(5.5) },
            { width: this.cm(1.8), align: 'center' },
            { width: this.cm(1.8), align: 'center' },
            { width: this.cm(3.8) },
          ],
          data: [header, ...rows],
        });
        doc.moveDown();

        // --- PUNTAJE TOTAL ---
        doc
          .fontSize(11)
          .fillColor('#003366')
          .text(`Puntaje Total: ${params.puntajeTotal} / 20`);
        doc.moveDown();

        // --- OBSERVACIONES DEL COMITÉ ---
        doc.fontSize(11).fillColor('#003366').text('OBSERVACIONES DEL COMITÉ');
        doc.moveDown(0.2);
        doc
          .fontSize(9)
          .fillColor('black')
          .text(params.observaciones || 'Ninguna', { align: 'justify' });
        doc.moveDown();

        // --- DICTAMEN FINAL ---
        doc.fontSize(11).fillColor('#003366').text('DICTAMEN FINAL');
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor('black');
        const opciones: [string, string][] = [
          ['aprobado', 'Aprobado'],
          ['aprobado_observaciones', 'Aprobado con observaciones'],
          ['no_aprobado', 'No aprobado'],
        ];
        for (const [key, label] of opciones) {
          doc.text(`[${params.resultado === key ? 'X' : ' '}]  ${label}`, {
            indent: 20,
          });
        }
        doc.moveDown();
        doc.fontSize(9).text(`Fecha de emisión: ${params.fechaStr}`);
      },
    );

    const key = `evaluaciones/evaluacion_${params.evaluacionId}_${this.timestamp()}.pdf`;
    await this.storage.putObject(key, buffer, 'application/pdf');
    // El path de rúbrica se guarda como key, no como URL (igual que hoy:
    // descarga vía endpoint propio del backend, ver Task Evaluación).
    return key;
  }

  /** Encabezado institucional compartido por los listados/reporte (evita repetirlo 3 veces). */
  private encabezado(doc: PDFKit.PDFDocument, subtitulo: string, fechaGeneracion: string) {
    doc.fontSize(14).fillColor('#08204a').text('COMITÉ DE ÉTICA EN INVESTIGACIÓN', { align: 'center' });
    doc.fontSize(11).fillColor('#08204a').text(subtitulo, { align: 'center' });
    doc.fontSize(8).fillColor('#667085').text(`Generado el ${fechaGeneracion}`, { align: 'center' });
    doc.moveDown(1);
  }

  /**
   * Listado de expedientes en tabla -- reemplaza el CSV plano por un PDF con
   * la misma cara institucional que el dictamen/rúbrica (header navy, celdas
   * alternadas), a pedido explícito del admin.
   */
  async generarListadoExpedientes(params: {
    fechaGeneracion: string;
    filas: { codigo: string; titulo: string; estado: string; investigador: string; modalidad: string; fechaEnvio: string }[];
  }): Promise<Buffer> {
    return this.buildPdfBuffer({ size: 'A4', layout: 'landscape', margin: this.cm(1.5) }, (doc) => {
      this.encabezado(doc, `LISTADO DE EXPEDIENTES (${params.filas.length})`, params.fechaGeneracion);
      doc.fontSize(8).fillColor('black');
      const header = ['Código', 'Título', 'Estado', 'Investigador', 'Modalidad', 'Fecha envío'].map((t) => this.headerCell(t));
      const rows = params.filas.map((f) => [f.codigo, f.titulo, f.estado, f.investigador, f.modalidad, f.fechaEnvio]);
      // A4 landscape con margen 1.5cm da ~26.7cm útiles -- la suma de estos
      // anchos debe quedar bien por debajo de eso o la última columna se
      // corta contra el borde de la página (pdfkit no reduce las columnas
      // solo porque no entren).
      doc.table({
        columnStyles: [
          { width: this.cm(2.3) },
          { width: this.cm(9.5) },
          { width: this.cm(2.8) },
          { width: this.cm(4.2) },
          { width: this.cm(2.4) },
          { width: this.cm(2.6) },
        ],
        data: [header, ...rows],
      });
    });
  }

  /** Listado de evaluaciones en tabla -- mismo criterio que el de expedientes. */
  async generarListadoEvaluaciones(params: {
    fechaGeneracion: string;
    filas: { codigoExpediente: string; evaluador: string; completa: string; puntaje: string; resultado: string; fechaAsignacion: string }[];
  }): Promise<Buffer> {
    return this.buildPdfBuffer({ size: 'A4', margin: this.cm(1.8) }, (doc) => {
      this.encabezado(doc, `LISTADO DE EVALUACIONES (${params.filas.length})`, params.fechaGeneracion);
      doc.fontSize(8).fillColor('black');
      const header = ['Código expediente', 'Evaluador', 'Completa', 'Puntaje', 'Resultado', 'Fecha asignación'].map((t) =>
        this.headerCell(t),
      );
      const rows = params.filas.map((f) => [f.codigoExpediente, f.evaluador, f.completa, f.puntaje, f.resultado, f.fechaAsignacion]);
      // A4 portrait con margen 1.8cm da ~17.4cm útiles -- mismo motivo que en
      // el listado de expedientes: la suma debe quedar por debajo de eso.
      doc.table({
        columnStyles: [
          { width: this.cm(2.8) },
          { width: this.cm(3.8) },
          { width: this.cm(1.8), align: 'center' },
          { width: this.cm(1.8), align: 'center' },
          { width: this.cm(3.3) },
          { width: this.cm(2.6) },
        ],
        data: [header, ...rows],
      });
    });
  }

  /**
   * Reporte de gestión (KPIs + gráficos de barra) para el admin -- a
   * diferencia de los otros métodos, se descarga directo (no se sube a
   * Storage): el usuario pidió que no abra el diálogo de impresión del
   * navegador, sino un PDF real de un clic.
   */
  async generarReporteGestion(params: {
    fechaGeneracion: string;
    metricas: { label: string; valor: string | number }[];
    porEstado: { label: string; valor: number; color: string }[];
    cargaEvaluadores: { label: string; valor: number }[];
    resultados: { label: string; valor: number; color: string }[];
  }): Promise<Buffer> {
    return this.buildPdfBuffer({ size: 'A4', margin: this.cm(2) }, (doc) => {
      const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      this.encabezado(doc, 'REPORTE DE GESTIÓN', params.fechaGeneracion);

      // --- KPIs: 4 casillas en una fila ---
      const anchoKpi = anchoUtil / params.metricas.length;
      const yKpi = doc.y;
      params.metricas.forEach((m, i) => {
        const x = doc.page.margins.left + i * anchoKpi;
        doc.rect(x, yKpi, anchoKpi - 8, 46).stroke('#e5e7eb');
        doc.fontSize(16).fillColor('#0b57b7').text(String(m.valor), x, yKpi + 8, { width: anchoKpi - 8, align: 'center' });
        doc.fontSize(8).fillColor('#667085').text(m.label, x, yKpi + 30, { width: anchoKpi - 8, align: 'center' });
      });
      doc.y = yKpi + 60;
      doc.moveDown(0.8);

      this.dibujarBarras(doc, 'Expedientes por estado', params.porEstado, anchoUtil);
      doc.moveDown(1);
      this.dibujarBarras(
        doc,
        'Carga por evaluador',
        params.cargaEvaluadores.map((c) => ({ ...c, color: '#0b57b7' })),
        anchoUtil,
      );
      doc.moveDown(1);
      this.dibujarBarraApilada(doc, 'Resultados emitidos', params.resultados, anchoUtil);
    });
  }

  // Una fila por categoría: etiqueta a la izquierda, barra horizontal
  // proporcional al máximo, valor al final -- mismo lenguaje visual que el
  // HBarChart del cliente, redibujado con las primitivas de pdfkit.
  private dibujarBarras(
    doc: PDFKit.PDFDocument,
    titulo: string,
    datos: { label: string; valor: number; color: string }[],
    anchoUtil: number,
  ) {
    // x/width explícitos SIEMPRE: un .text(str, x, y, {width}) previo dentro
    // del propio dibujado (la columna del valor, angosta y pegada al borde
    // derecho) deja doc.x ahí -- sin este reseteo, el título de la sección
    // siguiente hereda ese ancho angosto y el texto queda partido letra por
    // letra en vez de fluir en una línea.
    doc.fontSize(11).fillColor('#08204a').text(titulo, doc.page.margins.left, doc.y, { width: anchoUtil });
    doc.moveDown(0.4);
    if (datos.length === 0) {
      doc.fontSize(9).fillColor('#667085').text('Sin datos por el momento.', doc.page.margins.left, doc.y, { width: anchoUtil });
      return;
    }
    const max = Math.max(1, ...datos.map((d) => d.valor));
    const anchoLabel = 130;
    const anchoValor = 30;
    const anchoBarraMax = anchoUtil - anchoLabel - anchoValor - 10;
    const x0 = doc.page.margins.left;
    for (const d of datos) {
      const y = doc.y;
      doc.fontSize(9).fillColor('#344054').text(d.label, x0, y + 2, { width: anchoLabel - 6 });
      const anchoBarra = Math.max(4, (d.valor / max) * anchoBarraMax);
      doc.rect(x0 + anchoLabel, y, anchoBarraMax, 10).fill('#f1f2f4');
      doc.rect(x0 + anchoLabel, y, anchoBarra, 10).fill(d.color);
      doc
        .fontSize(9)
        .fillColor('#08204a')
        .text(String(d.valor), x0 + anchoLabel + anchoBarraMax + 6, y + 1, { width: anchoValor, align: 'right' });
      doc.y = y + 16;
    }
  }

  // Una sola barra dividida en segmentos (parte-del-todo) + leyenda debajo,
  // igual que StackedHBarChart en el cliente.
  private dibujarBarraApilada(
    doc: PDFKit.PDFDocument,
    titulo: string,
    datos: { label: string; valor: number; color: string }[],
    anchoUtil: number,
  ) {
    doc.fontSize(11).fillColor('#08204a').text(titulo, doc.page.margins.left, doc.y, { width: anchoUtil });
    doc.moveDown(0.4);
    const total = datos.reduce((acc, d) => acc + d.valor, 0);
    if (total === 0) {
      doc.fontSize(9).fillColor('#667085').text('Aún no hay evaluaciones completas.', doc.page.margins.left, doc.y, { width: anchoUtil });
      return;
    }
    const x0 = doc.page.margins.left;
    const y = doc.y;
    let x = x0;
    for (const d of datos) {
      if (d.valor === 0) continue;
      const ancho = (d.valor / total) * anchoUtil;
      doc.rect(x, y, Math.max(2, ancho - 2), 16).fill(d.color);
      x += ancho;
    }
    const yLeyenda = y + 24;
    let xLeyenda = x0;
    for (const d of datos) {
      const texto = `${d.label} (${d.valor})`;
      doc.rect(xLeyenda, yLeyenda + 2, 8, 8).fill(d.color);
      doc.fontSize(8).fillColor('#344054').text(texto, xLeyenda + 12, yLeyenda);
      xLeyenda += 12 + texto.length * 4.2 + 16;
    }
    doc.y = yLeyenda + 16;
  }
}
