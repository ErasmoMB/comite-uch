import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { StorageService } from '../storage/storage.service';
import { UCH_LOGO_PNG, UCH_LOGO_RATIO } from './uch-logo';

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

  // ==================== PLANTILLA OFICIAL DEL COMITÉ ====================
  //
  // Los dos PDF que recibe el investigador (rúbrica y dictamen) reproducen el
  // formato en Word que entregó el Comité ("Documento 2 - FORMATO DE
  // EVALUACIÓN Y DICTAMEN ÉTICO DE PROYECTOS DE INVESTIGACIÓN.docx"): mismo
  // logo en el encabezado, mismos títulos de sección, misma tabla de datos
  // generales, misma tabla de 7 criterios y el mismo bloque de DICTAMEN FINAL
  // con casillas. Antes el dictamen era un párrafo suelto sin ninguna de esas
  // secciones y el Comité lo observó.

  private static readonly NAVY = '#1F3864';

  private anchoUtil(doc: PDFKit.PDFDocument): number {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
  }

  /** Logo institucional arriba a la izquierda, como en el encabezado del .docx. */
  private logo(doc: PDFKit.PDFDocument, anchoCm = 5.2) {
    const ancho = this.cm(anchoCm);
    const alto = ancho / UCH_LOGO_RATIO;
    doc.image(UCH_LOGO_PNG, doc.page.margins.left, doc.y, { width: ancho, height: alto });
    doc.y += alto + 10;
  }

  /** Título del documento, centrado, como el encabezado de la plantilla. */
  private tituloDocumento(doc: PDFKit.PDFDocument, texto: string) {
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(PdfService.NAVY)
      .text(texto, doc.page.margins.left, doc.y, { width: this.anchoUtil(doc), align: 'center' });
    doc.font('Helvetica').fillColor('black');
    doc.moveDown(1);
  }

  /** Encabezado de sección ("DATOS GENERALES", "EVALUACIÓN ÉTICA", ...). */
  private seccion(doc: PDFKit.PDFDocument, texto: string) {
    doc
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .fillColor(PdfService.NAVY)
      .text(texto, doc.page.margins.left, doc.y, { width: this.anchoUtil(doc) });
    doc.moveDown(0.4);
    doc.font('Helvetica').fillColor('black');
  }

  /** Tabla "DATOS GENERALES": etiqueta a la izquierda, valor a la derecha. */
  private tablaDatos(doc: PDFKit.PDFDocument, filas: [string, string][], anchoEtiquetaCm = 5) {
    const ancho = this.anchoUtil(doc);
    doc.fontSize(9.5).fillColor('black');
    doc.table({
      columnStyles: [
        { width: this.cm(anchoEtiquetaCm) },
        { width: ancho - this.cm(anchoEtiquetaCm) },
      ],
      data: filas.map(([etiqueta, valor]) => [this.labelCell(etiqueta), valor || '-']),
    });
    doc.moveDown(0.8);
  }

  /**
   * Bloque "DICTAMEN FINAL": tres casillas, la del resultado marcada con una
   * X. Se dibuja con primitivas y no con el carácter de casilla del Word
   * porque las fuentes estándar de PDF (WinAnsi) no incluyen ese glifo:
   * saldría como un cuadro vacío o basura.
   */
  private dictamenFinal(doc: PDFKit.PDFDocument, resultado: string | null) {
    this.seccion(doc, 'DICTAMEN FINAL');
    const opciones: [string, string][] = [
      ['aprobado', 'Aprobado'],
      ['aprobado_observaciones', 'Aprobado con observaciones'],
      ['no_aprobado', 'No aprobado'],
    ];
    const x = doc.page.margins.left + 10;
    const lado = 9;
    for (const [key, label] of opciones) {
      const y = doc.y;
      const marcado = resultado === key;
      doc.lineWidth(0.8).rect(x, y + 1, lado, lado).stroke(PdfService.NAVY);
      if (marcado) {
        doc
          .moveTo(x + 1.8, y + 2.8)
          .lineTo(x + lado - 1.8, y + lado - 0.8)
          .moveTo(x + lado - 1.8, y + 2.8)
          .lineTo(x + 1.8, y + lado - 0.8)
          .stroke(PdfService.NAVY);
      }
      doc
        .font(marcado ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10)
        .fillColor('black')
        .text(label, x + lado + 8, y, { width: 300 });
      doc.y = y + lado + 7;
    }
    doc.font('Helvetica');
  }

  /** Líneas de puntos para rellenar a mano, como el bloque de observaciones del .docx. */
  private lineasPunteadas(doc: PDFKit.PDFDocument, cantidad: number) {
    const ancho = this.anchoUtil(doc);
    doc.fontSize(9).fillColor('#98A2B3');
    for (let i = 0; i < cantidad; i++) {
      doc.text('.'.repeat(140), doc.page.margins.left, doc.y, {
        width: ancho,
        lineBreak: false,
        ellipsis: false,
      });
      doc.y += 13;
    }
    doc.fillColor('black');
  }

  async generarDictamen(params: {
    numeroDictamen: string;
    codigoUnico: string | null;
    titulo: string;
    investigadorNombre: string;
    evaluadorNombre: string;
    fecha: string;
    puntajeTotal: number;
    puntajeMaximo: number;
    observaciones: string | null;
    resultado: string | null;
  }): Promise<string> {
    const buffer = await this.buildPdfBuffer(
      {
        size: 'A4',
        margins: {
          top: this.cm(2),
          bottom: this.cm(2),
          left: this.cm(2.2),
          right: this.cm(2.2),
        },
      },
      (doc) => {
        this.logo(doc);
        this.tituloDocumento(doc, 'DICTAMEN ÉTICO DE PROYECTOS DE INVESTIGACIÓN');

        this.seccion(doc, 'DATOS GENERALES');
        this.tablaDatos(doc, [
          ['Número de dictamen:', params.numeroDictamen],
          ['Código de expediente:', params.codigoUnico ?? ''],
          ['Fecha de revisión:', params.fecha],
          ['Título del proyecto:', params.titulo],
          ['Investigador(a) / Estudiante(s):', params.investigadorNombre],
          ['Revisor:', params.evaluadorNombre],
        ]);

        this.seccion(doc, 'RESULTADO DE LA EVALUACIÓN');
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('black')
          .text(
            `Puntaje Total: ${params.puntajeTotal} / ${params.puntajeMaximo}`,
            doc.page.margins.left,
            doc.y,
            { width: this.anchoUtil(doc) },
          );
        doc.font('Helvetica');
        doc.moveDown(1);

        this.seccion(doc, 'OBSERVACIONES DEL COMITÉ');
        doc
          .fontSize(9.5)
          .fillColor('black')
          .text(params.observaciones?.trim() || 'Ninguna.', doc.page.margins.left, doc.y, {
            width: this.anchoUtil(doc),
            align: 'justify',
          });
        doc.moveDown(1);

        this.dictamenFinal(doc, params.resultado);

        doc.moveDown(0.5);
        doc
          .fontSize(8.5)
          .fillColor('#667085')
          .text(`Fecha de emisión: ${params.fecha}`, doc.page.margins.left, doc.y, {
            width: this.anchoUtil(doc),
          });
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
    puntajeMaximo: number;
    observaciones: string | null;
    resultado: string | null;
  }): Promise<string> {
    const buffer = await this.buildPdfBuffer(
      {
        size: 'A4',
        margins: {
          top: this.cm(1.8),
          bottom: this.cm(1.8),
          left: this.cm(1.8),
          right: this.cm(1.8),
        },
      },
      (doc) => {
        this.logo(doc);
        this.tituloDocumento(
          doc,
          'FORMATO DE EVALUACIÓN Y DICTAMEN ÉTICO DE PROYECTOS DE INVESTIGACIÓN',
        );

        this.seccion(doc, 'DATOS GENERALES');
        this.tablaDatos(doc, [
          ['Código de expediente:', params.codigoUnico ?? ''],
          ['Fecha de revisión:', params.fechaStr],
          ['Título del proyecto:', params.tituloProtocolo ?? ''],
          ['Investigador(a) / Estudiante(s):', params.autorStr],
          ['Revisor:', params.evaluadorNombre],
        ]);

        this.seccion(doc, 'EVALUACIÓN ÉTICA');
        doc.fontSize(7.5).fillColor('black');
        const header = [
          this.headerCell('Criterio'),
          this.headerCell('Descripción'),
          this.headerCell('Puntaje Máximo'),
          this.headerCell('Puntaje Obtenido'),
          this.headerCell('Observaciones'),
        ];
        const rows = params.criterios.map((c) => [
          { text: c.nombre, font: { family: 'Helvetica-Bold' } },
          c.descripcion,
          String(c.puntajeMax),
          String(c.puntaje),
          c.observacion ?? '',
        ]);
        // Anchos pensados para A4 con margen 1.8cm (~17.4cm útiles): la suma
        // debe quedar por debajo o pdfkit corta la última columna contra el
        // borde en vez de reducir las demás.
        doc.table({
          columnStyles: [
            { width: this.cm(2.9) },
            { width: this.cm(6.6) },
            { width: this.cm(1.5), align: 'center' },
            { width: this.cm(1.5), align: 'center' },
            { width: this.cm(4.7) },
          ],
          data: [header, ...rows],
        });
        doc.moveDown(0.8);

        doc
          .font('Helvetica-Bold')
          .fontSize(10.5)
          .fillColor(PdfService.NAVY)
          .text(
            `Puntaje Total: ${params.puntajeTotal} / ${params.puntajeMaximo}`,
            doc.page.margins.left,
            doc.y,
            { width: this.anchoUtil(doc) },
          );
        doc.font('Helvetica');
        doc.moveDown(1);

        this.seccion(doc, 'OBSERVACIONES DEL COMITÉ');
        const texto = params.observaciones?.trim();
        if (texto) {
          doc
            .fontSize(9.5)
            .fillColor('black')
            .text(texto, doc.page.margins.left, doc.y, {
              width: this.anchoUtil(doc),
              align: 'justify',
            });
        } else {
          // Sin observaciones, el .docx deja las líneas de puntos para llenar
          // a mano; se conservan para que el impreso se vea igual.
          this.lineasPunteadas(doc, 3);
        }
        doc.moveDown(1);

        this.dictamenFinal(doc, params.resultado);

        doc.moveDown(0.5);
        doc
          .fontSize(8.5)
          .fillColor('#667085')
          .text(`Fecha de emisión: ${params.fechaStr}`, doc.page.margins.left, doc.y, {
            width: this.anchoUtil(doc),
          });
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
