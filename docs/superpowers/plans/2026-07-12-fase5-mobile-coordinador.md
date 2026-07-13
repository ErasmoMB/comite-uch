# App Móvil Expo — Fase 5: Rol Coordinador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender `apps/mobile` (app Expo ya construida y verificada para Solicitante en Fase 3 y Secretaría en Fase 4) con el rol interno **Coordinador**: navegación por rol hacia un grupo nuevo `(coordinador)/` de 2 pestañas (Inicio/Perfil) más una ruta oculta de Asignación, equivalentes 1:1 a `apps/web/src/pages/coordinador/*` + el Perfil compartido, consumiendo la misma API NestJS sin tocar `@comite/shared`, `apps/web` ni `apps/api`.

**Architecture:** Se agrega un grupo de rutas hermano `app/(coordinador)/` con su propio `_layout.tsx` (guardia de sesión + Tabs de **2** pestañas: Inicio=`index` / Perfil=`perfil`, más la ruta oculta `asignacion/[id]` sin pestaña). `src/lib/roles.ts` → `homeGroupForRole` gana un cuarto valor `'/(coordinador)'` y saca a `coordinador` del fallback `/rol-no-disponible`. Los grupos `(app)/` (Solicitante) y `(secretaria)/` quedan intactos, sin renombrar. La redirección role-aware ya existente (`app/index.tsx`, `login.tsx`, cada `_layout.tsx`) enruta a coordinador automáticamente por delegar en `homeGroupForRole` — no requieren cambios. Se agrega un servicio nuevo `evaluacion.service.ts` con `list()` y `asignarEvaluador(...)`, este último con un tipo de respuesta propio y correcto (`AsignarEvaluadorResponse`), no `EvaluacionDto`.

**Tech Stack:** Expo SDK 54 (React Native 0.81, React 19.1, Expo Router 6, `typedRoutes` ON), TypeScript 5.7, `expo-secure-store` 15, Jest + `jest-expo` 54, `@comite/shared` (workspace), Turborepo, npm workspaces. **No hay dependencias nuevas en esta fase** (no hay manejo de documentos en Coordinador).

## Global Constraints

- Los grupos `app/(app)/` (Solicitante) y `app/(secretaria)/` **se quedan intactos y sin renombrar** — ya verificados en dispositivo real en Fase 3/4. NO se tocan.
- Se agrega un grupo **nuevo y hermano** `app/(coordinador)/` con **2 pestañas**: Inicio (`index`) / Perfil (`perfil`), más la ruta oculta del tab bar `asignacion/[id]` (se llega solo tocando un expediente en el Dashboard, igual que la web no le da item de navegación propio).
- Roles fuera de alcance de esta fase: Evaluador, Administrador. NO implementarlos — siguen cayendo en `/rol-no-disponible`. `coordinador` **sale** de ese fallback y pasa a su grupo real.
- `src/services/evaluacion.service.ts` es un **archivo NUEVO** (ningún rol anterior lo necesitaba): `list()` + `asignarEvaluador(expedienteId, evaluadorId)`. La respuesta de asignar se tipa con **`AsignarEvaluadorResponse` propio y correcto** (`{ message, evaluacionId, evaluador: { id, nombre, apellido }, expedienteCodigo }`), **NO `EvaluacionDto`** — la API real devuelve `evaluacionId` (no `id`) y no trae `expedienteId`/`completa`/`criterios`.
- `expedientes.service.ts` y `users.service.ts` — **SIN cambios**, ya cubren todo (`list`, `getById`, `evaluadoresDisponibles`).
- **Dashboard usa `useFocusEffect` desde el inicio** (NO `useEffect(...,[])` mount-only): Expo Router `Tabs` mantiene las pantallas montadas, así que al volver de Asignación la lista DEBE refrescarse (lección real de la verificación de Fase 4, commit `2a32d89`). Se copia el patrón ya revisado de `app/(secretaria)/index.tsx` (`cargar` devuelve un cleanup síncrono; `useFocusEffect(useCallback(() => cargar(), [cargar]))`).
- La pantalla Asignación carga por dependencia `[expedienteId]` con `useEffect` — eso está bien (no es el bug de mount-only; se recarga cuando cambia el id).
- **Cualquier header propio (barra superior custom) usa `useSafeAreaInsets()`** y suma `insets.top` a su `paddingTop` (lección de Fase 3, commits `7a8252d`/`ba58bb1`). El Dashboard tiene header custom → aplica. Asignación usa `TopBar` (que ya maneja el safe area internamente).
- **El cuerpo de toda pantalla nueva va envuelto en `Screen`** de `src/components/ui.tsx` (ScrollView con `flex:1` + padding) para que el contenido sea alcanzable al exceder el viewport (lección de Fase 4: 2 bugs de scroll por no envolver en `Screen`).
- `PerfilScreen.tsx` (compartido, Fase 4) requiere **CERO cambios**: coordinador cae en la misma rama interna (`else`) que Secretaría (`esSolicitante === false` → stats Enviados/Aprobados + fila "Expedientes vinculados"). El único archivo nuevo de Perfil es un wrapper de 3 líneas.
- Patrón de estados igual que Fase 3/4: `ApiError` capturado y mostrado con `ErrorText`; estados `cargando`/`error`/vacío explícitos; `useConfirm()` antes de asignar; flag `activo`/`vivo` en efectos async.
- `EstadoExpediente` (DTO) y `EstadoProyecto` (dominio) son el mismo union de 8 valores → `StatusBadge estado={e.estado}` es asignable sin cast.
- Reutilizar los primitivos UI existentes (`Card`, `StatusBadge`, `Badge`, `Screen`, `Input`, `Button`, `ErrorText`, `Loading`, `SectionTitle`, `Avatar`, `TopBar`) — no reinventar componentes.
- Fuera de alcance (respetado, no se inventa): reasignar/desasignar evaluador (no existe en la web), `POST /evaluacion` (auto-asignación), notificaciones de coordinador, ver/editar el detalle de una evaluación (el backend lo prohíbe a coordinador).
- Endpoints/nombres de funciones/payloads calcan `apps/web/src/services/*` y `@comite/shared`.
- Cada tarea termina con `tsc --noEmit` limpio (y `npm test` si toca tests) + commit. La verificación E2E en Android real se concentra en la última tarea.

---

### Task 1: Ampliar `homeGroupForRole` — coordinador sale del fallback y estrena grupo

**Files:**
- Modify: `apps/mobile/src/lib/roles.ts`
- Modify: `apps/mobile/src/lib/__tests__/roles.test.ts`

**Interfaces:**
- Consumes: `RolBackend` de `../types/api`; `ROLES_SOLICITANTE` de `../data/types`.
- Produces:
  - `src/lib/roles.ts`: `export type HomeGroup = '/(app)' | '/(secretaria)' | '/(coordinador)' | '/rol-no-disponible'`; `export function homeGroupForRole(rol: RolBackend): HomeGroup` con una rama nueva `rol === 'coordinador' → '/(coordinador)'`.

Nota: `app/index.tsx`, `app/login.tsx`, `app/(app)/_layout.tsx` y `app/(secretaria)/_layout.tsx` **NO requieren cambios** — ya delegan en `homeGroupForRole` (leído y confirmado). Al agregar la rama de coordinador aquí, esos archivos enrutan a coordinador automáticamente. El único guard nuevo se escribe en `(coordinador)/_layout.tsx` (Task 2).

- [ ] **Step 1: Agregar la rama de coordinador en `src/lib/roles.ts` (2-5 min)**

Reemplazar el contenido completo por:

