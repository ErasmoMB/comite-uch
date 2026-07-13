# App Móvil Expo — Fase 7: Rol Administrador — Design

## Contexto

Última fase de la app móvil: con Administrador quedan cubiertos los 7 roles del sistema.
Continúa de Fase 6 (Evaluador, cerrada). El Administrador es el rol más orientado a
escritorio (gestión de usuarios + reportes), pero la exploración del código real reveló
que es más chico y portable de lo esperado: **4 pantallas**, y una (Perfil) ya está
resuelta por el `PerfilScreen.tsx` compartido.

## Alcance

**4 pantallas** (3 nuevas + Perfil reutilizado), equivalentes 1:1 a
`apps/web/src/pages/admin/*` + `Reportes.tsx` (compartido) + `Perfil.tsx` (compartido):

1. **Usuarios** (`/admin/usuarios`) — gestión CRUD de usuarios: lista con
   búsqueda/filtro por rol y estado, crear usuario interno (con campos condicionales de
   evaluador), editar rol/activo, desactivar (soft-delete) y eliminar permanente
   (solo roles internos). Es la razón de ser del Administrador en móvil.
2. **Configuración** (`/admin/configuracion`) — fecha límite de envío de proyectos:
   ver/guardar/quitar.
3. **Reportes** (`/admin/reportes`) — 4 tarjetas KPI + 2 gráficos de barras + 1 barra
   apilada + botones de exportación a PDF.
4. **Perfil** — reutiliza el `PerfilScreen.tsx` compartido tal cual (Administrador cae en
   la misma rama de rol interno que Secretaría/Coordinador). **Cero código nuevo**, solo
   un wrapper de ruta.

**Fuera de alcance de este corte:**
- Bandeja/revisión de expedientes y chat para admin: la web del admin NO expone esas
  pantallas (aunque el backend técnicamente se lo permitiría por ser rol "ve todo") —
  un port 1:1 significa que el admin NO tiene esas pantallas en móvil.
- Los endpoints `/reportes/*` que la web tiene en el servicio pero NINGUNA pantalla usa
  (`expedientes-por-estado`, `tiempos-atencion`, `carga-evaluadores`,
  `resultados-emitidos`, `buscar-expedientes`) — la pantalla de Reportes solo consume
  `GET /reportes/resumen`, que agrega todo lo que necesita. No se portan los demás.

## Decisiones tomadas (aplicando recomendaciones, sin dependencias nuevas)

**1) Gráficos de Reportes: `<View>` nativos proporcionales, SIN librería de charts.**
La web NO usa recharts/chart.js/d3 — sus "gráficos" son componentes hechos a mano
(`HBarChart`, `StackedHBarChart`) con `<div>` de ancho proporcional (`width: N%`). Se
reproducen en React Native con `<View style={{ width: '<pct>%' }}>` de forma directa y
más liviana que integrar `victory-native`/`react-native-svg`. Los tooltips de hover son
no-op en táctil (se muestra el valor siempre). **No se agrega ninguna dependencia de
charts.**

**2) Fecha límite (Configuración): input de texto enmascarado `AAAA-MM-DD`, NO un date
picker nativo.** Consistente con cómo TODAS las fechas se ingresan hoy en la app móvil
(los filtros de fecha de Bandeja/Dashboard/Proyectos usan `Input` con placeholder
`AAAA-MM-DD`). Evita agregar `@react-native-community/datetimepicker` como dependencia
nueva. Se valida el formato antes de guardar.

**3) Exportación a PDF: se incluye, reutilizando `documentDownload.ts` (Fase 4).** Los 3
botones de exportar (`GET /reportes/exportar?tipo=expedientes|evaluaciones`,
`GET /reportes/exportar-reporte`) descargan un PDF autenticado y lo abren con el share
sheet nativo — mismo mecanismo ya usado por Secretaría/Evaluador para documentos. Cero
esfuerzo nuevo de plumbing.

## Hallazgos técnicos (de la exploración del código real)

- `users.service.ts` y `config.service.ts` **ya existen** en el móvil (portados en Fase 3
  Task 11) con todo lo necesario: `list`/`getById`/`create`/`update`/`deactivate`/
  `eliminarPermanente` y `getFechaLimite`/`setFechaLimite`. Se reutilizan **sin cambios**.
  Solo hace falta un servicio nuevo: `reportes.service.ts` (`resumen()` + helpers de URL
  de exportación).
- No hay dashboard/landing de admin — la pestaña por defecto es Usuarios.
- Mismatch conocido de validación de password: la web valida ≥8 caracteres pero el
  backend solo exige ≥6. Se replica la validación de la web (≥8) en el móvil por
  consistencia con la web, sin relajarla.
- El formulario de crear usuario del admin solo setea campos de evaluador
  (`especialidad`, `cargaTrabajo`) condicionalmente; NO setea `laboratorio` ni
  `codigoEstudiante` (aunque existen en `UserDto`). Se replica igual.

## Decisión de arquitectura — mismo patrón que Fases 4/5/6

