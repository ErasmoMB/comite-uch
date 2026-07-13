# App Móvil Expo — Fase 5: Rol Coordinador — Design

## Contexto

Continúa directamente de la Fase 4 (Secretaría técnica, cerrada). Este es el segundo rol
interno del flujo real de un trámite (Solicitante envía → Secretaría admite →
**Coordinador asigna evaluador** → Evaluador califica → Admin administra). Los roles
Evaluador y Administrador quedan para fases posteriores, mismo patrón de ciclo
spec → plan → construcción → verificación uno por uno.

## Alcance

**3 pantallas**, equivalentes 1:1 a `apps/web/src/pages/coordinador/*` + el `Perfil.tsx`
compartido (que coordinador usa en su misma rama de rol interno que Secretaría/Admin):

1. **Dashboard** (`/coordinador/dashboard` en web) — 4 tarjetas de stats + lista de
   expedientes en `en_revision` con búsqueda/filtro de fecha, badge de asignación
   ("Pendiente de asignar" / "En evaluación").
2. **Asignación** (`/coordinador/asignacion/:id`) — pantalla oculta (no es pestaña,
   solo se llega tocando un expediente desde el Dashboard, igual que la web). Lista de
   evaluadores ordenados por menor carga pendiente + botón "Asignar"; si ya tiene
   evaluador, tarjeta de solo lectura sin opción de reasignar (así es la web, no se
   inventa esa función).
3. **Perfil** — se reutiliza el `PerfilScreen.tsx` compartido de Fase 4 tal cual.
   Coordinador cae en la misma rama de rol interno que Secretaría (stats
   Enviados/Aprobados + "Expedientes vinculados"). **Cero código nuevo** en
   `PerfilScreen.tsx`, solo un wrapper de ruta.

**Fuera de alcance de este corte:**
- Reasignar/desasignar evaluador — no existe en la web, no se inventa.
- El endpoint `POST /evaluacion` (auto-asignación, "asignarme a mí mismo") — existe en
  el backend pero ninguna pantalla de la web lo usa, no se porta.
- Notificaciones — igual que en Fase 3/4, ninguna pantalla de coordinador en la web las
  muestra.
- Editar/ver el contenido de una evaluación — el backend explícitamente prohíbe a
  coordinador editar evaluaciones (`update()` solo permite al evaluador dueño o admin);
  coordinador solo asigna, nunca ve el detalle de la rúbrica.

## Hallazgo técnico a resolver (no un "bug" del móvil — de la API real)

`POST /evaluacion/expediente/:id/asignar` devuelve una forma de respuesta que **no
coincide** con el tipo compartido `EvaluacionDto` (usa `evaluacionId` en vez de `id`, no
trae `expedienteId`/`completa`/`criterios`, etc.). La web se salva porque solo lee
`evaluador.nombre/apellido` de la respuesta, campo que por casualidad existe en ambas
formas. **Decisión: crear un tipo propio y correcto para esta respuesta en el móvil**
(`AsignarEvaluadorResponse` o similar) en vez de reusar `EvaluacionDto` incorrectamente.

## Decisión de arquitectura — mismo patrón que Fase 4

Nuevo grupo de rutas hermano `app/(coordinador)/`, con su propio `_layout.tsx` (guard de
sesión + Tabs de **2** pestañas: Inicio / Perfil — "Asignación" es ruta oculta, se llega
solo desde el Dashboard, igual que la web no le da item de navegación propio). Se amplía
`src/lib/roles.ts` → `homeGroupForRole` agregando `coordinador → '/(coordinador)'`
(y el tipo `HomeGroup` gana un cuarto valor). El grupo `(app)/` (Solicitante) y
`(secretaria)/` quedan intactos, sin tocar.

## Pantallas — detalle

### 1. Dashboard (`app/(coordinador)/index.tsx`)

- Carga en paralelo: `expedientesService.list()` (ya existe, sin cambios) +
  `evaluacionService.list()` (nuevo servicio, ver abajo) → filtra client-side a
  `estado === 'en_revision'` (igual que la web), calcula stats de los 4 estados sobre
  el total de expedientes (no solo los en_revision, igual que la web), y arma el set de
  ids con evaluación ya asignada para el badge.