```typescript
// src/lib/roles.ts
import type { RolBackend } from '../types/api'
import { ROLES_SOLICITANTE } from '../data/types'

// Grupo de rutas de Expo Router que le corresponde a un rol. Distinta de
// `homePathForRole` de @comite/shared, que devuelve rutas WEB
// ('/secretaria/bandeja', etc.) y no aplica 1:1 a los grupos de carpetas de
// app/. Acá mapeamos rol -> grupo físico para router.replace / <Redirect>.
export type HomeGroup = '/(app)' | '/(secretaria)' | '/(coordinador)' | '/rol-no-disponible'

export function homeGroupForRole(rol: RolBackend): HomeGroup {
  if (ROLES_SOLICITANTE.includes(rol)) return '/(app)'
  if (rol === 'secretaria') return '/(secretaria)'
  if (rol === 'coordinador') return '/(coordinador)'
  // Roles internos aún no implementados (evaluador/administrador): NO se mandan
  // a '/(app)' (verían el Dashboard/wizard del solicitante con datos de todo el
  // sistema, confuso y engañoso). Se ampliará en fases futuras agregando sus
  // propios grupos y ramas aquí.
  return '/rol-no-disponible'
}
```

- [ ] **Step 2: Actualizar el test de `homeGroupForRole` (2-5 min)**

Reemplazar el contenido completo por (coordinador ahora va a su grupo; evaluador/administrador siguen en el fallback):

```typescript
// src/lib/__tests__/roles.test.ts
import { homeGroupForRole } from '../roles'

describe('homeGroupForRole', () => {
  it('manda los 3 sub-roles solicitante a /(app)', () => {
    expect(homeGroupForRole('estudiante_pregrado')).toBe('/(app)')
    expect(homeGroupForRole('estudiante_postgrado')).toBe('/(app)')
    expect(homeGroupForRole('investigador')).toBe('/(app)')
  })
  it('manda secretaría a /(secretaria)', () => {
    expect(homeGroupForRole('secretaria')).toBe('/(secretaria)')
  })
  it('manda coordinador a su propio grupo /(coordinador)', () => {
    expect(homeGroupForRole('coordinador')).toBe('/(coordinador)')
  })
  it('roles internos aún no implementados van a la pantalla de rol no disponible, NO a /(app)', () => {
    expect(homeGroupForRole('evaluador')).toBe('/rol-no-disponible')
    expect(homeGroupForRole('administrador')).toBe('/rol-no-disponible')
  })
})
```

- [ ] **Step 3: Test + typecheck (2-5 min)**

```bash
npm run build -w @comite/shared
npm test -w @comite/mobile
npm run typecheck -w @comite/mobile
```

(Nota: `typecheck` puede quejarse de que `'/(coordinador)'` no es una ruta conocida por `typedRoutes` hasta que exista la carpeta del grupo — se resuelve en Task 2. Si `typecheck` falla SOLO por eso, es esperado en este punto; el test de `roles` debe pasar igual. Si prefieres un typecheck limpio por tarea, se puede combinar la verificación de Task 1 con la de Task 2.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/roles.ts apps/mobile/src/lib/__tests__/roles.test.ts
git commit -m "feat(mobile): homeGroupForRole enruta coordinador a su propio grupo (sale del fallback)"
```

---

### Task 2: Scaffold del grupo `(coordinador)/` — layout de 2 tabs + Perfil real + placeholders

**Files:**
- Create: `apps/mobile/app/(coordinador)/_layout.tsx`
- Create: `apps/mobile/app/(coordinador)/index.tsx` (placeholder Dashboard — se reemplaza en Task 4)
- Create: `apps/mobile/app/(coordinador)/asignacion/[id].tsx` (placeholder — se reemplaza en Task 5)
- Create: `apps/mobile/app/(coordinador)/perfil.tsx` (wrapper REAL de `PerfilScreen`, no placeholder)

**Interfaces:**
- Consumes: `useApp()` (`{ usuario, cargandoSesion }`); `Loading` de `../../src/components/ui`; `colors` de `../../src/lib/theme`; `homeGroupForRole` de `../../src/lib/roles`; `Tabs`/`Redirect` de `expo-router`; `PerfilScreen` de `../../src/components/screens/PerfilScreen`.
- Produces: grupo `(coordinador)/` montado con 2 pestañas (Inicio=`index`, Perfil=`perfil`) y 1 ruta oculta del tab bar (`asignacion/[id]`). Guard: sin sesión → `/login`; rol no-coordinador → su propio grupo vía `homeGroupForRole`.

Nota: Perfil se crea directamente como wrapper real (2 líneas, `PerfilScreen` ya existe y ramifica correctamente para roles internos — CERO código nuevo en `PerfilScreen`). Solo `index` y `asignacion/[id]` van como placeholders porque su implementación real llega en Tasks 4 y 5; así el `_layout` se escribe una sola vez y no hay que tocarlo después.

- [ ] **Step 1: `app/(coordinador)/_layout.tsx` — guard + Tabs de 2 pestañas (2-5 min)**

```tsx
// app/(coordinador)/_layout.tsx
import { Redirect, Tabs } from 'expo-router'
import { Text, View } from 'react-native'
import { useApp } from '../../src/state/AppContext'
import { Loading } from '../../src/components/ui'
import { colors } from '../../src/lib/theme'
import { homeGroupForRole } from '../../src/lib/roles'

// Icono textual simple (mismo criterio que los otros layouts de grupo).
function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ color, fontSize: 18 }}>{label}</Text>
}

export default function CoordinadorLayout() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Cargando…" /></View>
  if (!usuario) return <Redirect href="/login" />
  // Si el usuario no es coordinador, mándalo a su propio grupo (evita ver
  // pantallas que no le corresponden si navega a mano a esta URL).
  if (homeGroupForRole(usuario.rol) !== '/(coordinador)') {
    return <Redirect href={homeGroupForRole(usuario.rol)} />
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.slate400 }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color }) => <TabIcon label="▤" color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <TabIcon label="◔" color={color} /> }} />
      {/* Ruta sin pestaña propia (se oculta del tab bar): se llega solo desde el Dashboard. */}
      <Tabs.Screen name="asignacion/[id]" options={{ href: null }} />
    </Tabs>
  )
}
```

- [ ] **Step 2: Placeholder `app/(coordinador)/index.tsx` (2 min)**

```tsx
// app/(coordinador)/index.tsx — placeholder, se reemplaza por el Dashboard real en Task 4
import { Screen, SectionTitle } from '../../src/components/ui'

export default function DashboardPlaceholder() {
  return (
    <Screen>
      <SectionTitle>Panel de coordinación (placeholder)</SectionTitle>
    </Screen>
  )
}
```

- [ ] **Step 3: Placeholder `app/(coordinador)/asignacion/[id].tsx` (2 min)**

```tsx
// app/(coordinador)/asignacion/[id].tsx — placeholder, se reemplaza en Task 5
import { Screen, SectionTitle } from '../../../src/components/ui'

export default function AsignacionPlaceholder() {
  return (
    <Screen>
      <SectionTitle>Asignar evaluador (placeholder)</SectionTitle>
    </Screen>
  )
}
```

- [ ] **Step 4: `app/(coordinador)/perfil.tsx` — wrapper REAL de `PerfilScreen` (2 min)**

```tsx
// app/(coordinador)/perfil.tsx
import PerfilScreen from '../../src/components/screens/PerfilScreen'

