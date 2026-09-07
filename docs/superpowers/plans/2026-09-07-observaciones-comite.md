# Plan de implementación: observaciones del Comité (2026-09-07)

Spec de referencia: `docs/superpowers/specs/2026-09-07-observaciones-comite-design.md`.

## Contexto verificado del repo

- Monorepo turborepo: `apps/api` (NestJS 11 + Prisma 6), `apps/web` (React 18 + Vite +
  react-router), `apps/mobile` (Expo Router), `packages/shared`.
- **No hay carpeta `prisma/migrations`**: el repo trabaja con `prisma db push`
  (`apps/api/scripts/db-push-test.js` empuja el schema al schema Postgres `test`;
  producción se empuja aparte). Por tanto "migración nueva" se materializa como
  cambio aditivo en `schema.prisma` + `db push`, no como archivo SQL versionado.
- Tests: unitarios `npm test -w @comite/api` (jest, rootDir `src`, `*.spec.ts`);
  e2e `npm run test:e2e -w @comite/api` (jest-e2e.json, `test/*.e2e-spec.ts`,
  contra Neon schema `test`, verificado conectando OK).
- `ROL_A_MODALIDAD` solo mapea `estudiante_pregrado|estudiante_postgrado|investigador`.
  Los demás roles internos (admin/coordinador/secretaria/evaluador) **no pueden crear
  expedientes** (403 en `create`, con test e2e que lo fija). El "rol interno" del spec
  que sí crea expedientes es `investigador` (modalidad `interno`).
- `ciclo` solo se persiste para modalidad `pregrado` (create/update lo anulan si no).

## Decisiones de diseño (fuera de lo literal del spec)

1. **`tipoProyecto` como `String?` VarChar(20)**, no enum Postgres: el schema entero
   usa strings para `estado`, `modalidad`, `tipoTramite`. Consistencia > tipado en BD.
2. **La preselección por ciclo vive en `packages/shared`** (`tipoProyectoPorCiclo`) y la
   aplica el frontend; el backend **valida** el catálogo pero no fuerza la preselección
   (el usuario puede corregirla, tal como pide el spec: "editable").
3. **Similitud y duplicado exacto se evalúan en `enviar()`**, no en `create()`: al crear
   el expediente todavía es borrador y puede no tener autores; el spec dice
   "al enviar".
4. **Similitud: Levenshtein normalizado sobre el título normalizado**, sin dependencias
   externas. Elegido sobre Jaccard porque detecta títulos casi idénticos con
   variaciones de palabra ("efectos" vs "efecto") que Jaccard trata como tokens
   distintos.
5. **Umbral configurable vía tabla `Configuracion`**, clave `umbral_similitud_titulo`,
   default `0.8` — reusa `ConfigService.leerConfig`, no necesita tabla nueva.
6. **Rechazo automático reusa `no_aprobado`** con motivo textual (duda abierta #3 del
   spec resuelta por el camino menos invasivo: un estado nuevo obligaría a tocar
   badges, filtros y reportes de web+mobile).
7. **`intentos` empieza en 1** y se incrementa en cada reenvío. Estados reenviables:
   `no_aprobado` y `subsanacion`. `aprobado_observaciones` **no** es reenviable (ya
   está aprobado). Tope: no se permite reenviar cuando `intentos >= 3`.
8. **`POST /expedientes/:id/reenviar` es la operación general**; `POST /:id/subsanacion`
   se mantiene (compatibilidad con web/mobile y su e2e) y pasa a delegar en la misma
   lógica, de modo que una subsanación también consume intento.
9. **No se agrega `expedienteOrigenId` nuevo**: ya existe `proyectoOrigenId` (usado por
   cambio de título). El reenvío es sobre el MISMO expediente, así que no necesita
   vínculo nuevo; el "vínculo al original" del spec se cubre con `intentos` + historial.

## Tareas

Cada tarea: test que falla → implementación mínima → test pasa → commit.

### T1 — Catálogos compartidos (`TIPO_PROYECTO`)
- `packages/shared/src/constants.ts`: `TIPO_PROYECTO`, `TIPOS_PROYECTO`,
  `TIPO_PROYECTO_LABEL`, `tipoProyectoPorCiclo(ciclo)`, `MAX_INTENTOS_REENVIO = 3`,
  `ESTADOS_REENVIABLES`, `UMBRAL_SIMILITUD_TITULO_DEFAULT = 0.8`,
  `CLAVE_UMBRAL_SIMILITUD`.
- `packages/shared/src/similitud.ts` (nuevo): `normalizarTexto`, `similitudTitulos`,
  `normalizarNombreAutor`. Re-exportado en `index.ts`.
- `packages/shared/src/types.ts`: `TipoProyecto`, campos nuevos en `ExpedienteDto`.
- `apps/api/src/expedientes/catalogos.ts`: re-exportar los nuevos.
- Test: `apps/api/test/similitud.e2e-spec.ts` (unitario puro, corre con el runner e2e
  que ya existe) cubriendo normalización, casos idénticos/similares/distintos y
  `tipoProyectoPorCiclo`.
