# Diseño: Levantamiento de observaciones del Comité (2026-09-07)

## Origen
Observaciones recibidas del Comité de Ética sobre el sistema de expedientes:
1. Tipo de proyecto según ciclo (artículo/tesis) para estudiantes; selector manual para roles internos.
2. Alerta a Secretaría cuando el título de un expediente es muy similar a uno existente.
3. Rechazo automático cuando un expediente coincide exactamente con otro ya ingresado.
4. Reenvío de expedientes rechazados/observados, con tope de 3 intentos, y vista dedicada de "mis proyectos rechazados".

## 1. Tipo de proyecto (`tipoProyecto`)
- Nuevo campo `tipoProyecto` en `Expediente`: `ARTICULO | TESIS | OTRO`.
- Al crear expediente:
  - Estudiante con `ciclo = VII` → preselecciona `ARTICULO` (editable).
  - Estudiante con `ciclo = IX` → preselecciona `TESIS` (editable).
  - Estudiante con `ciclo = VIII | X` → sin preselección, elige manualmente. **Pendiente de confirmar con el Comité el criterio para estos ciclos.**
  - Rol interno (`coordinador`, `evaluador`, `investigador`, `administrador`, `secretaria`) → sin preselección, selector obligatorio.
- Se muestra en detalle de expediente y listados de secretaría/coordinador.

## 2. Alerta de título similar
- Al enviar, comparar `tituloProtocolo` (normalizado) contra títulos de expedientes activos (no archivados) con similitud de texto (umbral configurable, ej. ≥80%).
- No bloquea el envío. Genera notificación al rol `secretaria` vía módulo `notificaciones` existente, referenciando ambos expedientes.
- Se registra en `HistorialExpediente` para trazabilidad.

## 3. Rechazo automático por duplicado exacto
- Comparación exacta (post-normalización) de: título + autores (mismo conjunto) + ciclo + facultad/programa, contra expedientes activos.
- Si hay coincidencia total, el expediente se marca automáticamente `no_aprobado` (motivo: "Duplicado exacto del expediente #X"), sin pasar por `en_revision`. Se notifica al usuario.

## 4. Reenvío tras observaciones (máx. 3 intentos)
- Nuevo campo `intentos` en `Expediente` (empieza en 1).
- Vista nueva "Mis proyectos rechazados" (web y mobile) con expedientes en estado `no_aprobado`/con observaciones y su detalle.
- Botón "Levantar observaciones y reenviar": incrementa `intentos`, vuelve a `enviado` → `en_revision`, conserva vínculo al expediente original (`expedienteOrigenId` si aplica).
- Si `intentos = 3` y es rechazado de nuevo, se bloquea el reenvío de ese expediente; el usuario debe iniciar un proyecto nuevo (sin heredar origen).

## Dudas abiertas (para el Comité)
- Criterio de `tipoProyecto` para ciclos VIII y X.
- Umbral exacto de similitud de título a usar para la alerta.
- Si el rechazo automático por duplicado debe usar un estado propio (`rechazado_duplicado`) o reusar `no_aprobado` con motivo textual.

## Entregable adicional
Al finalizar la implementación, generar informe en PDF resumiendo: qué se implementó, en base a qué observación, justificación de cada decisión, y dudas pendientes para el Comité.
