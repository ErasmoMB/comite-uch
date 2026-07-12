# App Móvil Expo — Fase 4: Rol Secretaría Técnica — Design

## Contexto

La Fase 3 (ver `2026-07-12-fase3-mobile-expo-solicitante-design.md`) construyó `apps/mobile`
cubriendo únicamente el rol Solicitante/Investigador (3 sub-roles auto-registrables), verificado
E2E en Android real. Esta fase agrega el primer rol interno: **Secretaría técnica**, el siguiente
eslabón lógico del flujo real de un trámite (Solicitante envía → **Secretaría admite o devuelve** →
Coordinador asigna evaluador → Evaluador califica → Admin administra/reporta).

Los otros 3 roles internos (Coordinador, Evaluador, Administrador) quedan **fuera de alcance**
de esta fase — se abordarán uno por uno en fases posteriores, con su propio ciclo
spec → plan → construcción → verificación, siguiendo el mismo patrón que esta fase.

## Alcance

**4 pantallas** (equivalentes 1:1 a `apps/web/src/pages/secretaria/*` + el `Perfil.tsx` compartido):

1. **Bandeja** (`/secretaria/bandeja` en web) — lista de expedientes en estados
   `enviado` / `en_revision` / `subsanacion`.
2. **Revisión de expediente** (`/secretaria/revision/:id`) — autores, documentos, bitácora +
   historial, y las dos acciones de transición de estado.
3. **Chat — bandeja de conversaciones** (`/secretaria/chat`) — lista de solicitantes con
   mensajes, hilo individual, "+ Nuevo" para iniciar conversación.
4. **Perfil** — generalizar la pantalla ya existente (hoy solo tiene la rama Solicitante) para
   incluir la rama de rol interno.

**Fuera de alcance de este corte** (mismas razones que Fase 3, o nuevas explicadas abajo):
- Notificaciones (la propia web tampoco las usa en ninguna pantalla de Secretaría).
- Visor de documentos embebido (PDF/imagen dentro de la app) — ver decisión de diseño abajo.
- El endpoint `GET /chat/no-leidos` (badge total de no leídos) — existe en el backend pero
  **ninguna pantalla de la web lo usa tampoco** hoy; no se inventa una funcionalidad que ni el
  propio web tiene.
- Registro/auto-registro de secretaría — no aplica, los roles internos los crea el admin
  (confirmado en memoria del proyecto), la pantalla de Registro no cambia.
- Persistencia real de las "observaciones" al devolver un expediente — el backend actual
  (`PUT /expedientes/:id`) **no guarda ese texto en ningún lado** (limitación ya documentada en
  el propio código web, `Revision.tsx:120-123`). El móvil replica el mismo comportamiento de la UI
  (pide el texto, lo valida) sin inventar persistencia que la web tampoco tiene.

## Decisión de arquitectura 1 — Navegación por rol

**Problema:** hoy `app/(app)/_layout.tsx` asume que cualquier usuario logueado es Solicitante y
monta un Tab navigator con 5 pestañas (Inicio/Proyectos/Nuevo/Consultas/Perfil). Con Secretaría
entrando, cada rol necesita ver solo sus propias pestañas (Secretaría: Bandeja/Chat/Perfil — 3,
calcado de `navConfig.ts` del web).

**Decisión: grupos de rutas separados por rol, NO un layout único con tabs condicionales.**

- El grupo `(app)/` existente **se queda intacto y sin renombrar** — sigue siendo el grupo del
  Solicitante tal cual está hoy (ya construido, revisado y verificado en dispositivo real en
  Fase 3). Renombrarlo a `(solicitante)/` sería puro trabajo de migración sin beneficio
  funcional y arriesgaría romper algo que ya funciona — se evita deliberadamente.
- Se agrega un grupo **nuevo y hermano**: `app/(secretaria)/`, con su propio `_layout.tsx`
  (guardia de sesión + Tabs de 3 pestañas: Bandeja / Chat / Perfil).
- `app/index.tsx` (la redirección raíz tras hidratar la sesión) deja de asumir un único destino
  y calcula el grupo según el rol del usuario, usando una función local
  `homeGroupForRole(rol)` en `src/lib/` (nombre distinto a `homePathForRole` de `@comite/shared`,
  que devuelve rutas *web*, no aplican 1:1 a la estructura de grupos de Expo Router — se escribe
  una versión propia para móvil, extensible cuando se agreguen Coordinador/Evaluador/Admin).
- `login.tsx` usa la misma función tras un login exitoso, en vez de `router.replace('/(app)')`
  a secas.
