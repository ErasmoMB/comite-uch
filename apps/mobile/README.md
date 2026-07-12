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

**Fuera de alcance (deliberado):**
- Subida real de archivos con cámara/galería (`expo-image-picker`). La interfaz de
  servicio ya está lista (`registrarDocumento`/`uploadDocumento`), marcada con
  `// TODO Fase posterior`, pero sin integrar el picker nativo todavía.
- El **recorrido manual del checklist E2E en un emulador o dispositivo Android real**
  (Task 12, Step 2 del plan de build) queda pendiente: requiere un entorno con
  Android Studio/emulador o un dispositivo físico con Expo Go, que no está disponible
  en el entorno donde se generó este build. Debe ejecutarlo alguien con acceso a un
  dispositivo/emulador antes de dar por cerrada la verificación E2E final.
