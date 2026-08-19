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
  // Los PDF que emite el sistema (rúbrica y dictamen) reproducen el formato en
  // Word que entregó el Comité ("Documento 2 - FORMATO DE EVALUACIÓN Y
  // DICTAMEN ÉTICO DE PROYECTOS DE INVESTIGACIÓN.docx"). Se replica tal cual:
  //
  //   - A4 HORIZONTAL, márgenes 2.5cm arriba/laterales y 3cm abajo
  //     (`<w:pgSz w:orient="landscape">` + `<w:pgMar>` del document.xml).
  //   - Logo institucional arriba a la izquierda, en TODAS las páginas (en el
  //     .docx vive en el header, así que se repite).
  //   - Título centrado, encabezados de sección y textos en negro.
  //   - DATOS GENERALES como lista con viñetas (NO como tabla).
  //   - Tabla de 7 criterios con cabecera blanca y texto negro centrado.
  //   - Puntaje Total, OBSERVACIONES DEL COMITÉ y DICTAMEN FINAL con casillas.
  //
  // El dictamen NO es un documento distinto: es esta misma plantilla (que ya
  // incluye el bloque "DICTAMEN FINAL"), con una viñeta extra para el número
  // de dictamen. Antes era un párrafo suelto sin ninguna de estas secciones y
  // el Comité lo observó.

  /** Márgenes del .docx, en cm. */
  private static readonly MARGENES = { top: 2.5, bottom: 3, left: 2.5, right: 2.5 };

  /**
   * Cabecera de la tabla de criterios TAL COMO ESTA EN LA PLANTILLA: fondo
   * blanco, texto negro en negrita y centrado. (`headerCell`, con su franja
   * azul y texto blanco, se sigue usando en los listados/reportes del admin,
   * que no salen de este formato.)
   */
  private headerCellFormato(text: string) {
    return {
      text,
      font: { family: 'Helvetica-Bold', size: 8.5 },
      align: 'center' as const,
    };
  }

  private anchoUtil(doc: PDFKit.PDFDocument): number {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
  }

  /** Opciones de documento equivalentes al `sectPr` de la plantilla. */
  private opcionesPlantilla(): PDFKit.PDFDocumentOptions {
    const m = PdfService.MARGENES;
    return {
      size: 'A4',
      layout: 'landscape',
      margins: {
        top: this.cm(m.top),
        bottom: this.cm(m.bottom),
        left: this.cm(m.left),
        right: this.cm(m.right),
      },
    };
  }

  /**
   * Logo institucional arriba a la izquierda. En el .docx vive en el header,
   * así que aparece en cada página: se dibuja en la primera y se engancha a
   * `pageAdded` para las siguientes. Ojo con el orden -- `pageAdded` se emite
   * ANTES de que pdfkit reposicione el cursor, así que hay que fijar `doc.y`
   * a mano después de pintar la imagen.
   */
  private logoEnTodasLasPaginas(doc: PDFKit.PDFDocument, anchoCm = 4.85) {
    const ancho = this.cm(anchoCm);
    const alto = ancho / UCH_LOGO_RATIO;
    const pintar = () => {
      // A 1cm del borde: en el .docx el logo vive en el HEADER, es decir por
      // encima del margen superior del cuerpo. Dibujarlo dentro del cuerpo
      // empujaba el contenido hacia abajo y partia la tabla de criterios en
      // dos paginas, cosa que la plantilla no hace.
      doc.image(UCH_LOGO_PNG, doc.page.margins.left, this.cm(1), { width: ancho, height: alto });
      doc.y = doc.page.margins.top;
    };
    pintar();
    doc.on('pageAdded', pintar);
  }

  /** Título del documento: centrado, negrita, negro (como en la plantilla). */
  private tituloDocumento(doc: PDFKit.PDFDocument, texto: string) {
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('black')
      .text(texto, doc.page.margins.left, doc.y, { width: this.anchoUtil(doc), align: 'center' });
    doc.font('Helvetica');
    doc.moveDown(1);
  }

  /** Encabezado de sección ("DATOS GENERALES", "EVALUACIÓN ÉTICA", ...). */
  private seccion(doc: PDFKit.PDFDocument, texto: string) {
    doc
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .fillColor('black')
      .text(texto, doc.page.margins.left, doc.y, { width: this.anchoUtil(doc) });
    doc.moveDown(0.5);
    doc.font('Helvetica').fillColor('black');
  }

  /**
   * DATOS GENERALES: lista con viñetas ("• Etiqueta: valor"), igual que la
   * plantilla. Deliberadamente NO es una tabla -- el Word no la usa aquí.
   */
  private datosGenerales(doc: PDFKit.PDFDocument, filas: [string, string][]) {
    const sangria = this.cm(0.75);
    const x = doc.page.margins.left + sangria;
    const ancho = this.anchoUtil(doc) - sangria;
    for (const [etiqueta, valor] of filas) {
      const y = doc.y;
      doc.font('Helvetica').fontSize(10).fillColor('black');
      doc.text('•', doc.page.margins.left + this.cm(0.25), y, { width: sangria });
      doc.text(`${etiqueta} ${valor}`.trimEnd(), x, y, { width: ancho });
      doc.y += 3;
    }
    doc.moveDown(1);
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
    const x = doc.page.margins.left;
    const lado = 10;
    for (const [key, label] of opciones) {
      const y = doc.y;
      const marcado = resultado === key;
      doc.lineWidth(0.8).rect(x, y + 1.5, lado, lado).stroke('black');
      if (marcado) {
        doc
          .moveTo(x + 2, y + 3.5)
          .lineTo(x + lado - 2, y + lado - 0.5)
          .moveTo(x + lado - 2, y + 3.5)
          .lineTo(x + 2, y + lado - 0.5)
          .stroke('black');
      }
      doc
        .font(marcado ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10.5)
        .fillColor('black')
        .text(label, x + lado + 8, y, { width: this.anchoUtil(doc) - lado - 8 });
      // La plantilla deja las tres opciones bien separadas, no pegadas.
      doc.y = y + lado + 14;
    }
    doc.font('Helvetica');
  }

  /** Líneas de puntos para rellenar a mano, como el bloque de observaciones del .docx. */
  private lineasPunteadas(doc: PDFKit.PDFDocument, cantidad: number) {
    const ancho = this.anchoUtil(doc);
    doc.font('Helvetica').fontSize(10).fillColor('black');
    // Se calcula cuántos puntos entran en el ancho útil en vez de fijar un
    // número: en A4 horizontal un largo fijo se quedaba corto o desbordaba.
    const puntos = Math.floor(ancho / doc.widthOfString('.'));
    for (let i = 0; i < cantidad; i++) {
      doc.text('.'.repeat(puntos), doc.page.margins.left, doc.y, {
        width: ancho,
        lineBreak: false,
        ellipsis: false,
      });
      doc.y += 20;
    }
  }

  /**
   * Dibuja la plantilla completa. La usan tanto la rúbrica como el dictamen;
   * lo único que cambia es el número de dictamen en DATOS GENERALES.
   */
  private dibujarFormatoOficial(
    doc: PDFKit.PDFDocument,
    params: {
      numeroDictamen?: string;
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
    },
  ) {
    this.logoEnTodasLasPaginas(doc);
    this.tituloDocumento(doc, 'FORMATO DE EVALUACIÓN Y DICTAMEN ÉTICO DE PROYECTOS DE INVESTIGACIÓN');

    this.seccion(doc, 'DATOS GENERALES');
    const datos: [string, string][] = [];
    if (params.numeroDictamen) {
      datos.push(['Número de dictamen:', params.numeroDictamen]);
    }
    datos.push(
      ['Código de expediente:', params.codigoUnico ?? ''],
      ['Fecha de revisión:', params.fechaStr],
      ['Título del proyecto:', params.tituloProtocolo ?? ''],
      ['Investigador(a) / Estudiante(s):', params.autorStr],
      ['Revisor:', params.evaluadorNombre],
    );
    this.datosGenerales(doc, datos);


    this.seccion(doc, 'EVALUACIÓN ÉTICA');
    doc.font('Helvetica').fontSize(8.5).fillColor('black');
    const header = [
      this.headerCellFormato('Criterio'),
      this.headerCellFormato('Descripción'),
      this.headerCellFormato('Puntaje Máximo'),
      this.headerCellFormato('Puntaje Obtenido'),
      this.headerCellFormato('Observaciones'),
    ];
    const rows = params.criterios.map((c) => [
      c.nombre,
      c.descripcion,
      String(c.puntajeMax),
      String(c.puntaje),
      c.observacion ?? '',
    ]);
    // Anchos tomados de la tabla del .docx, proporcionalmente a los 24.7cm
    // utiles de A4 horizontal con margenes de 2.5cm.
    doc.table({
      columnStyles: [
        { width: this.cm(5.0) },
        { width: this.cm(10.4) },
        { width: this.cm(1.6), align: 'center' },
        { width: this.cm(1.9), align: 'center' },
        { width: this.cm(5.8) },
      ],
      data: [header, ...rows],
    });

    // La plantilla corta aquí: página 1 = datos + tabla de criterios;
    // página 2 = Puntaje Total, OBSERVACIONES DEL COMITÉ y DICTAMEN FINAL.
    // Se fuerza el salto para que el impreso coincida página por página, en
    // vez de depender de cuánto haya crecido la tabla.
    doc.addPage();

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('black')
      .text(`Puntaje Total: ${params.puntajeTotal} / ${params.puntajeMaximo}`, doc.page.margins.left, doc.y, {
        width: this.anchoUtil(doc),
      });
    doc.font('Helvetica');
    doc.moveDown(2);

    this.seccion(doc, 'OBSERVACIONES DEL COMITÉ');
    const texto = params.observaciones?.trim();
    if (texto) {
      doc
        .font('Helvetica')
        .fontSize(10.5)
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
    doc.moveDown(2);

    this.dictamenFinal(doc, params.resultado);
  }

  async generarDictamen(params: {
    numeroDictamen: string;
    codigoUnico: string | null;
    titulo: string;
    investigadorNombre: string;
    evaluadorNombre: string;
    fecha: string;
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
    const buffer = await this.buildPdfBuffer(this.opcionesPlantilla(), (doc) => {
      this.dibujarFormatoOficial(doc, {
        numeroDictamen: params.numeroDictamen,
        codigoUnico: params.codigoUnico,
        tituloProtocolo: params.titulo,
        autorStr: params.investigadorNombre,
        evaluadorNombre: params.evaluadorNombre,
        fechaStr: params.fecha,
        criterios: params.criterios,
        puntajeTotal: params.puntajeTotal,
        puntajeMaximo: params.puntajeMaximo,
        observaciones: params.observaciones,
        resultado: params.resultado,
      });
    });

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
    const buffer = await this.buildPdfBuffer(this.opcionesPlantilla(), (doc) => {
      this.dibujarFormatoOficial(doc, params);
    });

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