- Cada `_layout.tsx` de grupo (tanto `(app)/` como el nuevo `(secretaria)/`) válida que el
  `usuario.rol` corresponda a su grupo — si no, redirige a `homeGroupForRole(usuario.rol)` en vez
  de mostrar contenido equivocado (protege contra que alguien navegue a mano a una URL que no le
  corresponde).

## Decisión de arquitectura 2 — Ver/descargar documentos

**Problema:** la web usa un modal con `<iframe>`/`<img>` sobre una Blob URL para previsualizar
PDFs/imágenes dentro de la página. React Native no tiene ese modelo (no hay iframe, no hay Blob
URL de navegador).

**Decisión: sin visor embebido en este corte — descargar y delegar al visor nativo del celular.**

- "Ver" y "Descargar" (los dos botones que hoy existen en la web) se colapsan en un solo botón
  **"Abrir"** en móvil: descarga el archivo autenticado (con el token Bearer) a almacenamiento
  temporal del dispositivo vía `expo-file-system`, y abre el selector nativo "Abrir con…" (share
  sheet de Android) para que el usuario lo vea con la app que ya tenga instalada (visor de PDF,
  Google Drive, galería, etc.).
- Esto es sustancialmente más simple y confiable que construir un visor propio (que requeriría
  librerías nuevas tipo `react-native-pdf` y manejo de más casos borde), y logra el mismo
  resultado práctico para el usuario.
- Nueva utilidad: `src/lib/documentDownload.ts` — `abrirDocumento(url, nombreArchivo): Promise<void>`,
  usa `expo-file-system` (`downloadAsync` con el header `Authorization` real, no un fetch suelto)
  + `expo-sharing` (`shareAsync`) para invocar el selector nativo. Ambas librerías no están
  instaladas todavía — se agregan en la tarea de scaffold de esta fase.

## Pantallas — detalle

### 1. Bandeja (`app/(secretaria)/index.tsx`)

- Carga `expedientesService.list()` (ya existe, sin cambios) → filtra client-side a
  `['enviado', 'en_revision', 'subsanacion']` (igual que la web — el backend no soporta filtrar
  por estado en el query).
- Búsqueda por texto (título/código/nombre investigador) + filtro de fecha `fechaEnvio`
  (mismo patrón `Input` con placeholder `AAAA-MM-DD` que ya se usó en Proyectos del Solicitante).
- Tarjeta por expediente: título, `StatusBadge`, nombre investigador, código, fecha de envío.
- Tap → `/(secretaria)/revision/[id]`.
- Reutiliza: `Card`, `StatusBadge`, `Screen`, `Input`, `Field`, `ErrorText`, `Loading` de `ui.tsx`
  (sin componentes nuevos).

### 2. Revisión de expediente (`app/(secretaria)/revision/[id].tsx`)

- Carga en paralelo (`Promise.all`, cada uno con `.catch(() => [])` como ya hace `getDetalle`):
  expediente, bitácora, historial, documentos — reutiliza `expedientesService.getDetalle(id)` tal
  cual (ya trae las 4 llamadas).
- Secciones: header (código + `StatusBadge` + título), Autores (lista simple), Documentos
  (nombre + tipo + botón "Abrir" vía `documentDownload.ts`), Bitácora/Historial (feed de solo
  lectura, mismo orden no-intercalado que la web — no se "arregla" ese detalle, se replica), y un
  `TextArea` de observaciones (solo se habilita/exige al pulsar "Devolver").
- Acciones: **"Admitir expediente"** (`useConfirm` → `expedientesService.update(id, { estado:
  'en_revision' })` → vuelve a la bandeja) y **"Devolver para subsanar"** (valida observaciones no
  vacío → `useConfirm` → `expedientesService.update(id, { estado: 'subsanacion' })` → vuelve a la
  bandeja). Ambas reutilizan `expedientesService.update` (ya existe, sin cambios).
- No se necesita ningún servicio nuevo para esta pantalla — todo ya existe en
  `expedientes.service.ts` de Fase 3.

### 3. Chat — bandeja (`app/(secretaria)/chat/index.tsx` + `app/(secretaria)/chat/[solicitanteId].tsx`)

A diferencia de la web (que alterna lista/hilo con estado local dentro de un mismo componente),
el móvil usa **dos pantallas de stack** — más idiomático en Expo Router y evita reconstruir a mano
la navegación atrás/adelante que un `Stack` ya da gratis:

- **Lista** (`chat/index.tsx`): `chatService.getConversaciones()`, poll cada 10s (igual que web).
  Tarjeta por conversación: iniciales, nombre, preview del último mensaje, badge de no leídos,
  hora. Botón "+ Nuevo" → abre un picker (lista simple con `Pressable`, mismo patrón que el
  selector de "proyecto de origen" de Cambiar título en Fase 3) sobre `chatService.getSolicitantes()`
  (lazy, cacheado en estado tras el primer fetch). Tap en conversación o al iniciar una nueva →
  navega a `chat/[solicitanteId]`.