- Commit: `feat(shared): catalogo TIPO_PROYECTO y utilidades de similitud de titulos`.

### T2 — Schema Prisma: `tipoProyecto` + `intentos`
- `apps/api/prisma/schema.prisma`: en `Expediente` agregar
  `tipoProyecto String? @map("tipo_proyecto") @db.VarChar(20)` e
  `intentos Int? @default(1)`.
- `node scripts/db-push-test.js` para el schema `test`; documentar que producción
  requiere el mismo push.
- Commit: `feat(db): campos tipo_proyecto e intentos en expedientes`.

### T3 — Backend: `tipoProyecto` en create/update/respuesta/catálogos
- `dto/create-expediente.dto.ts` y `dto/update-expediente.dto.ts`: `tipoProyecto?`.
- `expedientes.service.ts`: validar contra `TIPOS_PROYECTO` (400 si inválido),
  persistir en `create`/`update`, exponer en `toResponse`, y agregar
  `tiposProyecto` + `tipoProyectoPorCiclo` a `getCatalogos`.
- Test e2e: `apps/api/test/observaciones-comite.e2e-spec.ts` (describe "tipoProyecto").
- Commit: `feat(api): campo tipoProyecto en expedientes (observacion 1)`.

### T4 — Backend: duplicado exacto + alerta de similitud en `enviar`
- `expedientes.service.ts`:
  - `buscarDuplicadoExacto(exp)`: título normalizado + set de autores normalizados +
    ciclo + facultad + programa, contra expedientes activos de otro id.
  - `buscarSimilares(exp, umbral)`: sobre expedientes activos, devuelve los que
    superan el umbral.
  - En `enviar()`: primero duplicado exacto → `no_aprobado` + notificación al dueño +
    historial; devuelve `{ rechazoAutomatico: true, duplicadoDeId }`. Si no,
    continúa el flujo normal y, si hay similares, notifica a **todas** las
    secretarias y deja fila en `HistorialExpediente` (sin cambiar estado).
- Tests e2e en el mismo archivo (describes "duplicado exacto" y "alerta de similitud").
- Commit: `feat(api): rechazo por duplicado exacto y alerta de titulo similar (observaciones 2 y 3)`.

### T5 — Backend: reenvío con tope de 3 intentos + "mis rechazados"
- `dto/reenviar.dto.ts` (nuevo): `observaciones: string` (no vacío).
- `expedientes.service.ts`: `getMisRechazados(user)`, `reenviar(id, dto, user)`;
  `submitSubsanacion` delega en la misma lógica interna.
- `expedientes.controller.ts`: `GET /expedientes/mis-rechazados` (antes de `:id`) y
  `POST /expedientes/:id/reenviar`.
- Tests e2e (describe "reenvío"): reenvía 1→2→3, al tercer rechazo bloquea con 400,
  y `mis-rechazados` lista con `puedeReenviar`/`intentos`/`observaciones`.
- Commit: `feat(api): reenvio de expedientes rechazados con tope de 3 intentos (observacion 4)`.

### T6 — Web: tipos + servicio
- `apps/web/src/types/api.ts`: reexportar/añadir `tipoProyecto`, `intentos`,
  `ExpedienteRechazadoDto`.
- `apps/web/src/services/expedientes.service.ts`: `getMisRechazados`, `reenviar`,
  `tipoProyecto` en payloads.
- Commit: `feat(web): tipos y servicio para tipoProyecto y reenvio`.

### T7 — Web: selector de tipo de proyecto en el formulario
- `apps/web/src/pages/NuevoProyecto.tsx`: select "Tipo de proyecto" (móvil y
  escritorio), preseleccionado por ciclo salvo que el usuario ya haya tocado el campo.
- `apps/web/src/pages/DetalleProyecto.tsx`: mostrarlo.
- Commit: `feat(web): selector de tipo de proyecto con preseleccion por ciclo`.

### T8 — Web: vista "Mis proyectos rechazados"
- `apps/web/src/pages/ProyectosRechazados.tsx` (nuevo), ruta `/rechazados` en
  `App.tsx`, entrada en `components/navConfig.ts`.
- Commit: `feat(web): vista "Mis proyectos rechazados" con reenvio`.

### T9 — Mobile: paridad
- `apps/mobile/src/types/api.ts`, `apps/mobile/src/services/expedientes.service.ts`,
  selector en `app/(app)/nuevo/index.tsx`, pantalla `app/(app)/rechazados.tsx`,
  entrada de navegación.
- Commit: `feat(mobile): tipo de proyecto y vista de proyectos rechazados`.

### T10 — Verificación final
- `npm run test:e2e -w @comite/api`, `npm test -w @comite/api`, `npm run build`.
- Commit final si hubo correcciones.
