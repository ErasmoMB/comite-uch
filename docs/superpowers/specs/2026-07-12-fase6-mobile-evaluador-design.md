# App Móvil Expo — Fase 6: Rol Evaluador — Design

## Contexto

Continúa de Fase 5 (Coordinador, cerrada). Tercer rol interno del flujo real de un
trámite (Solicitante envía → Secretaría admite → Coordinador asigna evaluador →
**Evaluador califica** → Admin administra). Administrador queda como última fase.

Este es el rol más complejo hasta ahora: la pantalla de la rúbrica es el formulario más
elaborado de toda la web (593 líneas), con múltiples estados, 3 acciones y generación
automática de PDFs en el backend al completar.

## Alcance

**3 pantallas**, equivalentes 1:1 a `apps/web/src/pages/evaluador/*` + una rama NUEVA en
el `Perfil.tsx` compartido (a diferencia de Coordinador, que reutilizó la rama existente
sin cambios — Evaluador tiene su propia lógica de stats):

1. **Bandeja de evaluaciones** (`/evaluador/bandeja`) — lista de evaluaciones asignadas
   al evaluador logueado, búsqueda/filtro de fecha, badge Completada/Pendiente/Conflicto.
2. **Evaluación** (`/evaluador/evaluacion/:id`) — la pantalla central: 7 criterios con
   selector de puntaje (0 al máximo de cada uno) + observación opcional por criterio,
   observaciones generales, vista previa en vivo del resultado, documentos del
   expediente con botón "Abrir" (reutiliza `documentDownload.ts` de Fase 4), y 3
   acciones (Guardar avance / Enviar evaluación / Declarar conflicto de interés).
   Modo solo-lectura con descarga de PDFs una vez completada.
3. **Perfil** — nueva rama en `PerfilScreen.tsx` para `rol === 'evaluador'` (stats
   Pendientes/Completadas desde `misEvaluaciones()`, NO desde `expedientesService.list()`
   como las demás ramas).

**Fuera de alcance de este corte:**
- Vista previa embebida de documentos (PDF/imagen dentro de la app) — mismo criterio que
  Fase 4: "Ver" y "Descargar" se colapsan en un solo botón "Abrir" vía
  `documentDownload.ts`.
- Cualquier endpoint/función no usada por la propia web (p. ej. no se inventa un
  guardado real de puntajes parciales — ver decisión abajo).
- Un componente reusable formal para "fila de criterio" o "banner de resultado" más
  allá de lo que necesita esta pantalla — igual que la web, quedan locales al archivo
  de la pantalla (no hay necesidad de compartirlos con otra pantalla todavía).

## Decisiones tomadas (confirmadas con el usuario)

**1) Selector de puntaje por criterio:** píldoras tipo botón (mismo patrón `Selector`
ya usado en el wizard de Nuevo Proyecto para programa/ciclo), no un `<select>` nativo
(no existe en RN) ni un stepper numérico nuevo.

**2) "Guardar avance" se replica tal cual el bug real de la web:** ese botón SOLO
persiste el texto de "observaciones generales" (`POST /evaluacion/:id/guardar-parcial`
con body `{observaciones}`) — los puntajes por criterio typeados existen solo en estado
local de React hasta que se pulsa "Enviar evaluación", y se pierden si se sale de la
pantalla antes. **No se inventa un guardado real de puntajes parciales** (no hay
endpoint que lo soporte hoy sin construir algo nuevo fuera de alcance). Consistencia
con la web sobre "arreglar" algo que ni la propia web resuelve.

**3) El bug de "Descargar dictamen" visible en resultado `no_aprobado` SÍ se arregla en
el móvil:** el botón de descargar dictamen solo se muestra si
`resultado === 'aprobado' || resultado === 'aprobado_observaciones'` (los únicos casos
donde el backend genera ese PDF). Cambio trivial y sin riesgo — a diferencia de la
decisión 2, aquí no hay ambigüedad de comportamiento ni backend que replicar mal, solo
una condición de visibilidad incorrecta en la web que es seguro no copiar.

## Hallazgos técnicos importantes (de la exploración del código real — no ignorar)