export default function PerfilCoordinador() {
  return <PerfilScreen />
}
```

- [ ] **Step 5: Verificación de montaje + typecheck (5 min)**

```bash
npm run typecheck -w @comite/mobile
# Android/emulador: login con coordinador@uch.edu.pe -> entra al grupo
# (coordinador) con 2 pestañas (Inicio/Perfil) mostrando el placeholder de Inicio
# y el Perfil REAL (rama interna: stats Enviados/Aprobados + "Expedientes vinculados").
# Verificar que NO hay loop de redirección entre (app)/(secretaria)/(coordinador):
#  - login como coordinador queda estable en (coordinador);
#  - login como solicitante queda estable en (app), secretaría en (secretaria).
```

- [ ] **Step 6: Commit**

```bash
git add "apps/mobile/app/(coordinador)"
git commit -m "feat(mobile): scaffold grupo (coordinador) con layout de 2 tabs, Perfil real y placeholders"
```

---

### Task 3: `evaluacion.service.ts` (nuevo) + registro en el barrel

**Files:**
- Create: `apps/mobile/src/services/evaluacion.service.ts`
- Modify: `apps/mobile/src/services/index.ts`

**Interfaces:**
- Consumes: `request` de `../lib/http`; `EvaluacionDto` de `../types/api`.
- Produces:
  - `evaluacion.service.ts`:
    - `export function list(skip = 0, limit = 100): Promise<EvaluacionDto[]>` (`GET /evaluacion`, con `query: { skip, limit }`).
    - `export interface AsignarEvaluadorResponse` (tipo propio y correcto de la respuesta real de la API).
    - `export function asignarEvaluador(expedienteId: number, evaluadorId: number): Promise<AsignarEvaluadorResponse>` (`POST /evaluacion/expediente/:id/asignar`, body `{ evaluadorId }`).
  - `services/index.ts`: re-export `export * as evaluacionService from './evaluacion.service'`.

Nota del hallazgo técnico (confirmado leyendo `apps/api/src/evaluacion/evaluacion.service.ts` líneas 207-212): la respuesta de asignar es
`{ message, evaluacionId, evaluador: { id, nombre, apellido }, expedienteCodigo }` — NO calza con `EvaluacionDto` (que usa `id`, `expedienteId`, `completa`, `criterios`, ...). La web se salva porque solo lee `evaluador.nombre/apellido`; acá se tipa correctamente y el móvil ni siquiera necesita renderizar la respuesta (al asignar con éxito navega de vuelta al Dashboard).

- [ ] **Step 1: Crear `src/services/evaluacion.service.ts` (2-5 min)**

```typescript
// src/services/evaluacion.service.ts
import { request } from '../lib/http'
import type { EvaluacionDto } from '../types/api'

// GET /evaluacion — un evaluador solo ve las suyas; coordinador/admin ven
// todas. El coordinador la usa para (a) marcar qué expedientes ya tienen
// evaluación asignada y (b) calcular la carga pendiente por evaluador.
export function list(skip = 0, limit = 100): Promise<EvaluacionDto[]> {
  return request<EvaluacionDto[]>('/evaluacion', { query: { skip, limit } })
}

// Forma REAL de la respuesta de POST /evaluacion/expediente/:id/asignar
// (apps/api/src/evaluacion/evaluacion.service.ts -> asignar(), líneas 207-212).
// NO es un EvaluacionDto: usa `evaluacionId` (no `id`) y no trae
// `expedienteId`/`completa`/`criterios`. Se tipa aparte a propósito para no
// mentirle al consumidor (el bug latente que la web arrastra al castear a
// EvaluacionDto y leer solo `evaluador.nombre/apellido`).
export interface AsignarEvaluadorResponse {
  message: string
  evaluacionId: number
  evaluador: { id: number; nombre: string; apellido: string }
  expedienteCodigo: string | null
}