Nuevo grupo de rutas hermano `app/(administrador)/`, con su propio `_layout.tsx`
(guard de sesión + Tabs de **4** pestañas: Usuarios / Config / Reportes / Perfil). Se
amplía `src/lib/roles.ts` → `homeGroupForRole` agregando
`administrador → '/(administrador)'` (y el tipo `HomeGroup` gana su valor final). **Tras
esta fase NINGÚN rol cae ya en `/rol-no-disponible`** — esa pantalla se conserva igual
como fallback defensivo por si aparece un rol futuro/desconocido, pero deja de ser
alcanzable por los 7 roles actuales. Los grupos existentes quedan intactos.

## Pantallas — detalle

### 1. Usuarios (`app/(administrador)/index.tsx`)
- `usersService.list(0, 200)` → lista; filtros client-side: búsqueda (nombre/email),
  dropdown de rol (dinámico según roles presentes), dropdown de estado
  (Todos/Activos/Inactivos), "Limpiar". `useFocusEffect` para refrescar tras crear/editar.
- Crear usuario: formulario (nombre/apellido/email/password/rol interno + especialidad y
  cargaTrabajo si evaluador), validaciones idénticas a la web (todos requeridos,
  password ≥8, especialidad requerida si evaluador). `usersService.create(...)`.
- Editar (por fila, en móvil probablemente un modal/sheet en vez de edición inline):
  cambiar rol + toggle activo → `usersService.update(id, {rol, activo})`.
- Desactivar (soft) → `useConfirm()` → `usersService.deactivate(id)`; bloqueado sobre la
  propia cuenta.
- Eliminar permanente (solo roles internos) → `useConfirm()` con advertencia →
  `usersService.eliminarPermanente(id)`; bloqueado sobre la propia cuenta.
- Reutiliza `Card`, `StatusBadge`/`Badge`, `Screen`, `Input`, `Field`, `Button`,
  `ErrorText`, `Loading`, el patrón `Selector`-píldora para el dropdown de rol/estado, y
  `useConfirm`.

### 2. Configuración (`app/(administrador)/configuracion.tsx`)
- `configService.getFechaLimite()` → muestra la fecha actual o "sin configurar".
- `Input` `AAAA-MM-DD` + validación de formato + "Guardar"
  (`configService.setFechaLimite(fecha)`) y "Quitar fecha límite"
  (`configService.setFechaLimite(null)`). Mensajes de éxito/error.

### 3. Reportes (`app/(administrador)/reportes.tsx`)
- `reportesService.resumen()` (nuevo servicio) → `GET /reportes/resumen` con la forma
  `ResumenReporte` (`{expedientes:{total,porEstado}, evaluadores:{...}, cargaEvaluadores:[],
  resultados:[]}`).
- 4 tarjetas KPI (Expedientes totales, Evaluadores, Carga promedio, Carga máxima).
- 2 gráficos de barras horizontales nativos (`HBarChart` RN): "Expedientes por estado" y
  "Carga por evaluador".
- 1 barra apilada nativa (`StackedHBarChart` RN): "Resultados emitidos" con leyenda.
- 3 botones de exportar PDF vía `abrirDocumento(url)` (reutiliza `documentDownload.ts`).
- Nuevos componentes RN chart: `src/components/charts/HBarChart.tsx` y
  `StackedHBarChart.tsx` (barras proporcionales con `<View>`, sin librería).

### 4. Perfil (`app/(administrador)/perfil.tsx`)
Wrapper de 3 líneas que renderiza `<PerfilScreen />` (sin cambios), igual que
`(coordinador)/perfil.tsx`.

## Servicios nuevos
- `src/services/reportes.service.ts` — `resumen(): Promise<ResumenReporte>` +
  `urlExportar(tipo)` / `urlExportarReporte()` (helpers de URL para `abrirDocumento`).
  Tipo `ResumenReporte` propio si `@comite/shared` no lo expone con la forma real.
- `users.service.ts`, `config.service.ts` — **sin cambios**, ya cubren todo.

## Manejo de errores y estados
Mismo patrón establecido: `ApiError` + `ErrorText`, `useConfirm()` antes de
desactivar/eliminar, estados `cargando`/`error`/vacío, `useFocusEffect` en Usuarios,
`useSafeAreaInsets` en headers custom, `Screen` para scroll (Reportes y Usuarios pueden
ser largos).

## Testing
Lógica pura extraíble a función testeada donde aplique (filtro de usuarios, cálculo de
porcentajes de las barras). `tsc --noEmit` limpio por tarea. Verificación manual final
en Android real con `admin@uch.edu.pe`.

## Riesgos anotados
- **Exportación PDF vía blob:** los endpoints de exportar devuelven un PDF; verificar en
  E2E que `abrirDocumento` (que ya maneja auth + share sheet) funciona con estos
  endpoints igual que con los de documentos (posible 302 a URL firmada o buffer directo,
  igual que rúbrica/dictamen del evaluador — mismo camino).
- **Formulario de creación de usuario:** es el formulario más grande del admin;
  la tarea puede partirse si su complejidad lo amerita al planificar.
- **Cierre del proyecto móvil:** con esta fase se cubren los 7 roles. Tras ella, revisar
  si conviene un repaso final de consistencia global (navegación entre los 5 grupos de
  rutas, que ningún rol quede sin hogar) antes del cierre definitivo.