- Búsqueda + filtro de fecha sobre `fechaEnvio`, mismo patrón `bandejaFilter.ts`-like
  (se puede reusar o adaptar esa función pura si el filtro es idéntico en forma).
- Tarjeta por expediente: título, `StatusBadge`, investigador, código·fecha, badge de
  asignación, "Asignar evaluador ›" / "Ver asignación ›" → navega a
  `/(coordinador)/asignacion/[id]`.

### 2. Asignación (`app/(coordinador)/asignacion/[id].tsx`)

- Carga en paralelo: `expedientesService.getById(id)`, `usersService.list()` filtrado a
  `rol === 'evaluador' && activo !== false` (mismo patrón client-side que la web, no
  hay endpoint dedicado de "disponibles"), `evaluacionService.list()` (para calcular
  carga pendiente por evaluador y detectar si este expediente ya tiene asignación).
- Si ya existe evaluación para este expediente: tarjeta verde "Ya asignado" con nombre
  del evaluador, botón único "Volver al panel".
- Si no: lista de evaluadores como filas seleccionables (radio-like, mismo patrón visual
  que el picker de "proyecto de origen" de Cambiar título en Fase 3), ordenados por
  menor carga pendiente primero, con badge "N pendiente(s)". Botón "Asignar" deshabilitado
  hasta seleccionar uno.
- Asignar → `useConfirm()` → `evaluacionService.asignarEvaluador(expedienteId, evaluadorId)`
  → éxito navega de vuelta al Dashboard. Manejo del error 400 "ya tiene evaluador
  asignado" (carrera con otro coordinador) con `ErrorText`, sin crashear.

### 3. Perfil (`app/(coordinador)/perfil.tsx`)

Wrapper de 3 líneas que renderiza `<PerfilScreen />` (de Fase 4, sin cambios) — igual
patrón que `(app)/perfil.tsx` y `(secretaria)/perfil.tsx`.

## Servicios nuevos

- `src/services/evaluacion.service.ts` — **nuevo archivo** (no existía, ningún rol
  anterior lo necesitaba): `list(): Promise<EvaluacionDto[]>` (`GET /evaluacion`),
  `asignarEvaluador(expedienteId, evaluadorId): Promise<AsignarEvaluadorResponse>`
  (`POST /evaluacion/expediente/:id/asignar`, con el tipo de respuesta correcto descrito
  arriba, no `EvaluacionDto`).
- `src/services/users.service.ts` — ya existe (Fase 3, Task 11), se reutiliza `list()`
  sin cambios para el picker de evaluadores.
- `expedientes.service.ts` — sin cambios, ya tiene todo lo necesario (`list`, `getById`).

## Manejo de errores y estados

Mismo patrón ya establecido: `ApiError` + `ErrorText`, estados `cargando`/`error`/vacío
explícitos, `useConfirm()` antes de asignar, flag `activo` en efectos async,
**`useFocusEffect` en el Dashboard** (no `useEffect` mount-only) para que la lista se
refresque al volver de Asignación — aplicando la lección aprendida en la verificación de
Fase 4 (bug real encontrado: las pantallas no se refrescaban al volver de una acción).

## Testing

Mismo enfoque: tests unitarios si hay lógica pura extraíble (el cálculo de carga
pendiente por evaluador es buen candidato), `tsc --noEmit` limpio por tarea, verificación
manual final en Android real con `coordinador@uch.edu.pe` antes de cerrar la fase.

## Riesgos anotados

- **Carrera de asignación:** dos coordinadores podrían intentar asignar al mismo
  expediente casi simultáneamente. El backend ya lo previene (400 si ya existe
  evaluación) — el móvil solo necesita mostrar ese error con claridad, no prevenirlo
  del lado cliente de forma distinta a como ya lo hace la web (pre-chequeo optimista +
  el backend como fuente de verdad final).
- **Sin endpoint de "evaluadores disponibles":** el filtro es 100% client-side sobre la
  lista general de usuarios — si el número de evaluadores crece mucho, no hay
  paginación en la web tampoco, así que el móvil replica la misma limitación sin
  agravarla.