// POST /evaluacion/expediente/:id/asignar — REGLA DURA de 1 evaluador por
// expediente (el backend responde 400 si ya tiene uno, incluida la carrera de
// dos coordinadores asignando casi a la vez).
export function asignarEvaluador(
  expedienteId: number,
  evaluadorId: number,
): Promise<AsignarEvaluadorResponse> {
  return request<AsignarEvaluadorResponse>(`/evaluacion/expediente/${expedienteId}/asignar`, {
    method: 'POST',
    body: { evaluadorId },
  })
}
```

- [ ] **Step 2: Registrar en `src/services/index.ts` (2 min)**

Reemplazar el contenido completo por (agrega solo la línea de `evaluacionService`):

```typescript
// src/services/index.ts
export * as authService from './auth.service'
export * as notificacionesService from './notificaciones.service'
export * as expedientesService from './expedientes.service'
export * as chatService from './chat.service'
export * as usersService from './users.service'
export * as configService from './config.service'
export * as evaluacionService from './evaluacion.service'
```

- [ ] **Step 3: Typecheck (2-5 min)**

```bash
npm run typecheck -w @comite/mobile
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/services/evaluacion.service.ts apps/mobile/src/services/index.ts
git commit -m "feat(mobile): evaluacion.service (list + asignarEvaluador) con tipo de respuesta correcto"
```

---

### Task 4: Dashboard de coordinación — filtro puro testeado + pantalla real (`useFocusEffect`)

**Files:**
- Create: `apps/mobile/src/lib/coordinadorFilter.ts`
- Create: `apps/mobile/src/lib/__tests__/coordinadorFilter.test.ts`
- Modify: `apps/mobile/app/(coordinador)/index.tsx` (reemplaza el placeholder)

**Interfaces:**
- Consumes: `expedientesService.list(0, 500)` y `evaluacionService.list(0, 500)` (existen, sin cambios) → `Promise<ExpedienteDto[]>` / `Promise<EvaluacionDto[]>`; `fechaLocalISO`, `formatearFecha` de `../lib/dates`; `filtrarEnRevision`, `FiltroCoordinador` de `../lib/coordinadorFilter`; `Card`, `StatusBadge`, `Badge`, `Input`, `ErrorText`, `Loading`, `Screen` de `../components/ui`; `Avatar` de `../components/Avatar`; `colors`; `useApp()`, `useRouter`, `useFocusEffect`, `useSafeAreaInsets`.
- Produces:
  - `coordinadorFilter.ts`: `export interface FiltroCoordinador { busqueda: string; fechaDesde: string; fechaHasta: string }`; `export function filtrarEnRevision(expedientes: ExpedienteDto[], filtro: FiltroCoordinador): ExpedienteDto[]` (solo `estado === 'en_revision'`, mismo texto/rango-de-fecha que la web, orden por `fechaEnvio` desc).
  - Pantalla Dashboard (`(coordinador)/index.tsx`): 4 stats sobre TODOS los expedientes, lista filtrable de `en_revision`, badge de asignación (`Pendiente de asignar` / `En evaluación`), refresco con `useFocusEffect`, tap en tarjeta → `router.push(\`/(coordinador)/asignacion/${e.id}\`)`.

- [ ] **Step 1: `src/lib/coordinadorFilter.ts` — lógica pura portada de `Dashboard.tsx` (2-5 min)**

```typescript
// src/lib/coordinadorFilter.ts
import { fechaLocalISO } from './dates'
import type { ExpedienteDto } from '../types/api'

export interface FiltroCoordinador {
  busqueda: string
  fechaDesde: string
  fechaHasta: string
}

// Expedientes que el coordinador gestiona: SOLO los que están en revisión de
// fondo (en_revision), listos para asignar evaluador. Mismo filtro client-side
// que la web (coordinador/Dashboard.tsx): texto sobre título/código/investigador
// y rango sobre `fechaEnvio`, orden por fechaEnvio descendente.
export function filtrarEnRevision(expedientes: ExpedienteDto[], filtro: FiltroCoordinador): ExpedienteDto[] {
  const q = filtro.busqueda.trim().toLowerCase()
  const lista = expedientes
    .filter(e => e.estado === 'en_revision')
    .filter(e => {
      const coincideTexto =
        !q ||
        e.tituloProtocolo.toLowerCase().includes(q) ||
        (e.codigoUnico ?? '').toLowerCase().includes(q) ||
        (e.investigadorNombre ?? '').toLowerCase().includes(q)
      const fechaExp = e.fechaEnvio ? fechaLocalISO(e.fechaEnvio) : null
      const coincideDesde = !filtro.fechaDesde || (fechaExp !== null && fechaExp >= filtro.fechaDesde)
      const coincideHasta = !filtro.fechaHasta || (fechaExp !== null && fechaExp <= filtro.fechaHasta)
      return coincideTexto && coincideDesde && coincideHasta
    })
  // Más reciente primero por fecha de envío.
  return [...lista].sort((a, b) => ((a.fechaEnvio ?? '') < (b.fechaEnvio ?? '') ? 1 : -1))
}
```

- [ ] **Step 2: Test de `filtrarEnRevision` (2-5 min)**

```typescript
// src/lib/__tests__/coordinadorFilter.test.ts
import { filtrarEnRevision } from '../coordinadorFilter'
import type { ExpedienteDto } from '../../types/api'

function exp(over: Partial<ExpedienteDto>): ExpedienteDto {
  return {
    id: 1, codigoUnico: null, tituloProtocolo: 'T', investigadorId: 1, investigadorNombre: null,
    tipoTramite: null, facultad: null, modalidad: null, programaEstudios: null, ciclo: null,
    nivelPosgrado: null, numeroActa: null, tituloAnterior: null, tituloNuevo: null,
    proyectoOrigenId: null, estado: 'en_revision', fechaEnvio: null, createdAt: null, updatedAt: null,
    ...over,
  } as ExpedienteDto
}

describe('filtrarEnRevision', () => {
  const base = [
    exp({ id: 1, estado: 'en_revision', tituloProtocolo: 'Alpha', fechaEnvio: '2026-07-01T10:00:00' }),
    exp({ id: 2, estado: 'en_revision', tituloProtocolo: 'Beta', fechaEnvio: '2026-07-05T10:00:00' }),
    exp({ id: 3, estado: 'aprobado', tituloProtocolo: 'Gamma', fechaEnvio: '2026-07-03T10:00:00' }),
    exp({ id: 4, estado: 'enviado', tituloProtocolo: 'Delta', fechaEnvio: '2026-07-02T10:00:00' }),
  ]

  it('solo deja expedientes en_revision (descarta aprobado/enviado/otros)', () => {
    const r = filtrarEnRevision(base, { busqueda: '', fechaDesde: '', fechaHasta: '' })
    expect(r.map(e => e.id).sort()).toEqual([1, 2])
  })
  it('ordena por fechaEnvio descendente', () => {
    const r = filtrarEnRevision(base, { busqueda: '', fechaDesde: '', fechaHasta: '' })
    expect(r.map(e => e.id)).toEqual([2, 1])
  })
  it('filtra por texto en título', () => {
    const r = filtrarEnRevision(base, { busqueda: 'beta', fechaDesde: '', fechaHasta: '' })
    expect(r.map(e => e.id)).toEqual([2])
  })
  it('filtra por rango de fechas (desde/hasta inclusivo)', () => {
    const r = filtrarEnRevision(base, { busqueda: '', fechaDesde: '2026-07-01', fechaHasta: '2026-07-01' })
    expect(r.map(e => e.id)).toEqual([1])
  })
})
```

- [ ] **Step 3: Reemplazar `app/(coordinador)/index.tsx` con el Dashboard real (2-5 min)**

Portado de `apps/web/src/pages/coordinador/Dashboard.tsx` (rama móvil), sobre el molde ya revisado de `app/(secretaria)/index.tsx`: header custom con `useSafeAreaInsets`, cuerpo en `Screen`, carga con `useFocusEffect` (NO `useEffect(...,[])`), pero cargando expedientes + evaluaciones en paralelo, 4 stats sobre TODOS los expedientes, y badge de asignación por expediente.

```tsx
// app/(coordinador)/index.tsx
import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Badge, Card, ErrorText, Input, Loading, Screen, StatusBadge } from '../../src/components/ui'
import Avatar from '../../src/components/Avatar'
import { colors } from '../../src/lib/theme'
import { formatearFecha } from '../../src/lib/dates'
import { ApiError } from '../../src/lib/http'
import { filtrarEnRevision } from '../../src/lib/coordinadorFilter'
import { evaluacionService, expedientesService } from '../../src/services'
import { useApp } from '../../src/state/AppContext'
import type { EvaluacionDto, ExpedienteDto } from '../../src/types/api'

export default function DashboardCoordinador() {
  const { usuario } = useApp()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [expedientes, setExpedientes] = useState<ExpedienteDto[]>([])
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const cargar = useCallback(() => {
    let activo = true
    ;(async () => {
      setCargando(true)
      setError('')
      try {
        const [exps, evals] = await Promise.all([
          expedientesService.list(0, 500),
          evaluacionService.list(0, 500),
        ])
        if (activo) {
          setExpedientes(exps)
          setEvaluaciones(evals)
        }
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los expedientes.')
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  // useFocusEffect (NO useEffect mount-only): al volver de Asignación, Tabs
  // mantiene esta pantalla montada, así que hay que recargar en cada focus para
  // reflejar la asignación recién hecha (lección de la verificación de Fase 4).
  useFocusEffect(
    useCallback(() => {
      const cancelar = cargar()
      return cancelar
    }, [cargar])
  )

  // Stats sobre TODOS los expedientes (no solo los en_revision), igual que la web.
  const stats = useMemo(() => [
    { n: expedientes.filter(e => e.estado === 'en_revision').length, label: 'En revisión', color: colors.primary },
    { n: expedientes.filter(e => e.estado === 'aprobado' || e.estado === 'aprobado_observaciones').length, label: 'Aprobados', color: colors.success },
    { n: expedientes.filter(e => e.estado === 'no_aprobado').length, label: 'No aprobados', color: colors.danger },
    { n: expedientes.filter(e => e.estado === 'subsanacion').length, label: 'Subsanación', color: colors.warn },
  ], [expedientes])

  const idsConEvaluacion = useMemo(
    () => new Set(evaluaciones.map(e => e.expedienteId)),
    [evaluaciones],
  )

  const pendientes = useMemo(
    () => filtrarEnRevision(expedientes, { busqueda, fechaDesde, fechaHasta }),
    [expedientes, busqueda, fechaDesde, fechaHasta],
  )

  function limpiarFiltros() {
    setBusqueda('')
    setFechaDesde('')
    setFechaHasta('')
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={s.headerKicker}>Panel de coordinación</Text>
          <Text numberOfLines={1} style={s.headerTitle}>{usuario?.nombres} {usuario?.apellidos}</Text>
        </View>
        <Pressable onPress={() => router.push('/(coordinador)/perfil')}>
          <Avatar nombres={usuario?.nombres} apellidos={usuario?.apellidos} size={40} />
        </Pressable>
      </View>

      <Screen>
        {!!error && <ErrorText>{error}</ErrorText>}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          {stats.map(st => (
            <Card key={st.label} style={{ flexBasis: '47%', flexGrow: 1, alignItems: 'center', paddingVertical: 11 }}>
              <Text style={{ fontSize: 21, fontWeight: '700', color: st.color }}>{st.n}</Text>
              <Text style={{ fontSize: 11, color: colors.slate500 }}>{st.label}</Text>
            </Card>
          ))}
        </View>

        <Input
          placeholder="Buscar por código, título o estudiante…"
          value={busqueda}
          onChangeText={setBusqueda}
          autoCapitalize="none"
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Input style={{ flex: 1 }} placeholder="Desde AAAA-MM-DD" value={fechaDesde} onChangeText={setFechaDesde} autoCapitalize="none" />
          <Input style={{ flex: 1 }} placeholder="Hasta AAAA-MM-DD" value={fechaHasta} onChangeText={setFechaHasta} autoCapitalize="none" />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.contador}>
            {cargando ? 'Cargando…' : `Expedientes en revisión (${pendientes.length})`}
          </Text>
          <Pressable onPress={limpiarFiltros}><Text style={s.limpiar}>Limpiar</Text></Pressable>
        </View>

        <View style={{ gap: 10 }}>
          {cargando && <Loading label="Cargando expedientes…" />}
          {!cargando && !error && pendientes.map(e => {
            const asignado = idsConEvaluacion.has(e.id)
            return (
              <Pressable key={e.id} onPress={() => router.push(`/(coordinador)/asignacion/${e.id}`)}>
                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Text numberOfLines={1} style={s.titulo}>{e.tituloProtocolo}</Text>
                    <StatusBadge estado={e.estado} />
                  </View>
                  <Text style={s.investigador}>{e.investigadorNombre ?? 'Solicitante desconocido'}</Text>
                  <Text style={s.meta}>{(e.codigoUnico ?? '—')} · {formatearFecha(e.fechaEnvio)}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    {asignado
                      ? <Badge label="En evaluación" bg={colors.successBg} fg={colors.success} />
                      : <Badge label="Pendiente de asignar" bg={colors.warnBg} fg={colors.warn} />}
                    <Text style={s.accion}>{asignado ? 'Ver asignación ›' : 'Asignar evaluador ›'}</Text>
                  </View>
                </Card>
              </Pressable>
            )
          })}
          {!cargando && !error && pendientes.length === 0 && (
            <Text style={s.vacio}>No hay expedientes en revisión por el momento.</Text>
          )}
        </View>
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  headerKicker: { fontSize: 12.5, color: colors.slate500 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  contador: { fontSize: 13, fontWeight: '700', color: colors.navy },
  limpiar: { fontSize: 13, fontWeight: '600', color: colors.primary },
  titulo: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  investigador: { fontSize: 12.5, fontWeight: '500', color: colors.slate500, marginBottom: 4 },
  meta: { fontSize: 12, fontWeight: '500', color: colors.slate400 },
  accion: { fontSize: 12.5, fontWeight: '600', color: colors.primary },
  vacio: { textAlign: 'center', fontSize: 13.5, color: colors.slate500, marginTop: 24 },
})
```

- [ ] **Step 4: Test + typecheck (2-5 min)**

```bash
npm test -w @comite/mobile
npm run typecheck -w @comite/mobile
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/coordinadorFilter.ts apps/mobile/src/lib/__tests__/coordinadorFilter.test.ts "apps/mobile/app/(coordinador)/index.tsx"
git commit -m "feat(mobile): Dashboard de coordinación (filtro en_revision testeado + useFocusEffect + badge de asignación)"
```

---

### Task 5: Asignación de evaluador — cálculo de carga puro testeado + pantalla real

**Files:**
- Create: `apps/mobile/src/lib/evaluadorCarga.ts`
- Create: `apps/mobile/src/lib/__tests__/evaluadorCarga.test.ts`
- Modify: `apps/mobile/app/(coordinador)/asignacion/[id].tsx` (reemplaza el placeholder)

**Interfaces:**
- Consumes: `expedientesService.getById(id)`, `usersService.evaluadoresDisponibles()`, `evaluacionService.list(0, 500)` (existen, sin cambios); `evaluacionService.asignarEvaluador(expedienteId, evaluadorId)` (Task 3); `pendientesPorEvaluador`, `ordenarPorCarga` de `../../../src/lib/evaluadorCarga`; `Button`, `Card`, `ErrorText`, `Loading`, `SectionTitle`, `StatusBadge`, `Badge`, `Screen` de `ui`; `TopBar`; `colors`; `useConfirm()`; `useLocalSearchParams`/`useRouter`; `ApiError`.
- Produces:
  - `evaluadorCarga.ts`: `export function pendientesPorEvaluador(evaluaciones: EvaluacionDto[]): Record<number, number>` (cuenta evaluaciones con `!completa` por `evaluadorId`); `export function ordenarPorCarga(evaluadores: UserDto[], pendientes: Record<number, number>): UserDto[]` (menor carga primero).
  - Pantalla Asignación (`(coordinador)/asignacion/[id].tsx`): carga en paralelo; si ya hay evaluación → tarjeta "Ya asignado" + "Volver al panel"; si no → picker radio-like ordenado por carga + badge "N pendiente(s)" + botón "Asignar" (con `useConfirm()`, error 400 mostrado con `ErrorText`, éxito → `router.replace('/(coordinador)')`).

- [ ] **Step 1: `src/lib/evaluadorCarga.ts` — cálculo puro de carga (2-5 min)**

```typescript
// src/lib/evaluadorCarga.ts
import type { EvaluacionDto, UserDto } from '../types/api'

// Carga pendiente REAL de cada evaluador: cuántas evaluaciones tiene asignadas
// ahora mismo SIN completar. Reemplaza al campo estático `cargaTrabajo` del
// usuario (lo pone el admin a mano al crear la cuenta y nunca se actualiza
// solo). Mismo criterio que la web (coordinador/Asignacion.tsx).
export function pendientesPorEvaluador(evaluaciones: EvaluacionDto[]): Record<number, number> {
  const pendientes: Record<number, number> = {}
  for (const e of evaluaciones) {
    if (!e.completa) pendientes[e.evaluadorId] = (pendientes[e.evaluadorId] ?? 0) + 1
  }
  return pendientes
}

// El menos cargado primero, para que sea el sugerido natural al asignar.
// La carga ausente cuenta como 0.
export function ordenarPorCarga(evaluadores: UserDto[], pendientes: Record<number, number>): UserDto[] {
  return [...evaluadores].sort((a, b) => (pendientes[a.id] ?? 0) - (pendientes[b.id] ?? 0))
}
```

- [ ] **Step 2: Test de `evaluadorCarga` (2-5 min)**

```typescript
// src/lib/__tests__/evaluadorCarga.test.ts
import { ordenarPorCarga, pendientesPorEvaluador } from '../evaluadorCarga'
import type { EvaluacionDto, UserDto } from '../../types/api'

function ev(over: Partial<EvaluacionDto>): EvaluacionDto {
  return {
    id: 1, expedienteId: 1, evaluadorId: 1, recommendation: null, observaciones: null,
    completa: false, conflictoInteres: false, fechaAsignacion: null, fechaEnvio: null,
    puntajeTotal: null, resultado: null, rubricaPdfPath: null, dictamenPdfPath: null,
    ...over,
  } as EvaluacionDto
}
function user(over: Partial<UserDto>): UserDto {
  return {
    id: 1, email: 'e@x.com', nombre: 'N', apellido: 'A', rol: 'evaluador', activo: true,
    especialidad: null, cargaTrabajo: null, conflictoInteres: null, codigoEstudiante: null,
    laboratorio: null, createdAt: null, updatedAt: null,
    ...over,
  } as UserDto
}

describe('pendientesPorEvaluador', () => {
  it('cuenta solo las evaluaciones sin completar, agrupadas por evaluador', () => {
    const p = pendientesPorEvaluador([
      ev({ id: 1, evaluadorId: 10, completa: false }),
      ev({ id: 2, evaluadorId: 10, completa: false }),
      ev({ id: 3, evaluadorId: 10, completa: true }),
      ev({ id: 4, evaluadorId: 20, completa: false }),
    ])
    expect(p).toEqual({ 10: 2, 20: 1 })
  })
  it('no incluye a un evaluador cuyas evaluaciones están todas completas', () => {
    const p = pendientesPorEvaluador([ev({ evaluadorId: 5, completa: true })])
    expect(p[5]).toBeUndefined()
  })
})

describe('ordenarPorCarga', () => {
  it('ordena de menor a mayor carga pendiente', () => {
    const a = user({ id: 1 }), b = user({ id: 2 }), c = user({ id: 3 })
    const r = ordenarPorCarga([a, b, c], { 1: 3, 2: 0, 3: 1 })
    expect(r.map(u => u.id)).toEqual([2, 3, 1])
  })
  it('trata la carga ausente como 0', () => {
    const a = user({ id: 1 }), b = user({ id: 2 })
    const r = ordenarPorCarga([a, b], { 1: 2 })
    expect(r.map(u => u.id)).toEqual([2, 1])
  })
})
```

- [ ] **Step 3: Reemplazar `app/(coordinador)/asignacion/[id].tsx` (2-5 min)**

Portado de `apps/web/src/pages/coordinador/Asignacion.tsx` (rama móvil): carga en paralelo por dependencia `[expedienteId]` (correcto, no es el bug de mount-only), tarjeta de solo lectura si ya está asignado, o picker radio-like (reusa el patrón visual `origenItem`/`origenItemActive` de `cambiar-titulo.tsx`) ordenado por menor carga, con `useConfirm()` antes de asignar y manejo del 400 de carrera con `ErrorText`. El cuerpo va en `Screen`; `TopBar` maneja el safe area del header.

```tsx
// app/(coordinador)/asignacion/[id].tsx
import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Badge, Button, Card, ErrorText, Loading, Screen, SectionTitle, StatusBadge } from '../../../src/components/ui'
import TopBar from '../../../src/components/TopBar'
import { colors } from '../../../src/lib/theme'
import { ApiError } from '../../../src/lib/http'
import { ordenarPorCarga, pendientesPorEvaluador } from '../../../src/lib/evaluadorCarga'
import { evaluacionService, expedientesService, usersService } from '../../../src/services'
import { useConfirm } from '../../../src/state/ConfirmContext'
import type { EvaluacionDto, ExpedienteDto, UserDto } from '../../../src/types/api'

export default function Asignacion() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const expedienteId = Number(id)
  const router = useRouter()
  const confirmar = useConfirm()

  const [expediente, setExpediente] = useState<ExpedienteDto | null>(null)
  const [evaluadores, setEvaluadores] = useState<UserDto[]>([])
  const [evaluacionExistente, setEvaluacionExistente] = useState<EvaluacionDto | null>(null)
  const [pendientes, setPendientes] = useState<Record<number, number>>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [asignando, setAsignando] = useState(false)
  const [asignError, setAsignError] = useState('')

  useEffect(() => {
    if (!Number.isFinite(expedienteId)) {
      setError('El identificador del expediente no es válido.')
      setCargando(false)
      return
    }
    let vivo = true
    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const [exp, disponibles, evaluaciones] = await Promise.all([
          expedientesService.getById(expedienteId),
          usersService.evaluadoresDisponibles(),
          evaluacionService.list(0, 500),
        ])
        if (!vivo) return
        setExpediente(exp)
        setEvaluadores(disponibles)
        setEvaluacionExistente(evaluaciones.find(e => e.expedienteId === expedienteId) ?? null)
        setPendientes(pendientesPorEvaluador(evaluaciones))
      } catch (err) {
        if (vivo) setError(err instanceof ApiError ? err.message : 'No se pudo cargar la información del expediente.')
      } finally {
        if (vivo) setCargando(false)
      }
    }
    cargar()
    return () => { vivo = false }
  }, [expedienteId])

  const evaluadoresOrdenados = ordenarPorCarga(evaluadores, pendientes)

  function nombreEvaluadorAsignado(): string {
    if (!evaluacionExistente) return ''
    const u = evaluadores.find(e => e.id === evaluacionExistente.evaluadorId)
    return u ? `${u.nombre} ${u.apellido}` : `Evaluador #${evaluacionExistente.evaluadorId}`
  }

  async function asignar() {
    if (!seleccionado) return
    if (!(await confirmar('¿Asignar este evaluador al expediente? Solo se permite un evaluador por expediente.', { titulo: 'Asignar evaluador', textoConfirmar: 'Asignar' }))) return
    setAsignando(true)
    setAsignError('')
    try {
      await evaluacionService.asignarEvaluador(expedienteId, seleccionado)
      router.replace('/(coordinador)')
    } catch (err) {
      // El backend responde 400 si el expediente ya tiene evaluador (carrera con
      // otro coordinador); se muestra ese mensaje sin crashear.
      setAsignError(err instanceof ApiError ? err.message : 'No se pudo asignar el evaluador. Intenta nuevamente.')
    } finally {
      setAsignando(false)
    }
  }

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Asignar evaluador" />
        <Loading label="Cargando expediente…" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar titulo="Asignar evaluador" />
      <Screen>
        {!!error && <ErrorText>{error}</ErrorText>}

        {!error && expediente && (
          <>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Text style={s.codigo}>{expediente.codigoUnico ?? '—'}</Text>
                <StatusBadge estado={expediente.estado} />
              </View>
              <Text style={s.titulo}>{expediente.tituloProtocolo}</Text>
            </Card>

            {evaluacionExistente ? (
              <>
                <View style={s.asignadoCard}>
                  <Text style={s.asignadoTitulo}>Ya asignado</Text>
                  <Text style={s.asignadoNombre}>{nombreEvaluadorAsignado()}</Text>
                  <Text style={s.asignadoNota}>
                    Este expediente ya tiene un evaluador asignado. Solo se permite uno por expediente.
                  </Text>
                </View>
                <Button title="Volver al panel" variant="outline" onPress={() => router.replace('/(coordinador)')} />
              </>
            ) : (
              <>
                <SectionTitle>Selecciona un evaluador</SectionTitle>
                <View style={{ gap: 8 }}>
                  {evaluadoresOrdenados.map(ev => {
                    const n = pendientes[ev.id] ?? 0
                    const sel = seleccionado === ev.id
                    return (
                      <Pressable
                        key={ev.id}
                        onPress={() => setSeleccionado(ev.id)}
                        style={[s.evalRow, sel && s.evalRowActive]}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={[s.evalNombre, sel && s.evalNombreActive]}>
                            {ev.nombre} {ev.apellido}
                          </Text>
                          <Text numberOfLines={1} style={s.evalEsp}>{ev.especialidad ?? 'Sin especialidad'}</Text>
                        </View>
                        <Badge
                          label={`${n} pendiente${n === 1 ? '' : 's'}`}
                          bg={n === 0 ? colors.successBg : colors.chipBg}
                          fg={n === 0 ? colors.success : colors.slate500}
                        />
                      </Pressable>
                    )
                  })}
                  {evaluadores.length === 0 && (
                    <Text style={s.vacio}>No hay evaluadores disponibles en este momento.</Text>
                  )}
                </View>

                {!!asignError && <ErrorText>{asignError}</ErrorText>}

                {evaluadores.length > 0 && (
                  <Button
                    title={asignando ? 'Asignando…' : 'Asignar'}
                    disabled={!seleccionado || asignando}
                    loading={asignando}
                    onPress={asignar}
                  />
                )}
              </>
            )}
          </>
        )}
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  codigo: { fontSize: 12, fontWeight: '600', color: colors.slate400 },
  titulo: { fontSize: 15, fontWeight: '700', color: colors.ink, lineHeight: 20 },
  asignadoCard: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: 12, padding: 14 },
  asignadoTitulo: { fontSize: 13, fontWeight: '700', color: colors.success, marginBottom: 4 },
  asignadoNombre: { fontSize: 14, fontWeight: '600', color: colors.ink },
  asignadoNota: { fontSize: 12, color: colors.slate500, marginTop: 6, lineHeight: 17 },
  evalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#fff' },
  evalRowActive: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.blue50 },
  evalNombre: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  evalNombreActive: { color: colors.primary },
  evalEsp: { fontSize: 11.5, fontWeight: '500', color: colors.slate400, marginTop: 2 },
  vacio: { fontSize: 13, color: colors.slate500, paddingVertical: 6 },
})
```

- [ ] **Step 4: Test + typecheck (2-5 min)**

```bash
npm test -w @comite/mobile
npm run typecheck -w @comite/mobile
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/evaluadorCarga.ts apps/mobile/src/lib/__tests__/evaluadorCarga.test.ts "apps/mobile/app/(coordinador)/asignacion/[id].tsx"
git commit -m "feat(mobile): pantalla Asignación de evaluador (carga pendiente testeada + picker por carga + 400 de carrera)"
```

---

### Task 6: Verificación final — typecheck/test global, README y checklist E2E Android

**Files:**
- Modify: `apps/mobile/README.md` (mención del rol Coordinador y su grupo de rutas)

**Interfaces:**
- Consumes: toda la app.
- Produces: verificación de que Coordinador funciona E2E en Android real contra la API, y de que agregar el grupo `(coordinador)` NO rompió los flujos ya verificados de Solicitante (Fase 3) ni Secretaría (Fase 4).

- [ ] **Step 1: `npm run typecheck` y `npm test` globales del monorepo (2-5 min)**

```bash
npm run build -w @comite/shared
npm run typecheck    # turbo: no debe romper @comite/mobile ni el resto
npm test             # turbo: tests de mobile (roles, bandejaFilter, fileName, coordinadorFilter, evaluadorCarga, etc.) en verde
```

- [ ] **Step 2: Actualizar `apps/mobile/README.md` — sección de roles y estructura (2-5 min)**

En la sección "Estructura", agregar tras la viñeta del grupo `app/(secretaria)/` una viñeta para el nuevo grupo:
```markdown
- `app/(coordinador)/` — grupo del rol Coordinador (guard de sesión + Tabs de
  2 pestañas): `index` (Panel de coordinación / Dashboard) y `perfil`, más la ruta
  oculta `asignacion/[id]` (Asignar evaluador, se llega solo tocando un expediente
  del Dashboard). La redirección post-login elige el grupo según el rol
  (`src/lib/roles.ts` → `homeGroupForRole`).
