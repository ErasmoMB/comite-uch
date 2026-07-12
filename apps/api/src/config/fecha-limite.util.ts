// Constante y helper de parseo compartidos entre ConfigService (validación al
// guardar la fecha límite, GET/PUT /config/fecha-limite) y ExpedientesService
// (chequeo de vencimiento al enviar un expediente). Ver
// comite/backend/app/api/config/routes.py:15 (CLAVE_FECHA_LIMITE) y
// comite/backend/app/api/expedientes/routes.py:407-420 (parseo/comparación
// EXACTA que se replica aquí -- verificada en producción hoy 2026-07-04 con
// una fecha límite real de 2026-12-25).
export const CLAVE_FECHA_LIMITE = 'fecha_limite_envio';

// Replica el parseo + comparación de Python:
//
//   limite = datetime.fromisoformat(fecha_str.replace("Z", "+00:00"))
//   ahora = datetime.now(limite.tzinfo) if limite.tzinfo else datetime.utcnow()
//   if ahora > limite: ...
//
// Ambas ramas de Python terminan comparando instantes absolutos asumiendo UTC
// cuando la cadena no trae zona horaria explícita (Z o +HH:MM/-HH:MM):
//   - Con zona: `datetime.now(tz)` es el instante actual real -- igual que
//     comparar dos `Date` de JS (que siempre son instantes absolutos).
//   - Sin zona: Python compara los campos "naive" de `limite` contra los
//     campos "naive" de `utcnow()`, lo que equivale a interpretar la cadena
//     como si ya fuera UTC.
// Por eso, si la cadena no trae zona, se le agrega "Z" antes de parsearla con
// `Date` -- si no, `Date` interpretaría una cadena tipo "2026-12-25T00:00:00"
// (sin zona) como hora LOCAL del proceso, no como UTC, rompiendo la paridad.
//
// Si el parseo falla, devuelve `null` (equivalente al `except ValueError:
// pass` de Python: no se aplica ningún límite).
export function parseFechaLimite(fechaStr: string): Date | null {
  const tieneZona = /(Z|[+-]\d{2}:\d{2})$/.test(fechaStr);
  const normalizada = tieneZona ? fechaStr : `${fechaStr}Z`;
  const fecha = new Date(normalizada);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
