# @comite/mobile

App Expo (React Native) del portal del solicitante — Comité de Ética UCH. Consume la
misma API (`apps/api`, NestJS + Supabase) que `apps/web`, replicando sus flujos para
un cliente móvil Android.

## Requisitos

- Node.js y npm (ver `packageManager` en el `package.json` raíz del monorepo).
- Para correr en Android: [Expo Go](https://expo.dev/go) en un dispositivo físico, o
  un emulador Android (Android Studio) con Google Play Services / API 33+.

## Arranque

Desde la **raíz del monorepo** (`comite/`), no desde `apps/mobile/`:

```bash
# 1) Instalar dependencias de todos los workspaces
npm install

# 2) Compilar el paquete compartido de tipos/DTOs (requerido antes de levantar la API o mobile)
npm run build -w @comite/shared

# 3) Terminal 1: levantar la API real (NestJS + Supabase)
npm run dev -w @comite/api

# 4) Terminal 2: levantar Expo
npm run dev -w @comite/mobile
```

Con Expo corriendo, presiona `a` para abrir en un emulador Android conectado, o
escanea el QR con la app **Expo Go** desde un dispositivo físico en la misma red.

## Variable de entorno: `EXPO_PUBLIC_API_URL`

Copia `apps/mobile/.env.example` a `apps/mobile/.env` y ajusta la URL según cómo vayas
a correr la app (`.env`/`.env.*` están en `.gitignore`; solo se versiona `.env.example`):

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:8002
```

- **Emulador Android**: usa `10.0.2.2`, que es la dirección especial que el emulador
  traduce al `localhost` de la máquina host (donde corre `apps/api`, puerto `8002`).
- **Dispositivo físico** (Expo Go): `localhost`/`10.0.2.2` no aplican. Usa la IP LAN
  de la máquina que corre `apps/api`, por ejemplo `http://192.168.1.20:8002`, y
  asegúrate de que el dispositivo esté en la misma red Wi-Fi y que el firewall del
  host permita conexiones entrantes al puerto `8002`.

## Estructura

- `app/` — rutas de `expo-router`: `login`, `registro`, `registro-exito`, `recuperar`,
  `acerca` fuera del grupo autenticado; y dentro de `app/(app)/` el dashboard
  (`index`), `proyectos/` (lista y detalle `[id]`), `nuevo/` (wizard y éxito),
  `cambiar-titulo`, `consultas` y `perfil`, todos detrás de `_layout.tsx`.
- `app/(secretaria)/` — grupo del rol Secretaría técnica (guard de sesión + Tabs de
  3 pestañas): `index` (Bandeja de expedientes), `chat/` (lista `index` y hilo
  `[solicitanteId]`), `perfil`, más la ruta oculta `revision/[id]`. La redirección
  post-login elige el grupo según el rol (`src/lib/roles.ts` → `homeGroupForRole`).
- `app/(coordinador)/` — grupo del rol Coordinador (guard de sesión + Tabs de
  2 pestañas): `index` (Panel de coordinación / Dashboard) y `perfil`, más la ruta
  oculta `asignacion/[id]` (Asignar evaluador, se llega solo tocando un expediente
  del Dashboard). La redirección post-login elige el grupo según el rol
  (`src/lib/roles.ts` → `homeGroupForRole`).
- `app/(evaluador)/` — grupo del rol Evaluador (guard de sesión + Tabs de
  2 pestañas): `index` (Bandeja de evaluaciones) y `perfil`, más la ruta oculta
  `evaluacion/[id]` (rúbrica de 7 criterios + 3 acciones + descarga de PDFs, se
  llega solo tocando una fila de la Bandeja). La redirección post-login elige el
  grupo según el rol (`src/lib/roles.ts` → `homeGroupForRole`).
- `src/components/` — UI base (`ui.tsx`), `Avatar`, `TopBar`, `DocumentoCard`.
- `src/data/` — tipos de dominio (`EstadoProyecto`, `Proyecto`, `Autor`,
  `Observacion`, etc.), espejo de `apps/web/src/data/types.ts`.
- `src/lib/` — capa base: `http.ts` (cliente HTTP con manejo de token y 401),
  `dates.ts`, `mappers.ts`, `documentFormats.ts`, `theme.ts`.
- `src/services/` — un servicio por dominio: `auth`, `expedientes`, `chat`,
  `notificaciones`, `users`, `config` (mismos endpoints que `apps/web`).
- `src/state/` — `AppContext` (sesión/hidratación) y `ConfirmContext`.
- `src/types/` — DTOs re-exportados desde `@comite/shared`.

## Alcance de este corte

**Incluido:**
- Las 13 pantallas del spec del solicitante (login, registro y su pantalla de éxito,
  recuperar contraseña, acerca de, dashboard, proyectos y su detalle, wizard de nuevo
  proyecto y su pantalla de éxito, cambiar título, consultas/chat y perfil).
- Los 6 servicios del spec (auth, notificaciones, expedientes, chat, users, config)
  contra la API real.
- Sesión persistente vía `expo-secure-store`, manejo de 401 (redirige a login) y
  polling de consultas/chat.
- Rol **Secretaría técnica**: Bandeja (lista/búsqueda/filtro de fecha), Revisión de
  expediente (autores, documentos con apertura nativa vía `expo-file-system` +
  `expo-sharing`, bitácora/historial, Admitir/Devolver), Chat (lista + hilo) y Perfil
  con la rama de rol interno. Navegación por rol vía grupos de rutas separados.
- Rol **Coordinador**: Dashboard (4 stats + lista de expedientes en revisión con
  búsqueda/filtro de fecha y badge de asignación), Asignación de evaluador (picker
  ordenado por menor carga pendiente, regla de 1 evaluador por expediente, manejo
  del 400 de carrera) y Perfil con la rama de rol interno. Servicio nuevo
  `evaluacion.service.ts` (`list` + `asignarEvaluador` con respuesta correctamente
  tipada). El Dashboard usa `useFocusEffect` para refrescarse al volver de Asignación.
- Rol **Evaluador**: Bandeja de evaluaciones (lista de las evaluaciones
  asignadas con búsqueda/filtro de fecha reutilizando `expedienteListFilter`,
  N+1 `getById` por fila, badges Completada/Pendiente/Conflicto, `useFocusEffect`),
  Evaluación (rúbrica de 7 criterios con selector de puntaje tipo píldora +
  observación por criterio, preview en vivo de puntaje/resultado, documentos con
  apertura nativa vía `documentDownload.ts`, y 3 acciones: Guardar avance —solo
  observaciones—, Enviar evaluación con validación/confirmación, Declarar
  conflicto; modo solo-lectura con descarga de rúbrica/dictamen —el dictamen
  solo cuando el resultado es aprobado/aprobado con observaciones—) y Perfil con
  su propia rama (stats Pendientes/Completadas desde `misEvaluaciones()`).
  Se amplió `evaluacion.service.ts` con `misEvaluaciones`/`getById`/`getRubrica`/
  `guardarAvance`/`enviarEvaluacion`/`declararConflicto`, tipados contra la forma
  real de la API (`EvaluacionDetalleDto`, NO el `EvaluacionDto` compartido).

**Fuera de alcance (deliberado):**
- Subida real de archivos con cámara/galería (`expo-image-picker`). La interfaz de
  servicio ya está lista (`registrarDocumento`/`uploadDocumento`), marcada con
  `// TODO Fase posterior`, pero sin integrar el picker nativo todavía.
- El **recorrido manual del checklist E2E en un emulador o dispositivo Android real**
  (Fase 3, Task 12 Step 2 del plan de build) queda pendiente: requiere un entorno con
  Android Studio/emulador o un dispositivo físico con Expo Go, que no está disponible
  en el entorno donde se generó este build. Debe ejecutarlo alguien con acceso a un
  dispositivo/emulador antes de dar por cerrada la verificación E2E final.
- El **recorrido manual del checklist E2E del rol Secretaría en Android real**
  (Fase 4, Task 9 Step 3 del plan de build) también queda pendiente por el mismo
  motivo: login directo al grupo `(secretaria)`, Bandeja, Revisión con apertura de
  documentos vía share sheet nativo (verificando que el header `Authorization` llega),
  Admitir/Devolver, Chat (lista + hilo), Perfil, y sobre todo la regresión del flujo
  del Solicitante en `(app)` y el anti-loop de navegación por rol. Debe ejecutarlo
  alguien con acceso a un dispositivo/emulador antes de dar por cerrada la
  verificación E2E de Fase 4.
- El **recorrido manual del checklist E2E del rol Coordinador en Android real**
  (Fase 5, Task 6 Step 3 del plan de build) también queda pendiente por el mismo
  motivo: login directo al grupo `(coordinador)` con sus 2 pestañas, Dashboard
  (stats/lista/badge de asignación/búsqueda y filtro de fecha), Asignación de
  evaluador (picker por menor carga, confirmación, refresco vía `useFocusEffect`
  sin recargar la app, tarjeta de solo lectura si ya está asignado, manejo del 400
  de carrera), Perfil, y las regresiones críticas de Fase 3 (Solicitante) y Fase 4
  (Secretaría) más el caso de rol aún no implementado (`evaluador@uch.edu.pe` /
  `admin@uch.edu.pe`). Debe ejecutarlo alguien con acceso a un dispositivo/emulador
  antes de dar por cerrada la verificación E2E de Fase 5.

  > Nota (Fase 6): a partir de esta fase el rol Evaluador ya está implementado, así
  > que `evaluador@uch.edu.pe` entra a su propio grupo `(evaluador)` en vez de caer
  > en "rol no disponible". Desde Fase 6 en adelante, **solo `admin@uch.edu.pe`**
  > cae en el caso de "rol aún no implementado" al recorrer este checklist.
- El **recorrido manual del checklist E2E del rol Evaluador en Android real**
  (Fase 6, Task 8 Step 3 de este plan) queda pendiente por el mismo motivo:
  login directo al grupo `(evaluador)` con sus 2 pestañas, Bandeja
  (lista/búsqueda/filtro de fecha/badges), Evaluación (rúbrica con selector de
  píldoras, preview en vivo, apertura de documentos y PDFs vía share sheet,
  Guardar/Enviar/Conflicto, modo solo-lectura y fix del botón de dictamen),
  Perfil, y las regresiones de Fases 3/4/5 más el caso del `administrador` (único
  rol ya no implementado). Debe ejecutarlo alguien con acceso a un
  dispositivo/emulador antes de dar por cerrada la verificación E2E de Fase 6.