```
En la sección "Alcance de este corte" → "Incluido", agregar:
```markdown
- Rol **Coordinador**: Dashboard (4 stats + lista de expedientes en revisión con
  búsqueda/filtro de fecha y badge de asignación), Asignación de evaluador (picker
  ordenado por menor carga pendiente, regla de 1 evaluador por expediente, manejo
  del 400 de carrera) y Perfil con la rama de rol interno. Servicio nuevo
  `evaluacion.service.ts` (`list` + `asignarEvaluador` con respuesta correctamente
  tipada). El Dashboard usa `useFocusEffect` para refrescarse al volver de Asignación.
```

- [ ] **Step 3: Recorrer el checklist E2E en Android real contra la API real (10-15 min)**

```bash
# Terminal 1: API real
npm run build -w @comite/shared
npm run dev -w @comite/api
# Terminal 2: Expo (Android)
npm run dev -w @comite/mobile   # 'a' para emulador, o QR en Expo Go (dispositivo físico)
```

Checklist E2E — cuenta `coordinador@uch.edu.pe` (marcar cada uno):
- Login como coordinador → entra directo al grupo `(coordinador)` con **2 pestañas** (Inicio/Perfil), sin pasar por el tab bar del solicitante ni de secretaría.
- Dashboard: las 4 tarjetas de stats muestran conteos reales (En revisión / Aprobados / No aprobados / Subsanación) sobre TODOS los expedientes; la lista muestra solo los `en_revision` reales.
- Cada tarjeta de la lista muestra el badge de asignación correcto: **"Pendiente de asignar"** (naranja) si no tiene evaluación, **"En evaluación"** (verde) si ya la tiene.
- Búsqueda por texto (código/título/estudiante) filtra la lista; los filtros de fecha (AAAA-MM-DD) acotan por `fechaEnvio`; "Limpiar" resetea.
- Tocar un expediente **sin asignar** → abre "Asignar evaluador": muestra código/estado/título arriba y la lista de evaluadores **ordenada por menor carga pendiente primero**, cada uno con su badge "N pendiente(s)".
- Seleccionar un evaluador habilita "Asignar"; confirmar en el diálogo → asigna y **vuelve al Dashboard**; al volver, ese expediente ahora muestra **"En evaluación" SIN necesidad de recargar la app** (esto prueba específicamente el fix de `useFocusEffect`).
- Tocar un expediente **ya asignado** → muestra la tarjeta verde "Ya asignado" con el nombre del evaluador y solo el botón "Volver al panel" (sin opción de reasignar).
- Carrera de asignación (opcional/simulable): si el expediente ya tiene evaluador al momento de asignar (p. ej. otro coordinador se adelantó), el backend responde 400 y la pantalla muestra el mensaje con `ErrorText` sin crashear.
- Perfil (coordinador): muestra el rol "Coordinador", stats Enviados/Aprobados y fila "Expedientes vinculados"; "Cerrar sesión" limpia SecureStore y vuelve a Login.
- **Regresión Fase 3 (crítico):** cerrar sesión y entrar con una cuenta de solicitante → entra al grupo `(app)` con sus 5 pestañas y TODO el flujo del solicitante funciona igual que antes.
- **Regresión Fase 4 (crítico):** entrar con `secretaria@uch.edu.pe` → entra al grupo `(secretaria)` con sus 3 pestañas y Bandeja/Revisión/Chat/Perfil funcionan igual que antes.
- **Roles aún no implementados:** entrar con `evaluador@uch.edu.pe` (o `admin@uch.edu.pe`) → muestra la pantalla "Tu rol todavía no está disponible en la app móvil" (NO el Dashboard del solicitante); "Cerrar sesión" funciona desde ahí.
- Navegación a mano / anti-loop: no hay bucle de redirección entre `(app)`, `(secretaria)` y `(coordinador)` en ningún login; la sesión persistente reabre en el grupo correcto según el rol.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/README.md
git commit -m "docs(mobile): README rol Coordinador + verificación E2E Android Fase 5"
```