- **Los tipos de respuesta reales de la API de evaluación NO coinciden con el
  `EvaluacionDto` compartido** en varios campos: la respuesta real usa
  `rubricaPdfUrl`/`dictamenPdfUrl` (no `...Path`), no trae `expediente`/`evaluador`
  anidados, y expone `tituloProtocolo`/`investigadorNombre`/`expedienteFechaEnvio`/
  `createdAt` aplanados. **El móvil debe tipar contra la forma real de la API**
  (mismo criterio ya aplicado en Fase 5 con `AsignarEvaluadorResponse`), no confiar en
  el tipo compartido tal cual.
- **`guardarAvance` y `declararConflicto` devuelven `{message: string}`, NO un
  `EvaluacionDto` completo.** La web tiene un bug real ahí (sobreescribe el estado con
  ese objeto incompleto, perdiendo campos). El móvil NO debe repetir ese bug: tras
  esas dos acciones, solo se muestra el mensaje de éxito, sin pisar el estado local de
  la evaluación cargada.
- **La Bandeja de evaluador dispara un `GET /expedientes/:id` extra por cada fila**
  (N+1) porque el backend nunca devuelve un `expediente` anidado en
  `mis-evaluaciones`, aunque el código de la web tiene una rama muerta que asume que sí
  a veces. El móvil replica el patrón real (siempre se necesita el fetch extra), sin
  intentar "optimizar" prematuramente fuera de alcance de este corte.

## Servicios — ampliar `evaluacion.service.ts` (ya existe desde Fase 5)

Nuevas funciones (además de `list`/`asignarEvaluador` ya existentes, sin tocar):
- `misEvaluaciones(): Promise<MiEvaluacionDto[]>` (`GET /evaluacion/mis-evaluaciones`) —
  tipo propio `MiEvaluacionDto` reflejando la forma real aplanada.
- `getById(id): Promise<EvaluacionDetalleDto>` (`GET /evaluacion/:id`) — tipo propio.
- `getRubrica(): Promise<RubricaDto>` (`GET /evaluacion/rubrica`) — catálogo estático de
  los 7 criterios + umbrales.
- `guardarAvance(id, observaciones): Promise<{message: string}>`
  (`POST /evaluacion/:id/guardar-parcial`).
- `enviarEvaluacion(id, payload): Promise<EvaluacionDetalleDto>` (`PUT /evaluacion/:id`
  con `{observaciones, completa: true, criterios: [...]}`) — esta SÍ devuelve el objeto
  completo real, se puede usar para refrescar estado.
- `declararConflicto(id): Promise<{message: string}>`
  (`POST /evaluacion/:id/conflicto`).

## Manejo de errores y estados

Mismo patrón establecido: `ApiError` + `ErrorText`, `useConfirm()` antes de Enviar
(irreversible) y Declarar conflicto (irreversible, estilo peligroso), estados
`cargando`/`error`/vacío, `useFocusEffect` en la Bandeja (lección de Fase 4/5),
`useSafeAreaInsets` en headers custom, `Screen` para scroll — el formulario de rúbrica
es largo, scroll obligatorio.

## Testing

Mismo enfoque: lógica pura extraíble a función testeada donde aplique (cálculo de
puntaje acumulado y resultado previsto son buenos candidatos — mismos umbrales que ya
están confirmados: 0-12 no aprobado, 13-16 aprobado con observaciones, 17-20 aprobado),
`tsc --noEmit` limpio por tarea, verificación manual final en Android real con
`evaluador@uch.edu.pe`.

## Riesgos anotados

- **Formulario largo y con muchos estados** (editable / solo-lectura por completada /
  bloqueado por conflicto) — la tarea de la pantalla de Evaluación se puede partir en
  sub-pasos si su complejidad lo amerita al planificar.
- **N+1 en la Bandeja** — aceptado como comportamiento real replicado, no se optimiza
  en este corte (mismo criterio que la web).
- **Reutilización de `documentDownload.ts`** (Fase 4) para el listado de documentos del
  expediente — sin cambios a ese archivo, solo se consume igual que en Secretaría.
