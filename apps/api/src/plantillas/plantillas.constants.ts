// Equivalente 1:1 a comite/backend/app/api/plantillas/routes.py: catálogo
// estático de plantillas/guías públicas del Comité (sin auth), servidas
// desde el directorio plantillas/ en la raíz de este backend.
export const PLANTILLAS: Record<string, { archivo: string; nombreDescarga: string }> = {
  solicitud_evaluacion: {
    archivo: 'solicitud_evaluacion.docx',
    nombreDescarga: 'Plantilla - Solicitud de evaluacion.docx',
  },
  carta_aprobacion: {
    archivo: 'carta_aprobacion.docx',
    nombreDescarga: 'Plantilla - Carta de aprobacion del docente.docx',
  },
  guia_pago: {
    archivo: 'guia_pago.png',
    nombreDescarga: 'Guia de pago - ERP.png',
  },
  estructura_nombres: {
    archivo: 'estructura_nombres.pdf',
    nombreDescarga: 'Estructura del nombre de los archivos.pdf',
  },
  cambio_titulo: {
    archivo: 'cambio_titulo.docx',
    nombreDescarga: 'Formato - Solicitud de cambio de titulo.docx',
  },
};