---

## Self-review (autor del plan)

**Cobertura del spec (3 pantallas + hallazgo técnico + decisión de arquitectura):**
- Decisión de arquitectura (grupo hermano `(coordinador)/`): `homeGroupForRole` gana `'/(coordinador)'` y saca a coordinador del fallback (Task 1); grupo con `_layout.tsx` de 2 tabs + ruta oculta `asignacion/[id]` (Task 2). `(app)/` y `(secretaria)/` quedan sin renombrar ni tocar. `index.tsx`/`login.tsx`/los otros `_layout.tsx` NO requieren cambios (ya delegan en `homeGroupForRole` — confirmado leyendo cada uno).
- Hallazgo técnico (respuesta de asignar ≠ `EvaluacionDto`): `evaluacion.service.ts` define `AsignarEvaluadorResponse` propio y correcto (`{ message, evaluacionId, evaluador: { id, nombre, apellido }, expedienteCodigo }`), verificado 1:1 contra `evaluacion.service.ts` (backend) líneas 207-212. NO se reusa `EvaluacionDto` (Task 3, y constraint global).
- Pantalla 1 (Dashboard): Task 4 — 4 stats sobre todos los expedientes, filtro `en_revision` extraído a `coordinadorFilter.ts` puro + test, badge de asignación, `useFocusEffect`, navegación a Asignación.
- Pantalla 2 (Asignación): Task 5 — carga en paralelo, tarjeta de solo lectura si ya asignado, picker por menor carga (cálculo puro `evaluadorCarga.ts` + test), `useConfirm()` + manejo del 400 de carrera, éxito → Dashboard.
- Pantalla 3 (Perfil): wrapper real de `PerfilScreen` creado en Task 2 Step 4 — CERO código nuevo en `PerfilScreen.tsx` (confirmado que su rama `else` interna ya sirve a coordinador: `esSolicitante === false` → Enviados/Aprobados + "Expedientes vinculados").
- Servicios: `evaluacion.service.ts` NUEVO + barrel (Task 3); `users.service.ts` reusa `evaluadoresDisponibles()` ya existente (leído — no requiere cambios); `expedientes.service.ts` sin cambios (`list`, `getById`).
- Fuera de alcance (respetado): reasignar/desasignar, `POST /evaluacion` (auto-asignación), notificaciones, ver/editar detalle de evaluación. Ninguna tarea los introduce.