- **Hilo** (`chat/[solicitanteId].tsx`): calcado de `Consultas.tsx` (Fase 3) en estructura
  (burbujas, polling, `KeyboardAvoidingView`, auto-scroll), pero: poll cada 4s vía
  `chatService.getHiloDeSolicitante(id)`, envío vía `chatService.enviarComoSecretaria(id, texto)`,
  y `esMio(m)` se simplifica a leer `m.esDeSecretaria` directo (no hace falta comparar contra
  `usuario.id` como en el lado solicitante). Volver (`‹`) navega al stack anterior (la lista).
- Nuevo `src/services/chat.service.ts` — **se amplía** (no se reemplaza) el archivo ya existente
  de Fase 3 agregando el lado secretaría: `getConversaciones`, `getSolicitantes`,
  `getHiloDeSolicitante`, `enviarComoSecretaria`. El lado solicitante (`getMiHilo`,
  `enviarComoSolicitante`, `misNoLeidos`) no se toca.

### 4. Perfil — generalización (`app/(app)/perfil.tsx` existente se generaliza, sin mover archivos)

La pantalla de Perfil de Fase 3 hoy vive en `app/(app)/perfil.tsx` y solo tiene la rama
Solicitante. Con dos grupos de rutas (`(app)` y `(secretaria)`), Perfil debe:

- Convertirse en un **componente compartido** `src/components/screens/PerfilScreen.tsx` que
  recibe la lógica de datos ya resuelta (o decide la rama internamente por `usuario.rol`, igual
  que hace la web en un único archivo) — no se duplica el archivo entero por grupo.
- Ambos `app/(app)/perfil.tsx` y `app/(secretaria)/perfil.tsx` quedan como archivos-ruta finos que
  simplemente renderizan `<PerfilScreen />`.
- Rama nueva (rol interno, calcada de la web `Perfil.tsx` rama `else`): `expedientesService.list()`
  → stats "Enviados" (`enviado`|`en_revision`) y "Aprobados" (`aprobado`|`aprobado_observaciones`),
  + "Expedientes vinculados" (total). Mismo botón "Cerrar sesión" ya existente.

## Servicios y librerías nuevas

- `expo-file-system` + `expo-sharing` — nuevas dependencias del workspace `@comite/mobile`.
- `src/lib/documentDownload.ts` — nuevo, descrito arriba.
- `src/lib/roles.ts` — nuevo, exporta `homeGroupForRole(rol): string`, mapea rol → grupo de rutas
  móvil (`/(app)` para los 3 sub-roles solicitante, `/(secretaria)` para secretaría; se amplía en
  fases futuras con coordinador/evaluador/admin).
- `src/services/chat.service.ts` — ampliado con las 4 funciones del lado secretaría.
- `expedientes.service.ts`, `users.service.ts`, `config.service.ts` — **sin cambios**, ya cubren
  todo lo que Secretaría necesita.

## Manejo de errores y estados

Mismo patrón ya establecido en Fase 3 en todas las pantallas nuevas: `ApiError` capturado y
mostrado con `ErrorText`, estados `cargando`/`error`/vacío explícitos, `useConfirm()` antes de
cualquier acción irreversible (admitir/devolver), `activo` flag en efectos async para evitar
`setState` tras desmontar.

## Testing

Mismo enfoque que Fase 3: tests unitarios donde hay lógica portable (p. ej. el filtro de Bandeja,
si se extrae a función pura), `tsc --noEmit` limpio en cada tarea, y una verificación manual final
en Android real contra la API real con una cuenta `secretaria@uch.edu.pe` antes de dar la fase por
cerrada (mismo patrón de la Task 12 de Fase 3).

## Riesgos anotados

- **Descarga de documentos real:** esta fase SÍ implementa descarga real (a diferencia de Fase 3,
  que dejó la subida de documentos sin integrar). Es la primera vez que `apps/mobile` toca
  filesystem nativo — vale la pena una verificación cuidadosa en dispositivo real de que el
  header `Authorization` llega correctamente a `expo-file-system.downloadAsync` (algunas versiones
  requieren pasarlo distinto que un `fetch` normal).
- **Grupos de rutas duplicados:** con `(app)/` y `(secretaria)/` como hermanos, hay que verificar
  que Expo Router no intente montar ambos a la vez o que el guard de cada layout no cause loops de
  redirección entre sí — cubrir explícitamente este caso en la tarea de scaffold/navegación.