**Escaneo de placeholders (red flags):** Los únicos "placeholder" son `index.tsx` y `asignacion/[id].tsx` creados en Task 2 a propósito para que el `_layout` se escriba una sola vez; **cada uno se sobrescribe con código completo** (index→T4, asignacion/[id]→T5). Perfil se crea REAL en T2 (no placeholder). No hay "TBD", ni "similar a Task N", ni pseudocódigo: todo el código (roles, layout, servicio, dos módulos puros + tests, dos pantallas, wrapper) va inline y completo. Las porciones "portadas de la web" van con el código RN completo, no solo la referencia.

**Consistencia de tipos/firmas (verificada contra el código real):**
- `homeGroupForRole(rol: RolBackend): HomeGroup` con `HomeGroup` de 4 valores — el guard de `(coordinador)/_layout.tsx` compara contra `'/(coordinador)'`, igual patrón que los otros layouts.
- `evaluacionService.list(skip, limit): Promise<EvaluacionDto[]>` — consumida con `(0, 500)` en Dashboard (T4) y Asignación (T5). Endpoint `GET /evaluacion` confirmado en `evaluacion.controller.ts`.
- `evaluacionService.asignarEvaluador(expedienteId, evaluadorId): Promise<AsignarEvaluadorResponse>` — endpoint `POST /evaluacion/expediente/:id/asignar` body `{ evaluadorId }` confirmado en controller; forma de respuesta confirmada en el service. El Dashboard/Asignación no renderizan la respuesta (al asignar navegan a Dashboard), así que basta con tiparla bien.
- `EvaluacionDto` tiene `expedienteId`, `evaluadorId`, `completa: boolean` — usados en `idsConEvaluacion` (T4) y `pendientesPorEvaluador`/`find(...expedienteId)` (T5). Confirmado en `packages/shared/src/types.ts:160`.
- `UserDto` usa `nombre`/`apellido`/`especialidad`/`activo` (NO `nombres`/`apellidos`) — usado así en el picker (T5) y en `evaluadoresDisponibles()`. Confirmado en `types.ts:21`.
- `ExpedienteDto.estado: EstadoExpediente` asignable a `StatusBadge estado` (`EstadoProyecto`) sin cast; campos `codigoUnico`/`investigadorNombre`/`fechaEnvio`/`tituloProtocolo` usados — confirmado en `types.ts:52`.
- `usersService.evaluadoresDisponibles(): Promise<UserDto[]>` y `expedientesService.getById(id): Promise<ExpedienteDto>` — existen sin cambios (leídos).
- `Badge({ label, bg, fg })`, `Screen`, `StatusBadge`, `Button({ title, onPress, variant, disabled, loading })`, `useConfirm(): (mensaje, opciones?) => Promise<boolean>` — firmas verificadas en `ui.tsx` y `ConfirmContext.tsx`.

**Confirmación explícita de las 4 lecciones aprendidas:**
- (a) **`useFocusEffect` desde el inicio en el Dashboard, NO `useEffect(...,[])`**: Task 4 Step 3 usa `useFocusEffect(useCallback(() => cargar(), [cargar]))` con `cargar` devolviendo cleanup síncrono — copiado del patrón ya revisado en `app/(secretaria)/index.tsx` (post-fix `2a32d89`). Constraint global lo exige. La Asignación (T5) usa `useEffect` por dependencia `[expedienteId]` a propósito (no es el bug; se recarga al cambiar id).
- (b) **`useSafeAreaInsets` en headers custom**: el Dashboard (T4) tiene header custom y suma `insets.top + 12` al `paddingTop`; la Asignación (T5) usa `TopBar`, que ya aplica `insets.top` internamente (verificado en `TopBar.tsx`).
- (c) **Todo cuerpo de pantalla en `Screen`**: Dashboard (T4) y Asignación (T5) envuelven su contenido en `<Screen>` (ScrollView `flex:1`), evitando los bugs de scroll de Fase 4. Los placeholders (T2) también usan `Screen`.
- (d) **Respuesta de asignar NO es `EvaluacionDto`**: Task 3 define `AsignarEvaluadorResponse` propio; ninguna tarea castea la respuesta de asignar a `EvaluacionDto`.

**Riesgos anotados para el ejecutor:**
1. **`typedRoutes` y el grupo nuevo**: hasta que exista la carpeta `app/(coordinador)/` con su `index`, `typecheck` puede rechazar `'/(coordinador)'` como ruta desconocida (afecta el guard de `roles.ts` en Task 1). Es esperado y se resuelve al completar Task 2; si molesta, correr el typecheck de Task 1 junto con el de Task 2. Los tests unitarios de `roles` no dependen de `typedRoutes` y pasan igual.
2. **Carrera de asignación**: el backend es la fuente de verdad (400 si ya hay evaluador). El móvil solo muestra el picker cuando `!evaluacionExistente` (pre-chequeo optimista) y captura el 400 con `ErrorText` — no intenta prevenir la carrera del lado cliente de forma distinta a la web.
3. **Nombre del evaluador ya asignado**: la respuesta de `GET /evaluacion` (backend `toResponse`) NO incluye la relación `evaluador`, así que `evaluacionExistente.evaluador` es `undefined`; el nombre se resuelve buscando en `evaluadoresDisponibles()` por `evaluadorId` (mismo fallback que la web). Si el evaluador quedó inactivo, la tarjeta muestra "Evaluador #id" (aceptable, no crashea).
4. **Sin endpoint de "evaluadores disponibles"**: el filtro es 100% client-side sobre `/users` (`rol === 'evaluador' && activo !== false`), misma limitación (sin paginación) que la web; no se agrava.

## Critical Files for Implementation
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\pages\coordinador\Dashboard.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\pages\coordinador\Asignacion.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\api\src\evaluacion\evaluacion.service.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\src\lib\roles.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\app\(secretaria)\_layout.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\app\(secretaria)\index.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\src\components\screens\PerfilScreen.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\src\services\index.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\src\components\ui.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\packages\shared\src\types.ts
