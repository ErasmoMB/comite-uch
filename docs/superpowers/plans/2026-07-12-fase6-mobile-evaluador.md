# App Móvil Expo — Fase 6: Rol Evaluador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender `apps/mobile` (app Expo ya construida y verificada para Solicitante/Secretaría/Coordinador en Fases 3-5) con el rol interno **Evaluador**: un grupo nuevo `(evaluador)/` de 2 pestañas (Bandeja/Perfil) más una ruta oculta de Evaluación (la pantalla más compleja de la app: rúbrica de 7 criterios + 3 acciones + estados de bloqueo + descarga de PDFs), equivalentes 1:1 a `apps/web/src/pages/evaluador/*` + una rama nueva en el `PerfilScreen` compartido, consumiendo la misma API NestJS sin tocar `@comite/shared`, `apps/web` ni `apps/api`.

**Architecture:** Se agrega un grupo de rutas hermano `app/(evaluador)/` con su propio `_layout.tsx` (guardia de sesión + Tabs de **2** pestañas: Bandeja=`index` / Perfil=`perfil`, más la ruta oculta `evaluacion/[id]` sin pestaña, a la que se llega solo tocando una fila de la Bandeja — mismo patrón que `asignacion/[id]` en Coordinador). `src/lib/roles.ts` → `homeGroupForRole` gana un quinto valor `'/(evaluador)'` y saca a `evaluador` del fallback `/rol-no-disponible`. Los grupos `(app)/`/`(secretaria)/`/`(coordinador)/` quedan intactos. La redirección role-aware ya existente enruta a evaluador automáticamente por delegar en `homeGroupForRole`. Se **amplía** el servicio existente `evaluacion.service.ts` (de Fase 5) con 6 funciones nuevas, tipadas contra la **forma real de la API** (no el `EvaluacionDto` compartido). `PerfilScreen.tsx` gana una **tercera** rama para `rol === 'evaluador'` (stats desde `misEvaluaciones()`).

**Tech Stack:** Expo SDK 54 (React Native 0.81, React 19.1, Expo Router 6, `typedRoutes` ON), TypeScript 5.7, `expo-secure-store` 15, `expo-file-system`/`expo-sharing` (ya presentes desde Fase 4), Jest + `jest-expo` 54, `@comite/shared` (workspace), Turborepo, npm workspaces. **No hay dependencias nuevas en esta fase** (la apertura de documentos/PDFs reutiliza `documentDownload.ts` de Fase 4 sin cambios).

## Global Constraints

- Los grupos `app/(app)/`, `app/(secretaria)/` y `app/(coordinador)/` **se quedan intactos y sin renombrar** — ya verificados en dispositivo real. NO se tocan.
- Se agrega un grupo **nuevo y hermano** `app/(evaluador)/` con **2 pestañas**: Bandeja (`index`) / Perfil (`perfil`), más la ruta oculta del tab bar `evaluacion/[id]` (se llega solo tocando una fila de la Bandeja, igual que la web no le da item de navegación propio a la Evaluación).
- Rol fuera de alcance de esta fase: Administrador. NO implementarlo — sigue cayendo en `/rol-no-disponible`. `evaluador` **sale** de ese fallback y pasa a su grupo real; `administrador` es ahora el **único** rol en el fallback.
- **Selector de puntaje por criterio = píldoras tipo botón**, reutilizando el patrón `Selector` (segmented pills) ya usado en `app/(app)/nuevo/index.tsx` (estilos `segment`/`segItem`/`segItemActive`/`segItemDisabled`/`segText`/`segTextActive`). NO un `<select>` nativo (no existe en RN) ni un stepper numérico nuevo. Las opciones son `0..c.puntajeMax` por criterio.
- **`guardarAvance` replica fielmente la limitación real de la web:** ese botón SOLO persiste el texto de `observaciones` (`POST /evaluacion/:id/guardar-parcial` con body `{observaciones}`). Los puntajes por criterio viven en estado local de React hasta "Enviar evaluación" y se pierden al salir. **NO se inventa** un guardado real de puntajes parciales (no hay endpoint). 
- **`guardarAvance` y `declararConflicto` devuelven `{ message: string }`, NO un `EvaluacionDetalleDto`.** La web tiene un bug real ahí (sobreescribe el estado con ese objeto incompleto). El móvil **NO** repite ese bug: tras `guardarAvance` solo se muestra `res.message` (sin tocar el estado local); tras `declararConflicto` solo se marca `conflictoInteres: true` sobre el estado ya cargado (`setEvaluacion(prev => prev ? { ...prev, conflictoInteres: true } : prev)`), **sin** sustituir el objeto por la respuesta `{message}`.
- **`enviarEvaluacion` SÍ devuelve el objeto completo real** (`toResponse` → `EvaluacionDetalleDto`): esa respuesta SÍ se usa para refrescar el estado (`setEvaluacion(actualizado)`) y pasar a modo solo-lectura.
- **Los tipos de respuesta de la API de evaluación NO son el `EvaluacionDto` compartido.** `GET /evaluacion/:id` y `GET /evaluacion/mis-evaluaciones` comparten el mismo `toResponse` del backend (`apps/api/src/evaluacion/evaluacion.service.ts:56-83`), cuya forma real usa `rubricaPdfUrl`/`dictamenPdfUrl` (no `...Path`), NO anida `expediente`/`evaluador`, y aplana `tituloProtocolo`/`investigadorNombre`/`expedienteFechaEnvio`/`createdAt`. Se define un tipo propio `EvaluacionDetalleDto` (y `MiEvaluacionDto` como alias, porque la forma es idéntica), igual criterio que `AsignarEvaluadorResponse` en este mismo archivo. `getRubrica()` SÍ reutiliza el `RubricaDto` compartido porque su forma coincide 1:1 con el backend.
- **El bug de "Descargar dictamen" visible en `no_aprobado` SÍ se arregla:** el botón de dictamen solo se muestra si `evaluacion.resultado === 'aprobado' || evaluacion.resultado === 'aprobado_observaciones'` (únicos casos donde el backend genera ese PDF, ver `evaluacion.service.ts:365-370`).
- **La Bandeja dispara un `GET /expedientes/:id` extra por cada fila (N+1)** porque `mis-evaluaciones` no trae `codigoUnico` ni el expediente completo. Se **replica el patrón real** (siempre se necesita el fetch extra), sin optimizar prematuramente — mismo criterio que la web y aceptado como riesgo.
- **La Bandeja reutiliza el filtro compartido `expedienteListFilter.ts`** (`filtrarExpedientes`) vía un adaptador fino `evaluacionBandejaFilter.ts`, exactamente como `bandejaFilter.ts` (Secretaría) y `coordinadorFilter.ts` (Coordinador) ya delegan en él. NO se crea un cuarto filtro con la lógica de texto/fecha/orden duplicada.
- **La apertura de documentos y la descarga de PDFs reutilizan `documentDownload.ts` (`abrirDocumento`) SIN cambios** — mismo consumo que `app/(secretaria)/revision/[id].tsx`: `abrirDocumento(apiUrl(<ruta>), nombreArchivo)` con estado de carga por botón.
- **Bandeja usa `useFocusEffect` desde el inicio** (NO `useEffect(...,[])` mount-only): `Tabs` mantiene la pantalla montada; al volver de Evaluación (tras enviar/declarar conflicto) la lista DEBE refrescarse para reflejar el nuevo badge. Se copia el patrón ya revisado de `app/(coordinador)/index.tsx` (`cargar` devuelve cleanup síncrono; `useFocusEffect(useCallback(() => cargar(), [cargar]))`).
- **La pantalla de Evaluación carga por dependencia `[evaluacionId]` con `useEffect`** — correcto (no es el bug de mount-only; se recarga cuando cambia el id).
- **Todo header propio (barra superior custom) usa `useSafeAreaInsets()`** y suma `insets.top` a su `paddingTop`. La Bandeja tiene header custom → aplica. La Evaluación usa `TopBar` (maneja el safe area internamente). `PerfilScreen` ya usa `useSafeAreaInsets`.
- **El cuerpo de toda pantalla nueva va envuelto en `Screen`** de `src/components/ui.tsx` (ScrollView `flex:1` + padding) — CRÍTICO en la pantalla de Evaluación, la más larga de la app (7 criterios + documentos + observaciones + acciones).
- Estados de error/carga con el patrón establecido: `ApiError` capturado + `ErrorText`; `cargando`/`error`/vacío explícitos; `useConfirm()` antes de Enviar (irreversible) y Declarar conflicto (irreversible, `peligroso: true`); flag `cancelado`/`activo` en efectos async.
- Reutilizar los primitivos UI existentes (`Card`, `Badge`, `Button`, `Screen`, `Input`, `TextArea`, `Field`, `ErrorText`, `Loading`, `SectionTitle`, `TopBar`, `Avatar`) — no reinventar componentes. NO se crea un componente formal reusable de "fila de criterio" ni "banner de resultado" (quedan locales a la pantalla, igual que la web).
- La lógica pura de puntaje/resultado se extrae a `src/lib/rubricaResultado.ts` (función pura + test), y el filtro de la Bandeja a `src/lib/evaluacionBandejaFilter.ts` (función pura + test) — mismo precedente que `bandejaFilter`/`coordinadorFilter`/`evaluadorCarga`.
- Endpoints/nombres de funciones/payloads calcan `apps/web/src/services/evaluacion.service.ts` y las rutas reales de `apps/api/src/evaluacion/evaluacion.controller.ts`.
- Fuera de alcance (respetado, no se inventa): vista previa embebida de PDF/imagen (se colapsa "Ver"/"Descargar" en un solo "Abrir" vía `documentDownload.ts`); guardado real de puntajes parciales; `POST /evaluacion` (auto-asignación); reasignar/desasignar.
- Cada tarea termina con `tsc --noEmit` limpio (`npm run typecheck -w @comite/mobile`) y `npm test -w @comite/mobile` si toca tests + commit. La verificación E2E en Android real se concentra en la última tarea.

---

### Task 1: Ampliar `homeGroupForRole` — evaluador sale del fallback y estrena grupo

**Files:**
- Modify: `apps/mobile/src/lib/roles.ts`
- Modify: `apps/mobile/src/lib/__tests__/roles.test.ts`

**Interfaces:**
- Consumes: `RolBackend` de `../types/api`; `ROLES_SOLICITANTE` de `../data/types`.
- Produces: `src/lib/roles.ts`: `export type HomeGroup = '/(app)' | '/(secretaria)' | '/(coordinador)' | '/(evaluador)' | '/rol-no-disponible'`; `homeGroupForRole` con una rama nueva `rol === 'evaluador' → '/(evaluador)'`.

Nota: `app/index.tsx`, `app/login.tsx` y los `_layout.tsx` de `(app)`/`(secretaria)`/`(coordinador)` **NO requieren cambios** — ya delegan en `homeGroupForRole`. El único guard nuevo se escribe en `(evaluador)/_layout.tsx` (Task 3).

- [ ] **Step 1: Reemplazar el contenido completo de `src/lib/roles.ts` (2-5 min)**

```typescript
// src/lib/roles.ts
import type { RolBackend } from '../types/api'
import { ROLES_SOLICITANTE } from '../data/types'

// Grupo de rutas de Expo Router que le corresponde a un rol. Distinta de
// `homePathForRole` de @comite/shared, que devuelve rutas WEB
// ('/secretaria/bandeja', etc.) y no aplica 1:1 a los grupos de carpetas de
// app/. Acá mapeamos rol -> grupo físico para router.replace / <Redirect>.
export type HomeGroup =
  | '/(app)'
  | '/(secretaria)'
  | '/(coordinador)'
  | '/(evaluador)'
  | '/rol-no-disponible'

export function homeGroupForRole(rol: RolBackend): HomeGroup {
  if (ROLES_SOLICITANTE.includes(rol)) return '/(app)'
  if (rol === 'secretaria') return '/(secretaria)'
  if (rol === 'coordinador') return '/(coordinador)'
  if (rol === 'evaluador') return '/(evaluador)'
  // Rol interno aún no implementado (administrador): NO se manda a '/(app)'
  // (vería el Dashboard/wizard del solicitante con datos de todo el sistema,
  // confuso y engañoso). Se ampliará en la fase futura del Administrador.
  return '/rol-no-disponible'
}
```

- [ ] **Step 2: Actualizar el test de `homeGroupForRole` (2-5 min)**

Reemplazar el contenido completo por (evaluador ahora va a su grupo; solo administrador sigue en el fallback):

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
  it('manda evaluador a su propio grupo /(evaluador)', () => {
    expect(homeGroupForRole('evaluador')).toBe('/(evaluador)')
  })
  it('el administrador (aún no implementado) va a la pantalla de rol no disponible, NO a /(app)', () => {
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

(Nota: `typecheck` puede quejarse de que `'/(evaluador)'` no es una ruta conocida por `typedRoutes` hasta que exista la carpeta del grupo — se resuelve en Task 3. Si `typecheck` falla SOLO por eso, es esperado; el test de `roles` pasa igual. Si prefieres un typecheck limpio por tarea, combina la verificación de Task 1 con la de Task 3.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/roles.ts apps/mobile/src/lib/__tests__/roles.test.ts
git commit -m "feat(mobile): homeGroupForRole enruta evaluador a su propio grupo (sale del fallback)"
```

---

### Task 2: Ampliar `evaluacion.service.ts` — funciones de lectura + tipos propios

**Files:**
- Modify: `apps/mobile/src/services/evaluacion.service.ts`

**Interfaces:**
- Consumes: `request` de `../lib/http`; `EvaluacionDto`, `RubricaDto` de `../types/api`.
- Produces (además de lo ya existente `list`/`AsignarEvaluadorResponse`/`asignarEvaluador`, sin tocar):
  - `export interface EvaluacionCriterioResp { criterioKey: string; puntaje: number; observacion: string | null }`
  - `export interface EvaluacionDetalleDto` (forma real de `toResponse` del backend).
  - `export type MiEvaluacionDto = EvaluacionDetalleDto` (mis-evaluaciones y :id comparten `toResponse`).
  - `export function misEvaluaciones(): Promise<MiEvaluacionDto[]>` (`GET /evaluacion/mis-evaluaciones`).
  - `export function getById(id: number): Promise<EvaluacionDetalleDto>` (`GET /evaluacion/:id`).
  - `export function getRubrica(): Promise<RubricaDto>` (`GET /evaluacion/rubrica`, reusa el `RubricaDto` compartido).

Nota (hallazgo técnico, confirmado en `apps/api/src/evaluacion/evaluacion.service.ts:56-83`): `toResponse` devuelve `{ id, expedienteId, evaluadorId, recommendation, observaciones, completa, conflictoInteres, tituloProtocolo, investigadorNombre, expedienteFechaEnvio, criterios: [{criterioKey, puntaje, observacion}], puntajeTotal, resultado, rubricaPdfUrl (= rubricaPdfPath), dictamenPdfUrl (= dictamenPdfPath), createdAt (= fechaAsignacion) }`. NO calza con el `EvaluacionDto` compartido (que usa `fechaAsignacion`/`fechaEnvio`/`rubricaPdfPath`/`dictamenPdfPath` y relaciones anidadas). `getRubrica` sí calza 1:1 con `RubricaDto` compartido (`{criterios, puntajeTotalMax, umbrales}`), así que se reutiliza.

- [ ] **Step 1: Reemplazar el contenido completo de `src/services/evaluacion.service.ts` (5 min)**

```typescript
// src/services/evaluacion.service.ts
import { request } from '../lib/http'
import type { EvaluacionDto, RubricaDto } from '../types/api'

// GET /evaluacion — un evaluador solo ve las suyas; coordinador/admin ven
// todas. El coordinador la usa para (a) marcar qué expedientes ya tienen
// evaluación asignada y (b) calcular la carga pendiente por evaluador.
export function list(skip = 0, limit = 100): Promise<EvaluacionDto[]> {
  return request<EvaluacionDto[]>('/evaluacion', { query: { skip, limit } })
}

// Forma REAL de la respuesta de POST /evaluacion/expediente/:id/asignar
// (apps/api/src/evaluacion/evaluacion.service.ts -> asignar(), líneas 207-212).
// NO es un EvaluacionDto: usa `evaluacionId` (no `id`) y no trae
// `expedienteId`/`completa`/`criterios`.
export interface AsignarEvaluadorResponse {
  message: string
  evaluacionId: number
  evaluador: { id: number; nombre: string; apellido: string }
  expedienteCodigo: string | null
}

// POST /evaluacion/expediente/:id/asignar — REGLA DURA de 1 evaluador por
// expediente (el backend responde 400 si ya tiene uno).
export function asignarEvaluador(
  expedienteId: number,
  evaluadorId: number,
): Promise<AsignarEvaluadorResponse> {
  return request<AsignarEvaluadorResponse>(`/evaluacion/expediente/${expedienteId}/asignar`, {
    method: 'POST',
    body: { evaluadorId },
  })
}

// ==================== Rol Evaluador (Fase 6) ====================

// Forma REAL de la respuesta de la API de evaluación (toResponse del backend,
// apps/api/src/evaluacion/evaluacion.service.ts:56-83). NO coincide con el
// EvaluacionDto compartido: usa `rubricaPdfUrl`/`dictamenPdfUrl` (no ...Path),
// no anida `expediente`/`evaluador`, y aplana título/investigador/fecha/creado.
// Mismo criterio que AsignarEvaluadorResponse: se tipa aparte a propósito.
export interface EvaluacionCriterioResp {
  criterioKey: string
  puntaje: number
  observacion: string | null
}

export interface EvaluacionDetalleDto {
  id: number
  expedienteId: number
  evaluadorId: number
  recommendation: string | null
  observaciones: string | null
  completa: boolean
  conflictoInteres: boolean
  tituloProtocolo: string | null
  investigadorNombre: string | null
  expedienteFechaEnvio: string | null
  criterios: EvaluacionCriterioResp[]
  puntajeTotal: number | null
  resultado: string | null
  rubricaPdfUrl: string | null
  dictamenPdfUrl: string | null
  createdAt: string | null
}

// GET /evaluacion/mis-evaluaciones y GET /evaluacion/:id comparten el mismo
// `toResponse`, así que su forma es idéntica: MiEvaluacionDto es un alias.
export type MiEvaluacionDto = EvaluacionDetalleDto

// GET /evaluacion/mis-evaluaciones — solo evaluadores; devuelve las evaluaciones
// asignadas al usuario logueado (forma aplanada, SIN codigoUnico).
export function misEvaluaciones(): Promise<MiEvaluacionDto[]> {
  return request<MiEvaluacionDto[]>('/evaluacion/mis-evaluaciones')
}

// GET /evaluacion/:id — detalle de una evaluación (misma forma aplanada).
export function getById(id: number): Promise<EvaluacionDetalleDto> {
  return request<EvaluacionDetalleDto>(`/evaluacion/${id}`)
}

// GET /evaluacion/rubrica — catálogo estático de los 7 criterios + umbrales.
// La forma real coincide 1:1 con el RubricaDto compartido, se reutiliza.
export function getRubrica(): Promise<RubricaDto> {
  return request<RubricaDto>('/evaluacion/rubrica')
}
```

- [ ] **Step 2: Typecheck (2-5 min)**

```bash
npm run typecheck -w @comite/mobile
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/services/evaluacion.service.ts
git commit -m "feat(mobile): evaluacion.service — misEvaluaciones/getById/getRubrica con tipos reales de la API"
```

---

### Task 3: Scaffold del grupo `(evaluador)/` — layout 2 tabs + Perfil real + rama evaluador en PerfilScreen

**Files:**
- Create: `apps/mobile/app/(evaluador)/_layout.tsx`
- Create: `apps/mobile/app/(evaluador)/index.tsx` (placeholder Bandeja — se reemplaza en Task 4)
- Create: `apps/mobile/app/(evaluador)/evaluacion/[id].tsx` (placeholder — se reemplaza en Task 5/7)
- Create: `apps/mobile/app/(evaluador)/perfil.tsx` (wrapper REAL de `PerfilScreen`)
- Modify: `apps/mobile/src/components/screens/PerfilScreen.tsx` (agrega la tercera rama, `rol === 'evaluador'`)

**Interfaces:**
- Consumes: `useApp()`; `Loading` de `../../src/components/ui`; `colors`; `homeGroupForRole`; `Tabs`/`Redirect` de `expo-router`; `PerfilScreen`; en PerfilScreen: `evaluacionService.misEvaluaciones()` (Task 2).
- Produces: grupo `(evaluador)/` montado con 2 pestañas (Bandeja=`index`, Perfil=`perfil`) + ruta oculta `evaluacion/[id]`. Guard: sin sesión → `/login`; rol no-evaluador → su propio grupo. `PerfilScreen` con rama evaluador (stats Pendientes/Completadas desde `misEvaluaciones()`).

Nota: la rama de PerfilScreen se agrega AQUÍ (no antes) porque necesita `evaluacionService.misEvaluaciones()`, ya disponible tras Task 2. El wrapper de Perfil se crea real (no placeholder); solo `index` y `evaluacion/[id]` van como placeholders (se reemplazan en Tasks 4 y 5/7), así el `_layout` se escribe una sola vez.

- [ ] **Step 1: `app/(evaluador)/_layout.tsx` — guard + Tabs de 2 pestañas (2-5 min)**

```tsx
// app/(evaluador)/_layout.tsx
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

export default function EvaluadorLayout() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Cargando…" /></View>
  if (!usuario) return <Redirect href="/login" />
  // Si el usuario no es evaluador, mándalo a su propio grupo (evita ver
  // pantallas que no le corresponden si navega a mano a esta URL).
  if (homeGroupForRole(usuario.rol) !== '/(evaluador)') {
    return <Redirect href={homeGroupForRole(usuario.rol)} />
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.slate400 }}>
      <Tabs.Screen name="index" options={{ title: 'Bandeja', tabBarIcon: ({ color }) => <TabIcon label="▤" color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <TabIcon label="◔" color={color} /> }} />
      {/* Ruta sin pestaña propia (se oculta del tab bar): se llega solo desde la Bandeja. */}
      <Tabs.Screen name="evaluacion/[id]" options={{ href: null }} />
    </Tabs>
  )
}
```

- [ ] **Step 2: Placeholder `app/(evaluador)/index.tsx` (2 min)**

```tsx
// app/(evaluador)/index.tsx — placeholder, se reemplaza por la Bandeja real en Task 4
import { Screen, SectionTitle } from '../../src/components/ui'

export default function BandejaPlaceholder() {
  return (
    <Screen>
      <SectionTitle>Bandeja de evaluaciones (placeholder)</SectionTitle>
    </Screen>
  )
}
```

- [ ] **Step 3: Placeholder `app/(evaluador)/evaluacion/[id].tsx` (2 min)**

```tsx
// app/(evaluador)/evaluacion/[id].tsx — placeholder, se reemplaza en Task 5/7
import { Screen, SectionTitle } from '../../../src/components/ui'

export default function EvaluacionPlaceholder() {
  return (
    <Screen>
      <SectionTitle>Evaluación (placeholder)</SectionTitle>
    </Screen>
  )
}
```

- [ ] **Step 4: `app/(evaluador)/perfil.tsx` — wrapper REAL de `PerfilScreen` (2 min)**

```tsx
// app/(evaluador)/perfil.tsx
import PerfilScreen from '../../src/components/screens/PerfilScreen'

export default function PerfilEvaluador() {
  return <PerfilScreen />
}
```

- [ ] **Step 5: Agregar la rama evaluador a `src/components/screens/PerfilScreen.tsx` (5 min)**

Reemplazar el contenido completo por (agrega `esEvaluador`, importa `evaluacionService`, y ramifica el fetch: evaluador usa `misEvaluaciones()` → stats Pendientes/Completadas; el resto queda idéntico):

```tsx
// src/components/screens/PerfilScreen.tsx
import { useCallback, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Screen } from '../ui'
import Avatar from '../Avatar'
import { colors } from '../../lib/theme'
import { ROL_LABEL, ROLES_SOLICITANTE } from '../../data/types'
import { evaluacionService, expedientesService } from '../../services'
import { useApp } from '../../state/AppContext'

interface Stat {
  n: number
  label: string
  color: string
}

export default function PerfilScreen() {
  const { usuario, logout } = useApp()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [stats, setStats] = useState<Stat[]>([])
  const [totalRegistros, setTotalRegistros] = useState<number | null>(null)

  const esSolicitante = usuario ? ROLES_SOLICITANTE.includes(usuario.rol) : false
  const esEvaluador = usuario?.rol === 'evaluador'

  const cargar = useCallback(() => {
    if (!usuario) return undefined
    let cancelado = false
    ;(async () => {
      try {
        if (esEvaluador) {
          // Stats del evaluador desde SUS evaluaciones (NO desde expedientes):
          // Pendientes (!completa) / Completadas (completa). Igual que la rama
          // `rol === 'evaluador'` de la web (Perfil.tsx).
          const evaluaciones = await evaluacionService.misEvaluaciones()
          if (cancelado) return
          setTotalRegistros(evaluaciones.length)
          setStats([
            { n: evaluaciones.filter(e => !e.completa).length, label: 'Pendientes', color: colors.primary },
            { n: evaluaciones.filter(e => e.completa).length, label: 'Completadas', color: colors.success },
          ])
        } else {
          const proyectos = await expedientesService.list()
          if (cancelado) return
          setTotalRegistros(proyectos.length)
          if (esSolicitante) {
            setStats([
              { n: proyectos.filter(p => p.estado === 'en_revision' || p.estado === 'enviado').length, label: 'En revisión', color: colors.primary },
              { n: proyectos.filter(p => p.estado === 'aprobado' || p.estado === 'aprobado_observaciones').length, label: 'Aprobados', color: colors.success },
              { n: proyectos.filter(p => p.estado === 'subsanacion').length, label: 'Subsanación', color: colors.warn },
            ])
          } else {
            // Rama de rol interno (secretaría/coordinador), calcada de la web.
            setStats([
              { n: proyectos.filter(p => p.estado === 'enviado' || p.estado === 'en_revision').length, label: 'Enviados', color: colors.primary },
              { n: proyectos.filter(p => p.estado === 'aprobado' || p.estado === 'aprobado_observaciones').length, label: 'Aprobados', color: colors.success },
            ])
          }
        }
      } catch {
        if (!cancelado) setStats([])
      }
    })()
    return () => { cancelado = true }
  }, [usuario, esSolicitante, esEvaluador])

  useFocusEffect(
    useCallback(() => {
      const cancelar = cargar()
      return cancelar
    }, [cargar])
  )

  const filas = [
    { label: 'Correo institucional', valor: usuario?.correo ?? '—' },
    ...(usuario?.codigo ? [{ label: 'Código de estudiante', valor: usuario.codigo }] : []),
    ...(usuario?.laboratorio ? [{ label: 'Laboratorio', valor: usuario.laboratorio }] : []),
    ...(usuario?.especialidad ? [{ label: 'Especialidad', valor: usuario.especialidad }] : []),
    ...(totalRegistros !== null
      ? [{ label: esSolicitante ? 'Proyectos registrados' : esEvaluador ? 'Evaluaciones asignadas' : 'Expedientes vinculados', valor: String(totalRegistros) }]
      : []),
  ]

  async function cerrarSesion() {
    await logout()
    router.replace('/login')
  }

  return (
    <Screen>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Avatar nombres={usuario?.nombres} apellidos={usuario?.apellidos} size={72} />
        <Text style={s.nombre}>{usuario?.nombres} {usuario?.apellidos}</Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>{usuario ? ROL_LABEL[usuario.rol] : ''}</Text>
        </View>
      </View>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {filas.map(f => (
          <View key={f.label} style={s.row}>
            <Text style={s.rowLabel}>{f.label}</Text>
            <Text style={s.rowValor}>{f.valor}</Text>
          </View>
        ))}
      </Card>

      {stats.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 9 }}>
          {stats.map(st => (
            <Card key={st.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 11 }}>
              <Text style={{ fontSize: 21, fontWeight: '700', color: st.color }}>{st.n}</Text>
              <Text style={{ fontSize: 11, color: colors.slate500 }}>{st.label}</Text>
            </Card>
          ))}
        </View>
      )}

      <Button title="Cerrar sesión" variant="danger" onPress={cerrarSesion} />
    </Screen>
  )
}

const s = StyleSheet.create({
  header: { alignItems: 'center', gap: 9, paddingBottom: 6 },
  nombre: { fontSize: 17, fontWeight: '700', color: colors.ink },
  badge: { backgroundColor: colors.blue50, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  rowLabel: { fontSize: 12.5, color: colors.slate500 },
  rowValor: { fontSize: 13, fontWeight: '700', color: colors.ink },
})
```

Nota: se cambió el label de la fila de conteo para evaluador a "Evaluaciones asignadas" (más claro que "Expedientes vinculados", ya que el conteo es de evaluaciones). Secretaría/coordinador conservan "Expedientes vinculados"; solicitante conserva "Proyectos registrados". El resto del archivo es idéntico al original de Fase 4.

- [ ] **Step 6: Verificación de montaje + typecheck (5 min)**

```bash
npm run typecheck -w @comite/mobile
# Android/emulador: login con evaluador@uch.edu.pe -> entra al grupo
# (evaluador) con 2 pestañas (Bandeja/Perfil) mostrando el placeholder de
# Bandeja y el Perfil REAL (rama evaluador: stats Pendientes/Completadas y
# fila "Evaluaciones asignadas").
# Verificar que NO hay loop de redirección entre los 4 grupos:
#  - login evaluador queda estable en (evaluador);
#  - solicitante en (app), secretaría en (secretaria), coordinador en (coordinador).
```

- [ ] **Step 7: Commit**

```bash
git add "apps/mobile/app/(evaluador)" apps/mobile/src/components/screens/PerfilScreen.tsx
git commit -m "feat(mobile): scaffold grupo (evaluador) (layout 2 tabs, Perfil real) + rama evaluador en PerfilScreen"
```

---

### Task 4: Bandeja de evaluaciones — filtro puro testeado (reusa `expedienteListFilter`) + pantalla real (`useFocusEffect`, N+1)

**Files:**
- Create: `apps/mobile/src/lib/evaluacionBandejaFilter.ts`
- Create: `apps/mobile/src/lib/__tests__/evaluacionBandejaFilter.test.ts`
- Modify: `apps/mobile/app/(evaluador)/index.tsx` (reemplaza el placeholder)

**Interfaces:**
- Consumes: `filtrarExpedientes`, `FiltroExpedientes` de `./expedienteListFilter`; `ExpedienteDto` de `../types/api`; `MiEvaluacionDto` de `../services/evaluacion.service`; `evaluacionService.misEvaluaciones()`, `expedientesService.getById(id)`; `formatearFecha`; `Badge`/`Card`/`Input`/`ErrorText`/`Loading`/`Screen`; `Avatar`; `colors`; `useApp()`, `useRouter`, `useFocusEffect`, `useSafeAreaInsets`, `ApiError`.
- Produces:
  - `evaluacionBandejaFilter.ts`: `export interface FilaEvaluacion { evaluacion: MiEvaluacionDto; expediente: ExpedienteDto | null }`; `export function filtrarEvaluacionesAsignadas(filas: FilaEvaluacion[], filtro: FiltroExpedientes): FilaEvaluacion[]` — delega en `filtrarExpedientes` (predicado de estado siempre-true) sobre la parte `expediente` de cada fila, y reconstruye las filas por `expedienteId`.
  - Pantalla Bandeja (`(evaluador)/index.tsx`): header custom con `useSafeAreaInsets`, cuerpo en `Screen`, carga `misEvaluaciones()` + N+1 `getById` por fila con `useFocusEffect`, búsqueda/filtro de fecha, badges Completada/Pendiente/Conflicto, tap → `router.push(\`/(evaluador)/evaluacion/${id}\`)`.

- [ ] **Step 1: `src/lib/evaluacionBandejaFilter.ts` — adaptador fino que REUSA el filtro compartido (5 min)**

```typescript
// src/lib/evaluacionBandejaFilter.ts
import { filtrarExpedientes, type FiltroExpedientes } from './expedienteListFilter'
import type { ExpedienteDto } from '../types/api'
import type { MiEvaluacionDto } from '../services/evaluacion.service'

export interface FilaEvaluacion {
  evaluacion: MiEvaluacionDto
  expediente: ExpedienteDto | null
}

// Reutiliza el filtro compartido de expedientes (texto sobre
// título/código/investigador + rango sobre fechaEnvio + orden desc) sobre la
// parte `expediente` de cada fila -- NO duplica la lógica de filtrado (mismo
// criterio que bandejaFilter.ts / coordinadorFilter.ts, que también delegan en
// filtrarExpedientes). Adaptación fina por la diferencia de forma: la Bandeja
// del evaluador lista objetos {evaluacion, expediente} y no filtra por estado
// (ve TODAS sus evaluaciones), por eso el predicado de estado es siempre-true.
// Las filas cuyo GET /expedientes/:id falló (expediente === null) no son
// filtrables por texto/fecha; se anexan al final SOLO cuando no hay filtros
// activos (mostrar lo que se tenga, igual criterio que la web).
export function filtrarEvaluacionesAsignadas(
  filas: FilaEvaluacion[],
  filtro: FiltroExpedientes,
): FilaEvaluacion[] {
  const porExpediente = new Map<number, FilaEvaluacion>()
  const expedientes: ExpedienteDto[] = []
  for (const fila of filas) {
    if (fila.expediente) {
      porExpediente.set(fila.expediente.id, fila)
      expedientes.push(fila.expediente)
    }
  }
  const ordenadas = filtrarExpedientes(expedientes, filtro, () => true)
    .map(e => porExpediente.get(e.id))
    .filter((f): f is FilaEvaluacion => f !== undefined)

  const hayFiltros =
    filtro.busqueda.trim() !== '' || filtro.fechaDesde !== '' || filtro.fechaHasta !== ''
  if (hayFiltros) return ordenadas
  const sinExpediente = filas.filter(f => f.expediente === null)
  return [...ordenadas, ...sinExpediente]
}
```

- [ ] **Step 2: Test de `filtrarEvaluacionesAsignadas` (5 min)**

```typescript
// src/lib/__tests__/evaluacionBandejaFilter.test.ts
import { filtrarEvaluacionesAsignadas, type FilaEvaluacion } from '../evaluacionBandejaFilter'
import type { ExpedienteDto } from '../../types/api'
import type { MiEvaluacionDto } from '../../services/evaluacion.service'

function exp(over: Partial<ExpedienteDto>): ExpedienteDto {
  return {
    id: 1, codigoUnico: null, tituloProtocolo: 'T', investigadorId: 1, investigadorNombre: null,
    tipoTramite: null, facultad: null, modalidad: null, programaEstudios: null, ciclo: null,
    nivelPosgrado: null, numeroActa: null, tituloAnterior: null, tituloNuevo: null,
    proyectoOrigenId: null, estado: 'en_revision', fechaEnvio: null, createdAt: null, updatedAt: null,
    ...over,
  } as ExpedienteDto
}
function ev(id: number, expedienteId: number): MiEvaluacionDto {
  return {
    id, expedienteId, evaluadorId: 1, recommendation: null, observaciones: null, completa: false,
    conflictoInteres: false, tituloProtocolo: null, investigadorNombre: null, expedienteFechaEnvio: null,
    criterios: [], puntajeTotal: null, resultado: null, rubricaPdfUrl: null, dictamenPdfUrl: null, createdAt: null,
  }
}
function fila(evId: number, expOver: Partial<ExpedienteDto> | null): FilaEvaluacion {
  const expedienteId = expOver?.id ?? evId * 10
  return { evaluacion: ev(evId, expedienteId), expediente: expOver ? exp({ id: expedienteId, ...expOver }) : null }
}

describe('filtrarEvaluacionesAsignadas', () => {
  const base: FilaEvaluacion[] = [
    fila(1, { id: 11, tituloProtocolo: 'Alpha', codigoUnico: 'A-1', fechaEnvio: '2026-07-01T10:00:00' }),
    fila(2, { id: 12, tituloProtocolo: 'Beta', codigoUnico: 'B-2', fechaEnvio: '2026-07-05T10:00:00' }),
  ]

  it('ordena por fechaEnvio descendente (más reciente primero)', () => {
    const r = filtrarEvaluacionesAsignadas(base, { busqueda: '', fechaDesde: '', fechaHasta: '' })
    expect(r.map(f => f.evaluacion.id)).toEqual([2, 1])
  })
  it('filtra por texto en título del expediente', () => {
    const r = filtrarEvaluacionesAsignadas(base, { busqueda: 'alpha', fechaDesde: '', fechaHasta: '' })
    expect(r.map(f => f.evaluacion.id)).toEqual([1])
  })
  it('filtra por rango de fechas (desde/hasta inclusivo)', () => {
    const r = filtrarEvaluacionesAsignadas(base, { busqueda: '', fechaDesde: '2026-07-05', fechaHasta: '2026-07-05' })
    expect(r.map(f => f.evaluacion.id)).toEqual([2])
  })
  it('anexa filas sin expediente al final SOLO cuando no hay filtros activos', () => {
    const conNull = [...base, fila(3, null)]
    const sinFiltro = filtrarEvaluacionesAsignadas(conNull, { busqueda: '', fechaDesde: '', fechaHasta: '' })
    expect(sinFiltro.map(f => f.evaluacion.id)).toEqual([2, 1, 3])
    const conFiltro = filtrarEvaluacionesAsignadas(conNull, { busqueda: 'beta', fechaDesde: '', fechaHasta: '' })
    expect(conFiltro.map(f => f.evaluacion.id)).toEqual([2])
  })
})
```

- [ ] **Step 3: Reemplazar `app/(evaluador)/index.tsx` con la Bandeja real (10 min)**

Portada de `apps/web/src/pages/evaluador/Bandeja.tsx` (rama móvil), sobre el molde ya revisado de `app/(coordinador)/index.tsx`: header custom con `useSafeAreaInsets`, cuerpo en `Screen`, carga con `useFocusEffect`, N+1 `getById` por fila (replicado a propósito), filtro vía `filtrarEvaluacionesAsignadas`, badges Completada/Pendiente/Conflicto.

```tsx
// app/(evaluador)/index.tsx
import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Badge, Card, ErrorText, Input, Loading, Screen } from '../../src/components/ui'
import Avatar from '../../src/components/Avatar'
import { colors } from '../../src/lib/theme'
import { formatearFecha } from '../../src/lib/dates'
import { ApiError } from '../../src/lib/http'
import { filtrarEvaluacionesAsignadas, type FilaEvaluacion } from '../../src/lib/evaluacionBandejaFilter'
import { evaluacionService, expedientesService } from '../../src/services'
import { useApp } from '../../src/state/AppContext'

export default function BandejaEvaluador() {
  const { usuario } = useApp()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [filas, setFilas] = useState<FilaEvaluacion[]>([])
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
        const evaluaciones = await evaluacionService.misEvaluaciones()
        // N+1 REPLICADO A PROPÓSITO (igual que la web evaluador/Bandeja.tsx):
        // mis-evaluaciones NO trae codigoUnico ni el expediente completo, así
        // que se hace un GET /expedientes/:id por fila para código/estado/fecha.
        const resueltas = await Promise.all(
          evaluaciones.map(async (evaluacion): Promise<FilaEvaluacion> => {
            try {
              const expediente = await expedientesService.getById(evaluacion.expedienteId)
              return { evaluacion, expediente }
            } catch {
              return { evaluacion, expediente: null }
            }
          }),
        )
        if (activo) setFilas(resueltas)
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las evaluaciones asignadas.')
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  // useFocusEffect (NO useEffect mount-only): al volver de la pantalla de
  // Evaluación (tras enviar/declarar conflicto), Tabs mantiene esta pantalla
  // montada; hay que recargar en cada focus para reflejar el badge nuevo
  // (lección de Fase 4/5).
  useFocusEffect(
    useCallback(() => {
      const cancelar = cargar()
      return cancelar
    }, [cargar])
  )

  const filasFiltradas = useMemo(
    () => filtrarEvaluacionesAsignadas(filas, { busqueda, fechaDesde, fechaHasta }),
    [filas, busqueda, fechaDesde, fechaHasta],
  )

  function limpiarFiltros() {
    setBusqueda('')
    setFechaDesde('')
    setFechaHasta('')
  }

  function tituloDe(f: FilaEvaluacion) {
    return f.expediente?.tituloProtocolo ?? `Expediente #${f.evaluacion.expedienteId}`
  }
  function codigoDe(f: FilaEvaluacion) {
    return f.expediente?.codigoUnico ?? '—'
  }
  function nombreDe(f: FilaEvaluacion) {
    return f.expediente?.investigadorNombre ?? '—'
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={s.headerKicker}>Bandeja de evaluaciones</Text>
          <Text numberOfLines={1} style={s.headerTitle}>{usuario?.nombres} {usuario?.apellidos}</Text>
        </View>
        <Pressable onPress={() => router.push('/(evaluador)/perfil')}>
          <Avatar nombres={usuario?.nombres} apellidos={usuario?.apellidos} size={40} />
        </Pressable>
      </View>

      <Screen>
        {!!error && <ErrorText>{error}</ErrorText>}

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
            {cargando ? 'Cargando…' : `Evaluaciones asignadas (${filasFiltradas.length})`}
          </Text>
          <Pressable onPress={limpiarFiltros}><Text style={s.limpiar}>Limpiar</Text></Pressable>
        </View>

        <View style={{ gap: 10 }}>
          {cargando && <Loading label="Cargando evaluaciones…" />}
          {!cargando && !error && filasFiltradas.map(f => (
            <Pressable key={f.evaluacion.id} onPress={() => router.push(`/(evaluador)/evaluacion/${f.evaluacion.id}`)}>
              <Card>
                <Text numberOfLines={1} style={s.titulo}>{tituloDe(f)}</Text>
                <Text style={s.investigador}>{nombreDe(f)}</Text>
                <Text style={s.meta}>{codigoDe(f)} · {formatearFecha(f.expediente?.fechaEnvio ?? null)}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {f.evaluacion.completa
                    ? <Badge label="Completada" bg={colors.successBg} fg={colors.success} />
                    : <Badge label="Pendiente" bg={colors.blue50} fg={colors.primary} />}
                  {f.evaluacion.conflictoInteres && <Badge label="⚠ Conflicto de interés" bg={colors.warnBg} fg={colors.warn} />}
                </View>
              </Card>
            </Pressable>
          ))}
          {!cargando && !error && filas.length === 0 && (
            <Text style={s.vacio}>No tienes evaluaciones asignadas por el momento.</Text>
          )}
          {!cargando && !error && filas.length > 0 && filasFiltradas.length === 0 && (
            <Text style={s.vacio}>Ninguna evaluación coincide con los filtros.</Text>
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
  titulo: { fontSize: 14, fontWeight: '700', color: colors.ink },
  investigador: { fontSize: 12.5, fontWeight: '500', color: colors.slate500, marginTop: 2, marginBottom: 2 },
  meta: { fontSize: 12, fontWeight: '500', color: colors.slate400 },
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
git add apps/mobile/src/lib/evaluacionBandejaFilter.ts apps/mobile/src/lib/__tests__/evaluacionBandejaFilter.test.ts "apps/mobile/app/(evaluador)/index.tsx"
git commit -m "feat(mobile): Bandeja de evaluaciones (reusa expedienteListFilter + useFocusEffect + N+1 + badges)"
```

---

### Task 5: Pantalla de Evaluación — parte 1: cálculo puro testeado + carga de datos + formulario + preview + documentos

**Files:**
- Create: `apps/mobile/src/lib/rubricaResultado.ts`
- Create: `apps/mobile/src/lib/__tests__/rubricaResultado.test.ts`
- Modify: `apps/mobile/app/(evaluador)/evaluacion/[id].tsx` (reemplaza el placeholder con la parte 1 de la pantalla real; las 3 acciones + estados de bloqueo + PDFs llegan en Task 7)

**Interfaces:**
- Consumes: `RubricaDto` de `../types/api`; `evaluacionService.getById/getRubrica`, `expedientesService.getDetalle`; `abrirDocumento`; `apiUrl`, `ApiError`; `formatearFecha`; primitivos UI; `EvaluacionDetalleDto` de `../services/evaluacion.service`; `useLocalSearchParams`.
- Produces:
  - `rubricaResultado.ts`: `export type ResultadoRubrica`; `export function puntajeAcumulado(rubrica, puntajes): number`; `export function resultadoPrevisto(rubrica, total): ResultadoRubrica`.
  - Pantalla Evaluación (parte 1): carga `getById` + `getRubrica` + `getDetalle` (expediente + documentos), formulario de 7 criterios con **Selector-píldora** (0..puntajeMax) + observación por criterio, preview en vivo de puntaje/resultado, lista de documentos con "Abrir" (`documentDownload.ts`), observaciones generales. Inputs `disabled`/`editable` según `bloqueado` (soloLectura || conflicto). SIN la sección de acciones todavía.

Nota de construcción incremental: la parte 1 es un archivo completo y ejecutable (se ve y se llena el formulario; los documentos se abren). La sección de acciones (Guardar/Enviar/Conflicto) + estados de bloqueo visibles + botones de PDF se agregan en Task 7 reemplazando el archivo completo. NO es un placeholder: es código real que se amplía.

- [ ] **Step 1: `src/lib/rubricaResultado.ts` — cálculo puro (2-5 min)**

```typescript
// src/lib/rubricaResultado.ts
import type { RubricaDto } from '../types/api'

export type ResultadoRubrica = 'aprobado' | 'aprobado_observaciones' | 'no_aprobado'

// Puntaje acumulado a partir del estado local del formulario (puntajes como
// string por criterio, indexados por c.key). Vacío / no numérico cuenta 0 --
// igual que la web (Number(...) || 0).
export function puntajeAcumulado(rubrica: RubricaDto, puntajes: Record<string, string>): number {
  return rubrica.criterios.reduce((acc, c) => acc + (Number(puntajes[c.key]) || 0), 0)
}

// Resultado previsto comparando el total contra el límite inferior de cada
// umbral ('17-20' -> 17, '13-16' -> 13). Mismo criterio que la web
// (evaluador/Evaluacion.tsx: se compara contra Number(rango.split('-')[0])).
export function resultadoPrevisto(rubrica: RubricaDto, total: number): ResultadoRubrica {
  const limiteInferior = (rango: string) => Number(rango.split('-')[0])
  if (total >= limiteInferior(rubrica.umbrales.aprobado)) return 'aprobado'
  if (total >= limiteInferior(rubrica.umbrales.aprobado_observaciones)) return 'aprobado_observaciones'
  return 'no_aprobado'
}
```

- [ ] **Step 2: Test de `rubricaResultado` (2-5 min)**

```typescript
// src/lib/__tests__/rubricaResultado.test.ts
import { puntajeAcumulado, resultadoPrevisto } from '../rubricaResultado'
import type { RubricaDto } from '../../types/api'

const rubrica: RubricaDto = {
  criterios: [
    { key: 'a', nombre: 'A', descripcion: '', puntajeMax: 10 },
    { key: 'b', nombre: 'B', descripcion: '', puntajeMax: 10 },
  ],
  puntajeTotalMax: 20,
  umbrales: { aprobado: '17-20', aprobado_observaciones: '13-16', no_aprobado: '0-12' },
}

describe('puntajeAcumulado', () => {
  it('suma los puntajes numéricos por criterio', () => {
    expect(puntajeAcumulado(rubrica, { a: '7', b: '9' })).toBe(16)
  })
  it('trata vacío / no numérico / ausente como 0', () => {
    expect(puntajeAcumulado(rubrica, { a: '', b: 'x' })).toBe(0)
    expect(puntajeAcumulado(rubrica, { a: '5' })).toBe(5)
  })
})

describe('resultadoPrevisto (umbrales 17-20 / 13-16 / 0-12)', () => {
  it('>= 17 -> aprobado', () => {
    expect(resultadoPrevisto(rubrica, 17)).toBe('aprobado')
    expect(resultadoPrevisto(rubrica, 20)).toBe('aprobado')
  })
  it('13..16 -> aprobado_observaciones', () => {
    expect(resultadoPrevisto(rubrica, 13)).toBe('aprobado_observaciones')
    expect(resultadoPrevisto(rubrica, 16)).toBe('aprobado_observaciones')
  })
  it('<= 12 -> no_aprobado', () => {
    expect(resultadoPrevisto(rubrica, 12)).toBe('no_aprobado')
    expect(resultadoPrevisto(rubrica, 0)).toBe('no_aprobado')
  })
})
```

- [ ] **Step 3: Reemplazar `app/(evaluador)/evaluacion/[id].tsx` con la parte 1 (15 min)**

```tsx
// app/(evaluador)/evaluacion/[id].tsx  (parte 1 — acciones/bloqueo/PDF en Task 7)
import { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Button, Card, ErrorText, Field, Loading, Screen, SectionTitle, TextArea } from '../../../src/components/ui'
import TopBar from '../../../src/components/TopBar'
import { colors } from '../../../src/lib/theme'
import { formatearFecha } from '../../../src/lib/dates'
import { ApiError, apiUrl } from '../../../src/lib/http'
import { abrirDocumento } from '../../../src/lib/documentDownload'
import { puntajeAcumulado, resultadoPrevisto, type ResultadoRubrica } from '../../../src/lib/rubricaResultado'
import { evaluacionService, expedientesService } from '../../../src/services'
import type { DocumentoDto, ExpedienteDto, RubricaDto } from '../../../src/types/api'
import type { EvaluacionDetalleDto } from '../../../src/services/evaluacion.service'

interface CriterioEstado {
  puntaje: string
  observacion: string
}

const RESULTADO_LABEL: Record<ResultadoRubrica, string> = {
  aprobado: 'Aprobado',
  aprobado_observaciones: 'Aprobado con observaciones',
  no_aprobado: 'No aprobado',
}
const RESULTADO_COLOR: Record<ResultadoRubrica, string> = {
  aprobado: colors.success,
  aprobado_observaciones: colors.warn,
  no_aprobado: colors.danger,
}

export default function Evaluacion() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const evaluacionId = Number(id)

  const [evaluacion, setEvaluacion] = useState<EvaluacionDetalleDto | null>(null)
  const [rubrica, setRubrica] = useState<RubricaDto | null>(null)
  const [expediente, setExpediente] = useState<ExpedienteDto | null>(null)
  const [documentos, setDocumentos] = useState<DocumentoDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [criteriosEstado, setCriteriosEstado] = useState<Record<string, CriterioEstado>>({})
  const [observacionesGenerales, setObservacionesGenerales] = useState('')

  const [error, setError] = useState('')
  const [abriendo, setAbriendo] = useState<number | null>(null)

  useEffect(() => {
    if (!Number.isFinite(evaluacionId)) {
      setErrorCarga('El identificador de la evaluación no es válido.')
      setCargando(false)
      return
    }
    let cancelado = false
    async function cargar() {
      setCargando(true)
      setErrorCarga('')
      try {
        const [ev, rub] = await Promise.all([
          evaluacionService.getById(evaluacionId),
          evaluacionService.getRubrica(),
        ])
        if (cancelado) return
        setEvaluacion(ev)
        setRubrica(rub)
        setObservacionesGenerales(ev.observaciones ?? '')
        const inicial: Record<string, CriterioEstado> = {}
        for (const c of rub.criterios) {
          const existente = ev.criterios.find(cr => cr.criterioKey === c.key)
          inicial[c.key] = {
            puntaje: existente?.puntaje != null ? String(existente.puntaje) : '',
            observacion: existente?.observacion ?? '',
          }
        }
        setCriteriosEstado(inicial)
        // El detalle de la evaluación no trae el expediente completo (solo
        // campos aplanados) -- se busca aparte para el resumen y los documentos.
        // Si falla, no bloquea la evaluación en sí.
        try {
          const detalle = await expedientesService.getDetalle(ev.expedienteId)
          if (cancelado) return
          setExpediente(detalle.expediente)
          setDocumentos(detalle.documentos)
        } catch {
          // resumen/documentos opcionales
        }
      } catch (e) {
        if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar la evaluación.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [evaluacionId])

  const total = useMemo(() => {
    if (!rubrica) return 0
    const puntajes: Record<string, string> = {}
    for (const c of rubrica.criterios) puntajes[c.key] = criteriosEstado[c.key]?.puntaje ?? ''
    return puntajeAcumulado(rubrica, puntajes)
  }, [rubrica, criteriosEstado])

  const resultado = useMemo<ResultadoRubrica | null>(
    () => (rubrica ? resultadoPrevisto(rubrica, total) : null),
    [rubrica, total],
  )

  const soloLectura = evaluacion?.completa === true
  const conflicto = evaluacion?.conflictoInteres === true
  const bloqueado = soloLectura || conflicto

  function actualizarCriterio(key: string, campo: keyof CriterioEstado, valor: string) {
    setCriteriosEstado(prev => ({ ...prev, [key]: { ...prev[key], [campo]: valor } }))
  }

  async function onAbrirDocumento(doc: DocumentoDto) {
    if (!expediente) return
    try {
      setAbriendo(doc.id)
      setError('')
      await abrirDocumento(apiUrl(`/expedientes/${expediente.id}/documentos/${doc.id}/descargar`), doc.nombreArchivo)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : 'No se pudo abrir el documento.'))
    } finally {
      setAbriendo(null)
    }
  }

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Evaluación" />
        <Loading label="Cargando evaluación…" />
      </View>
    )
  }

  if (errorCarga || !evaluacion || !rubrica) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Evaluación" />
        <View style={{ padding: 16 }}><ErrorText>{errorCarga || 'No se pudo cargar la evaluación.'}</ErrorText></View>
      </View>
    )
  }

  const pct = Math.min(100, Math.round((total / rubrica.puntajeTotalMax) * 100))

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar titulo="Evaluación" />
      <Screen>
        {/* Resumen del expediente + investigador */}
        <Card>
          <Text style={s.cardTitle}>Resumen del expediente</Text>
          <Text style={s.line}><Text style={s.k}>Código: </Text>{expediente?.codigoUnico ?? `Expediente #${evaluacion.expedienteId}`}</Text>
          <Text style={s.line}><Text style={s.k}>Evaluación: </Text>#{evaluacion.id}</Text>
          <Text style={s.line}><Text style={s.k}>Título: </Text>{expediente?.tituloProtocolo ?? evaluacion.tituloProtocolo ?? 'Título no disponible'}</Text>
          {!!expediente?.facultad && <Text style={s.line}><Text style={s.k}>Facultad: </Text>{expediente.facultad}</Text>}
          {!!expediente?.tipoTramite && <Text style={s.line}><Text style={s.k}>Tipo: </Text>{expediente.tipoTramite}</Text>}
          <Text style={s.line}><Text style={s.k}>Investigador: </Text>{expediente?.investigadorNombre ?? evaluacion.investigadorNombre ?? 'No disponible'}</Text>
          <Text style={s.line}><Text style={s.k}>Fecha de envío: </Text>{formatearFecha(expediente?.fechaEnvio ?? evaluacion.expedienteFechaEnvio ?? null)}</Text>
        </Card>

        {/* Documentos para revisión */}
        <SectionTitle>Documentos para revisión</SectionTitle>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {documentos.map(d => (
            <View key={d.id} style={s.docRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={s.docNombre}>{d.nombreArchivo}</Text>
                <Text style={s.docTipo}>{d.tipoDocumento}</Text>
              </View>
              <Button
                title={abriendo === d.id ? 'Abriendo…' : 'Abrir'}
                variant="outline"
                loading={abriendo === d.id}
                onPress={() => onAbrirDocumento(d)}
                style={{ paddingHorizontal: 16, paddingVertical: 9 }}
              />
            </View>
          ))}
          {documentos.length === 0 && <Text style={s.vacioRow}>No hay documentos disponibles para este expediente en este momento.</Text>}
        </Card>

        {/* Progreso / resultado previsto (en vivo) */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <Text style={s.progLabel}>Puntaje acumulado</Text>
            <Text style={s.progValor}>{total} / {rubrica.puntajeTotalMax}</Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${pct}%`, backgroundColor: resultado ? RESULTADO_COLOR[resultado] : colors.primary }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <Text style={s.progHint}>Resultado previsto</Text>
            <Text style={[s.progResultado, { color: resultado ? RESULTADO_COLOR[resultado] : colors.slate500 }]}>{resultado ? RESULTADO_LABEL[resultado] : '—'}</Text>
          </View>
        </Card>

        {/* Criterios (Selector-píldora por puntaje) */}
        <SectionTitle>Criterios de evaluación</SectionTitle>
        <View style={{ gap: 12 }}>
          {rubrica.criterios.map(c => {
            const opciones = Array.from({ length: c.puntajeMax + 1 }, (_, n) => n)
            const puntajeSel = criteriosEstado[c.key]?.puntaje ?? ''
            return (
              <Card key={c.key} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={s.critNombre}>{c.nombre}</Text>
                  <Text style={s.critMax}>máx. {c.puntajeMax} pts</Text>
                </View>
                <Text style={s.critDesc}>{c.descripcion}</Text>
                <Field label="Puntaje">
                  <View style={s.segment}>
                    {opciones.map(n => {
                      const sel = puntajeSel === String(n)
                      return (
                        <Pressable
                          key={n}
                          disabled={bloqueado}
                          onPress={() => actualizarCriterio(c.key, 'puntaje', String(n))}
                          style={[s.segItem, sel && s.segItemActive, bloqueado && s.segItemDisabled]}
                        >
                          <Text style={[s.segText, sel && s.segTextActive]}>{n}</Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </Field>
                <Field label="Observación (opcional)">
                  <TextArea
                    editable={!bloqueado}
                    placeholder="Comentario sobre este criterio…"
                    value={criteriosEstado[c.key]?.observacion ?? ''}
                    onChangeText={v => actualizarCriterio(c.key, 'observacion', v)}
                    style={{ minHeight: 60 }}
                  />
                </Field>
              </Card>
            )
          })}
        </View>

        <Field label="Observaciones generales">
          <TextArea
            editable={!bloqueado}
            placeholder="Comentarios generales sobre el protocolo…"
            value={observacionesGenerales}
            onChangeText={setObservacionesGenerales}
          />
        </Field>

        {!!error && <ErrorText>{error}</ErrorText>}
        {/* Acciones (Guardar/Enviar/Conflicto), estados de bloqueo y botones de PDF: Task 7. */}
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  cardTitle: { fontSize: 12, fontWeight: '700', color: colors.navy, marginBottom: 8 },
  line: { fontSize: 12.5, color: colors.slate700, lineHeight: 19 },
  k: { fontWeight: '700', color: colors.ink },
  docRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  docNombre: { fontSize: 13, fontWeight: '600', color: colors.ink },
  docTipo: { fontSize: 11.5, color: colors.slate400, marginTop: 2 },
  vacioRow: { fontSize: 12.5, color: colors.slate500, padding: 14 },
  progLabel: { fontSize: 12.5, fontWeight: '600', color: colors.slate700 },
  progValor: { fontSize: 15, fontWeight: '700', color: colors.ink },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: colors.lineSoft, overflow: 'hidden' },
  barFill: { height: '100%' },
  progHint: { fontSize: 12, color: colors.slate500 },
  progResultado: { fontSize: 13, fontWeight: '700' },
  critNombre: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.ink },
  critMax: { fontSize: 12, fontWeight: '600', color: colors.slate400 },
  critDesc: { fontSize: 12, color: colors.slate500, lineHeight: 17 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segItem: { minWidth: 40, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  segItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segItemDisabled: { opacity: 0.5 },
  segText: { fontSize: 13, color: colors.slate500, fontWeight: '700' },
  segTextActive: { color: '#fff' },
  exito: { color: colors.success, fontSize: 13, fontWeight: '600' },
  muted: { fontSize: 13, color: colors.slate500, lineHeight: 18 },
})
```

Nota: los estilos `exito` y `muted` ya se declaran aquí porque los consume Task 7 (que reemplaza el archivo completo); no molestan a la parte 1 (StyleSheet no reprocha claves sin usar).

- [ ] **Step 4: Test + typecheck (2-5 min)**

```bash
npm test -w @comite/mobile
npm run typecheck -w @comite/mobile
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/rubricaResultado.ts apps/mobile/src/lib/__tests__/rubricaResultado.test.ts "apps/mobile/app/(evaluador)/evaluacion/[id].tsx"
git commit -m "feat(mobile): Evaluación parte 1 (rúbrica 7 criterios con Selector-píldora + preview en vivo + documentos)"
```

---

### Task 6: Ampliar `evaluacion.service.ts` — acciones mutantes + helpers de URL de PDF

**Files:**
- Modify: `apps/mobile/src/services/evaluacion.service.ts`

**Interfaces:**
- Consumes: `apiUrl`, `request` de `../lib/http`; `EvaluacionDto`, `RubricaDto` de `../types/api`.
- Produces (además de lo de Task 2, sin tocar):
  - `export function guardarAvance(id: number, observaciones: string): Promise<{ message: string }>` (`POST /evaluacion/:id/guardar-parcial`).
  - `export interface CriterioInput { key: string; puntaje: number; observacion?: string }`.
  - `export interface EnviarEvaluacionPayload { observaciones: string; completa: true; criterios: CriterioInput[] }`.
  - `export function enviarEvaluacion(id, payload): Promise<EvaluacionDetalleDto>` (`PUT /evaluacion/:id`).
  - `export function declararConflicto(id: number): Promise<{ message: string }>` (`POST /evaluacion/:id/conflicto`).
  - `export function urlDescargarRubrica(id): string` / `urlDescargarDictamen(id): string` (`apiUrl(...)`, se pasan a `abrirDocumento`).

Nota (hallazgo técnico): `guardar-parcial` y `conflicto` devuelven `{message}` (backend `evaluacion.service.ts:601`/`:616`), NO un objeto de evaluación. `PUT /evaluacion/:id` sí devuelve `toResponse` (`EvaluacionDetalleDto`). Los endpoints de descarga responden 302→URL firmada o buffer PDF: `abrirDocumento` (que usa `downloadAsync`, sigue redirecciones y agrega el Bearer) los maneja bien.

- [ ] **Step 1: Reemplazar el contenido completo de `src/services/evaluacion.service.ts` (5 min)**

Reemplaza por (todo lo de Task 2 + las 5 funciones nuevas; cambia la import de `http` para incluir `apiUrl`):

```typescript
// src/services/evaluacion.service.ts
import { apiUrl, request } from '../lib/http'
import type { EvaluacionDto, RubricaDto } from '../types/api'

// GET /evaluacion — un evaluador solo ve las suyas; coordinador/admin ven todas.
export function list(skip = 0, limit = 100): Promise<EvaluacionDto[]> {
  return request<EvaluacionDto[]>('/evaluacion', { query: { skip, limit } })
}

// Forma REAL de POST /evaluacion/expediente/:id/asignar (asignar(), 207-212).
export interface AsignarEvaluadorResponse {
  message: string
  evaluacionId: number
  evaluador: { id: number; nombre: string; apellido: string }
  expedienteCodigo: string | null
}

// POST /evaluacion/expediente/:id/asignar — 1 evaluador por expediente (400 si ya tiene uno).
export function asignarEvaluador(
  expedienteId: number,
  evaluadorId: number,
): Promise<AsignarEvaluadorResponse> {
  return request<AsignarEvaluadorResponse>(`/evaluacion/expediente/${expedienteId}/asignar`, {
    method: 'POST',
    body: { evaluadorId },
  })
}

// ==================== Rol Evaluador (Fase 6) ====================

// Forma REAL de la API de evaluación (toResponse, evaluacion.service.ts:56-83):
// usa rubricaPdfUrl/dictamenPdfUrl (no ...Path), no anida expediente/evaluador,
// aplana título/investigador/fecha/creado. NO es el EvaluacionDto compartido.
export interface EvaluacionCriterioResp {
  criterioKey: string
  puntaje: number
  observacion: string | null
}

export interface EvaluacionDetalleDto {
  id: number
  expedienteId: number
  evaluadorId: number
  recommendation: string | null
  observaciones: string | null
  completa: boolean
  conflictoInteres: boolean
  tituloProtocolo: string | null
  investigadorNombre: string | null
  expedienteFechaEnvio: string | null
  criterios: EvaluacionCriterioResp[]
  puntajeTotal: number | null
  resultado: string | null
  rubricaPdfUrl: string | null
  dictamenPdfUrl: string | null
  createdAt: string | null
}

// mis-evaluaciones y :id comparten toResponse -> misma forma (alias).
export type MiEvaluacionDto = EvaluacionDetalleDto

export function misEvaluaciones(): Promise<MiEvaluacionDto[]> {
  return request<MiEvaluacionDto[]>('/evaluacion/mis-evaluaciones')
}

export function getById(id: number): Promise<EvaluacionDetalleDto> {
  return request<EvaluacionDetalleDto>(`/evaluacion/${id}`)
}

// GET /evaluacion/rubrica — coincide 1:1 con el RubricaDto compartido.
export function getRubrica(): Promise<RubricaDto> {
  return request<RubricaDto>('/evaluacion/rubrica')
}

// POST /evaluacion/:id/guardar-parcial — SOLO persiste `observaciones`
// (limitación real del backend; NO guarda puntajes parciales). Devuelve
// {message}, NO un objeto de evaluación -> el consumidor NO debe pisar su
// estado local con esta respuesta.
export function guardarAvance(id: number, observaciones: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/evaluacion/${id}/guardar-parcial`, {
    method: 'POST',
    body: { observaciones },
  })
}

export interface CriterioInput {
  key: string
  puntaje: number
  observacion?: string
}

export interface EnviarEvaluacionPayload {
  observaciones: string
  completa: true
  criterios: CriterioInput[]
}

// PUT /evaluacion/:id — envío definitivo (completa: true). SÍ devuelve el
// objeto completo real (toResponse) -> se puede usar para refrescar estado.
export function enviarEvaluacion(id: number, payload: EnviarEvaluacionPayload): Promise<EvaluacionDetalleDto> {
  return request<EvaluacionDetalleDto>(`/evaluacion/${id}`, { method: 'PUT', body: payload })
}

// POST /evaluacion/:id/conflicto — irreversible. Devuelve {message}, NO un
// objeto de evaluación -> el consumidor solo marca conflictoInteres localmente.
export function declararConflicto(id: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/evaluacion/${id}/conflicto`, { method: 'POST' })
}

// URLs de descarga de PDFs (rúbrica/dictamen). Se pasan a abrirDocumento()
// (documentDownload.ts), que agrega el Bearer, sigue la redirección 302 a la
// URL firmada si aplica, y abre el share sheet nativo.
export function urlDescargarRubrica(id: number): string {
  return apiUrl(`/evaluacion/${id}/descargar-rubrica`)
}
export function urlDescargarDictamen(id: number): string {
  return apiUrl(`/evaluacion/${id}/descargar-dictamen`)
}
```

- [ ] **Step 2: Typecheck (2-5 min)**

```bash
npm run typecheck -w @comite/mobile
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/services/evaluacion.service.ts
git commit -m "feat(mobile): evaluacion.service — guardarAvance/enviarEvaluacion/declararConflicto + URLs de PDF"
```

---

### Task 7: Pantalla de Evaluación — parte 2: 3 acciones + estados de bloqueo + descarga de PDFs (fix dictamen)

**Files:**
- Modify: `apps/mobile/app/(evaluador)/evaluacion/[id].tsx` (reemplaza el archivo completo por la versión final con acciones)

**Interfaces:**
- Consumes (además de lo de la parte 1): `useConfirm()`; `evaluacionService.guardarAvance/enviarEvaluacion/declararConflicto/urlDescargarRubrica/urlDescargarDictamen` (Task 6).
- Produces: pantalla de Evaluación completa. Modo editable → 3 botones (Guardar avance / Enviar evaluación con validación + confirm / Declarar conflicto con confirm `peligroso`). Modo `conflicto` → nota, sin acciones. Modo `soloLectura` (completa) → botones de descarga de PDF (rúbrica siempre; **dictamen SOLO si `resultado` ∈ {aprobado, aprobado_observaciones}** — fix del bug de la web). `guardarAvance`/`declararConflicto` NO pisan el estado local (solo mensaje / marca conflicto); `enviarEvaluacion` sí refresca el estado.

- [ ] **Step 1: Reemplazar `app/(evaluador)/evaluacion/[id].tsx` con la versión final (15 min)**

```tsx
// app/(evaluador)/evaluacion/[id].tsx
import { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Button, Card, ErrorText, Field, Loading, Screen, SectionTitle, TextArea } from '../../../src/components/ui'
import TopBar from '../../../src/components/TopBar'
import { colors } from '../../../src/lib/theme'
import { formatearFecha } from '../../../src/lib/dates'
import { ApiError, apiUrl } from '../../../src/lib/http'
import { abrirDocumento } from '../../../src/lib/documentDownload'
import { puntajeAcumulado, resultadoPrevisto, type ResultadoRubrica } from '../../../src/lib/rubricaResultado'
import { evaluacionService, expedientesService } from '../../../src/services'
import { useConfirm } from '../../../src/state/ConfirmContext'
import type { DocumentoDto, ExpedienteDto, RubricaDto } from '../../../src/types/api'
import type { EvaluacionDetalleDto } from '../../../src/services/evaluacion.service'

interface CriterioEstado {
  puntaje: string
  observacion: string
}

const RESULTADO_LABEL: Record<ResultadoRubrica, string> = {
  aprobado: 'Aprobado',
  aprobado_observaciones: 'Aprobado con observaciones',
  no_aprobado: 'No aprobado',
}
const RESULTADO_COLOR: Record<ResultadoRubrica, string> = {
  aprobado: colors.success,
  aprobado_observaciones: colors.warn,
  no_aprobado: colors.danger,
}

export default function Evaluacion() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const evaluacionId = Number(id)
  const confirmar = useConfirm()

  const [evaluacion, setEvaluacion] = useState<EvaluacionDetalleDto | null>(null)
  const [rubrica, setRubrica] = useState<RubricaDto | null>(null)
  const [expediente, setExpediente] = useState<ExpedienteDto | null>(null)
  const [documentos, setDocumentos] = useState<DocumentoDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [criteriosEstado, setCriteriosEstado] = useState<Record<string, CriterioEstado>>({})
  const [observacionesGenerales, setObservacionesGenerales] = useState('')

  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [declarando, setDeclarando] = useState(false)
  const [abriendo, setAbriendo] = useState<number | null>(null)
  const [descargando, setDescargando] = useState<'rubrica' | 'dictamen' | null>(null)

  useEffect(() => {
    if (!Number.isFinite(evaluacionId)) {
      setErrorCarga('El identificador de la evaluación no es válido.')
      setCargando(false)
      return
    }
    let cancelado = false
    async function cargar() {
      setCargando(true)
      setErrorCarga('')
      try {
        const [ev, rub] = await Promise.all([
          evaluacionService.getById(evaluacionId),
          evaluacionService.getRubrica(),
        ])
        if (cancelado) return
        setEvaluacion(ev)
        setRubrica(rub)
        setObservacionesGenerales(ev.observaciones ?? '')
        const inicial: Record<string, CriterioEstado> = {}
        for (const c of rub.criterios) {
          const existente = ev.criterios.find(cr => cr.criterioKey === c.key)
          inicial[c.key] = {
            puntaje: existente?.puntaje != null ? String(existente.puntaje) : '',
            observacion: existente?.observacion ?? '',
          }
        }
        setCriteriosEstado(inicial)
        try {
          const detalle = await expedientesService.getDetalle(ev.expedienteId)
          if (cancelado) return
          setExpediente(detalle.expediente)
          setDocumentos(detalle.documentos)
        } catch {
          // resumen/documentos opcionales
        }
      } catch (e) {
        if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar la evaluación.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [evaluacionId])

  const total = useMemo(() => {
    if (!rubrica) return 0
    const puntajes: Record<string, string> = {}
    for (const c of rubrica.criterios) puntajes[c.key] = criteriosEstado[c.key]?.puntaje ?? ''
    return puntajeAcumulado(rubrica, puntajes)
  }, [rubrica, criteriosEstado])

  const resultado = useMemo<ResultadoRubrica | null>(
    () => (rubrica ? resultadoPrevisto(rubrica, total) : null),
    [rubrica, total],
  )

  const soloLectura = evaluacion?.completa === true
  const conflicto = evaluacion?.conflictoInteres === true
  const bloqueado = soloLectura || conflicto

  function actualizarCriterio(key: string, campo: keyof CriterioEstado, valor: string) {
    setCriteriosEstado(prev => ({ ...prev, [key]: { ...prev[key], [campo]: valor } }))
  }

  function validarParaEnviar(): string | null {
    if (!rubrica) return 'La rúbrica aún no se ha cargado.'
    for (const c of rubrica.criterios) {
      const valor = criteriosEstado[c.key]?.puntaje ?? ''
      if (valor.trim() === '') return `Falta asignar el puntaje de "${c.nombre}".`
      const n = Number(valor)
      if (Number.isNaN(n) || n < 0 || n > c.puntajeMax) return `El puntaje de "${c.nombre}" debe estar entre 0 y ${c.puntajeMax}.`
    }
    return null
  }

  async function onGuardarAvance() {
    if (!evaluacion) return
    setGuardando(true); setError(''); setMensaje('')
    try {
      // guardar-parcial SOLO persiste observaciones (paridad con la web; los
      // puntajes viven en estado local hasta Enviar). La respuesta {message}
      // NO pisa el estado local (el bug de la web que sí lo pisa NO se replica).
      const res = await evaluacionService.guardarAvance(evaluacion.id, observacionesGenerales)
      setMensaje(res.message || 'Avance guardado correctamente.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar el avance.')
    } finally {
      setGuardando(false)
    }
  }

  async function onEnviar() {
    if (!evaluacion || !rubrica) return
    const problema = validarParaEnviar()
    if (problema) { setError(problema); setMensaje(''); return }
    if (!(await confirmar('Esta acción no se puede deshacer.', {
      titulo: 'Enviar evaluación de forma definitiva',
      textoConfirmar: 'Enviar evaluación',
    }))) return
    setEnviando(true); setError(''); setMensaje('')
    try {
      const actualizado = await evaluacionService.enviarEvaluacion(evaluacion.id, {
        observaciones: observacionesGenerales,
        completa: true,
        criterios: rubrica.criterios.map(c => ({
          key: c.key,
          puntaje: Number(criteriosEstado[c.key].puntaje),
          observacion: criteriosEstado[c.key].observacion.trim() || undefined,
        })),
      })
      // enviarEvaluacion SÍ devuelve el objeto completo (toResponse): se usa
      // para refrescar el estado y pasar a modo solo-lectura.
      setEvaluacion(actualizado)
      setMensaje('Evaluación enviada correctamente.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo enviar la evaluación.')
    } finally {
      setEnviando(false)
    }
  }

  async function onDeclararConflicto() {
    if (!evaluacion) return
    if (!(await confirmar('Esta acción es irreversible y te retirará del proceso de evaluación.', {
      titulo: 'Declarar conflicto de interés',
      textoConfirmar: 'Declarar conflicto',
      peligroso: true,
    }))) return
    setDeclarando(true); setError(''); setMensaje('')
    try {
      // declararConflicto devuelve {message}; NO pisa el estado local (bug de la
      // web NO replicado). Se refleja el bloqueo marcando conflicto sobre el
      // estado ya cargado, sin sustituir el objeto por uno incompleto.
      const res = await evaluacionService.declararConflicto(evaluacion.id)
      setEvaluacion(prev => (prev ? { ...prev, conflictoInteres: true } : prev))
      setMensaje(res.message || 'Has declarado conflicto de interés. Ya no puedes continuar con esta evaluación.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo declarar el conflicto de interés.')
    } finally {
      setDeclarando(false)
    }
  }

  async function onAbrirDocumento(doc: DocumentoDto) {
    if (!expediente) return
    try {
      setAbriendo(doc.id); setError('')
      await abrirDocumento(apiUrl(`/expedientes/${expediente.id}/documentos/${doc.id}/descargar`), doc.nombreArchivo)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : 'No se pudo abrir el documento.'))
    } finally {
      setAbriendo(null)
    }
  }

  async function onDescargarPdf(tipo: 'rubrica' | 'dictamen') {
    if (!evaluacion) return
    try {
      setDescargando(tipo); setError('')
      const url = tipo === 'rubrica'
        ? evaluacionService.urlDescargarRubrica(evaluacion.id)
        : evaluacionService.urlDescargarDictamen(evaluacion.id)
      await abrirDocumento(url, `${tipo}-evaluacion-${evaluacion.id}.pdf`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : `No se pudo descargar ${tipo === 'rubrica' ? 'la rúbrica' : 'el dictamen'}.`))
    } finally {
      setDescargando(null)
    }
  }

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Evaluación" />
        <Loading label="Cargando evaluación…" />
      </View>
    )
  }

  if (errorCarga || !evaluacion || !rubrica) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Evaluación" />
        <View style={{ padding: 16 }}><ErrorText>{errorCarga || 'No se pudo cargar la evaluación.'}</ErrorText></View>
      </View>
    )
  }

  const pct = Math.min(100, Math.round((total / rubrica.puntajeTotalMax) * 100))
  // FIX (spec, decisión 3): el dictamen SOLO existe para aprobado /
  // aprobado_observaciones -> el botón de descarga solo se muestra en esos
  // casos (la web lo muestra erróneamente también en no_aprobado).
  const hayDictamen = evaluacion.resultado === 'aprobado' || evaluacion.resultado === 'aprobado_observaciones'

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar titulo="Evaluación" />
      <Screen>
        <Card>
          <Text style={s.cardTitle}>Resumen del expediente</Text>
          <Text style={s.line}><Text style={s.k}>Código: </Text>{expediente?.codigoUnico ?? `Expediente #${evaluacion.expedienteId}`}</Text>
          <Text style={s.line}><Text style={s.k}>Evaluación: </Text>#{evaluacion.id}</Text>
          <Text style={s.line}><Text style={s.k}>Título: </Text>{expediente?.tituloProtocolo ?? evaluacion.tituloProtocolo ?? 'Título no disponible'}</Text>
          {!!expediente?.facultad && <Text style={s.line}><Text style={s.k}>Facultad: </Text>{expediente.facultad}</Text>}
          {!!expediente?.tipoTramite && <Text style={s.line}><Text style={s.k}>Tipo: </Text>{expediente.tipoTramite}</Text>}
          <Text style={s.line}><Text style={s.k}>Investigador: </Text>{expediente?.investigadorNombre ?? evaluacion.investigadorNombre ?? 'No disponible'}</Text>
          <Text style={s.line}><Text style={s.k}>Fecha de envío: </Text>{formatearFecha(expediente?.fechaEnvio ?? evaluacion.expedienteFechaEnvio ?? null)}</Text>
        </Card>

        <SectionTitle>Documentos para revisión</SectionTitle>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {documentos.map(d => (
            <View key={d.id} style={s.docRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={s.docNombre}>{d.nombreArchivo}</Text>
                <Text style={s.docTipo}>{d.tipoDocumento}</Text>
              </View>
              <Button
                title={abriendo === d.id ? 'Abriendo…' : 'Abrir'}
                variant="outline"
                loading={abriendo === d.id}
                onPress={() => onAbrirDocumento(d)}
                style={{ paddingHorizontal: 16, paddingVertical: 9 }}
              />
            </View>
          ))}
          {documentos.length === 0 && <Text style={s.vacioRow}>No hay documentos disponibles para este expediente en este momento.</Text>}
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <Text style={s.progLabel}>Puntaje acumulado</Text>
            <Text style={s.progValor}>{total} / {rubrica.puntajeTotalMax}</Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${pct}%`, backgroundColor: resultado ? RESULTADO_COLOR[resultado] : colors.primary }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <Text style={s.progHint}>Resultado previsto</Text>
            <Text style={[s.progResultado, { color: resultado ? RESULTADO_COLOR[resultado] : colors.slate500 }]}>{resultado ? RESULTADO_LABEL[resultado] : '—'}</Text>
          </View>
        </Card>

        <SectionTitle>Criterios de evaluación</SectionTitle>
        <View style={{ gap: 12 }}>
          {rubrica.criterios.map(c => {
            const opciones = Array.from({ length: c.puntajeMax + 1 }, (_, n) => n)
            const puntajeSel = criteriosEstado[c.key]?.puntaje ?? ''
            return (
              <Card key={c.key} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={s.critNombre}>{c.nombre}</Text>
                  <Text style={s.critMax}>máx. {c.puntajeMax} pts</Text>
                </View>
                <Text style={s.critDesc}>{c.descripcion}</Text>
                <Field label="Puntaje">
                  <View style={s.segment}>
                    {opciones.map(n => {
                      const sel = puntajeSel === String(n)
                      return (
                        <Pressable
                          key={n}
                          disabled={bloqueado}
                          onPress={() => actualizarCriterio(c.key, 'puntaje', String(n))}
                          style={[s.segItem, sel && s.segItemActive, bloqueado && s.segItemDisabled]}
                        >
                          <Text style={[s.segText, sel && s.segTextActive]}>{n}</Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </Field>
                <Field label="Observación (opcional)">
                  <TextArea
                    editable={!bloqueado}
                    placeholder="Comentario sobre este criterio…"
                    value={criteriosEstado[c.key]?.observacion ?? ''}
                    onChangeText={v => actualizarCriterio(c.key, 'observacion', v)}
                    style={{ minHeight: 60 }}
                  />
                </Field>
              </Card>
            )
          })}
        </View>

        <Field label="Observaciones generales">
          <TextArea
            editable={!bloqueado}
            placeholder="Comentarios generales sobre el protocolo…"
            value={observacionesGenerales}
            onChangeText={setObservacionesGenerales}
          />
        </Field>

        {!!error && <ErrorText>{error}</ErrorText>}
        {!!mensaje && !error && <Text style={s.exito}>{mensaje}</Text>}

        {/* Acciones según el estado de la evaluación */}
        {soloLectura ? (
          <View style={{ gap: 10 }}>
            <Button
              title={descargando === 'rubrica' ? 'Abriendo…' : 'Descargar rúbrica (PDF)'}
              variant="outline"
              loading={descargando === 'rubrica'}
              onPress={() => onDescargarPdf('rubrica')}
            />
            {hayDictamen && (
              <Button
                title={descargando === 'dictamen' ? 'Abriendo…' : 'Descargar dictamen (PDF)'}
                loading={descargando === 'dictamen'}
                onPress={() => onDescargarPdf('dictamen')}
              />
            )}
          </View>
        ) : conflicto ? (
          <Text style={s.muted}>Declaraste conflicto de interés en esta evaluación; ya no puedes editarla.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            <Button title={guardando ? 'Guardando…' : 'Guardar avance'} variant="outline" loading={guardando} onPress={onGuardarAvance} />
            <Button title={enviando ? 'Enviando…' : 'Enviar evaluación'} loading={enviando} onPress={onEnviar} />
            <Button title={declarando ? 'Declarando…' : 'Declarar conflicto de interés'} variant="danger" loading={declarando} onPress={onDeclararConflicto} />
          </View>
        )}
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  cardTitle: { fontSize: 12, fontWeight: '700', color: colors.navy, marginBottom: 8 },
  line: { fontSize: 12.5, color: colors.slate700, lineHeight: 19 },
  k: { fontWeight: '700', color: colors.ink },
  docRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  docNombre: { fontSize: 13, fontWeight: '600', color: colors.ink },
  docTipo: { fontSize: 11.5, color: colors.slate400, marginTop: 2 },
  vacioRow: { fontSize: 12.5, color: colors.slate500, padding: 14 },
  progLabel: { fontSize: 12.5, fontWeight: '600', color: colors.slate700 },
  progValor: { fontSize: 15, fontWeight: '700', color: colors.ink },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: colors.lineSoft, overflow: 'hidden' },
  barFill: { height: '100%' },
  progHint: { fontSize: 12, color: colors.slate500 },
  progResultado: { fontSize: 13, fontWeight: '700' },
  critNombre: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.ink },
  critMax: { fontSize: 12, fontWeight: '600', color: colors.slate400 },
  critDesc: { fontSize: 12, color: colors.slate500, lineHeight: 17 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segItem: { minWidth: 40, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  segItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segItemDisabled: { opacity: 0.5 },
  segText: { fontSize: 13, color: colors.slate500, fontWeight: '700' },
  segTextActive: { color: '#fff' },
  exito: { color: colors.success, fontSize: 13, fontWeight: '600' },
  muted: { fontSize: 13, color: colors.slate500, lineHeight: 18 },
})
```

- [ ] **Step 2: Typecheck (2-5 min)**

```bash
npm run typecheck -w @comite/mobile
```

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(evaluador)/evaluacion/[id].tsx"
git commit -m "feat(mobile): Evaluación parte 2 (3 acciones + bloqueo/solo-lectura/conflicto + PDFs con fix de dictamen)"
```

---

### Task 8: Verificación final — typecheck/test global, README y checklist E2E Android

**Files:**
- Modify: `apps/mobile/README.md` (rol Evaluador + estructura; actualizar el fallback de rol no implementado a solo administrador)

**Interfaces:**
- Consumes: toda la app.
- Produces: verificación de que Evaluador funciona E2E en Android real contra la API, y de que agregar el grupo `(evaluador)` NO rompió los flujos ya verificados de Solicitante/Secretaría/Coordinador.

- [ ] **Step 1: `npm run typecheck` y `npm test` globales del monorepo (2-5 min)**

```bash
npm run build -w @comite/shared
npm run typecheck    # turbo: no debe romper @comite/mobile ni el resto
npm test             # turbo: tests de mobile (roles, bandejaFilter, coordinadorFilter, evaluadorCarga, evaluacionBandejaFilter, rubricaResultado, fileName, mappers, documentFormats) en verde
```

- [ ] **Step 2: Actualizar `apps/mobile/README.md` (5 min)**

En la sección "Estructura", tras la viñeta del grupo `app/(coordinador)/`, agregar:
```markdown
- `app/(evaluador)/` — grupo del rol Evaluador (guard de sesión + Tabs de
  2 pestañas): `index` (Bandeja de evaluaciones) y `perfil`, más la ruta oculta
  `evaluacion/[id]` (rúbrica de 7 criterios + 3 acciones + descarga de PDFs, se
  llega solo tocando una fila de la Bandeja). La redirección post-login elige el
  grupo según el rol (`src/lib/roles.ts` → `homeGroupForRole`).
```

En la sección "Alcance de este corte" → "Incluido", tras la viñeta del rol Coordinador, agregar:
```markdown
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
```

En la sección "Fuera de alcance (deliberado)", actualizar la mención al rol no implementado para que diga **solo administrador** (evaluador ya está implementado): donde el texto del checklist E2E de Fase 5 menciona el caso "rol aún no implementado (`evaluador@uch.edu.pe` / `admin@uch.edu.pe`)", agregar la nota de que a partir de Fase 6 **solo `admin@uch.edu.pe`** cae en "rol no disponible" y `evaluador@uch.edu.pe` entra a su grupo real. Añadir además el bloque de checklist E2E de Fase 6 pendiente en Android (mismo formato que los de Fase 3/4/5):
```markdown
- El **recorrido manual del checklist E2E del rol Evaluador en Android real**
  (Fase 6, Task 8 Step 3 de este plan) queda pendiente por el mismo motivo:
  login directo al grupo `(evaluador)` con sus 2 pestañas, Bandeja
  (lista/búsqueda/filtro de fecha/badges), Evaluación (rúbrica con selector de
  píldoras, preview en vivo, apertura de documentos y PDFs vía share sheet,
  Guardar/Enviar/Conflicto, modo solo-lectura y fix del botón de dictamen),
  Perfil, y las regresiones de Fases 3/4/5 más el caso del `administrador` (único
  rol ya no implementado). Debe ejecutarlo alguien con acceso a un
  dispositivo/emulador antes de dar por cerrada la verificación E2E de Fase 6.
```

- [ ] **Step 3: Recorrer el checklist E2E en Android real contra la API real (15-20 min)**

```bash
# Terminal 1: API real
npm run build -w @comite/shared
npm run dev -w @comite/api
# Terminal 2: Expo (Android)
npm run dev -w @comite/mobile   # 'a' para emulador, o QR en Expo Go (dispositivo físico)
```

Checklist E2E — cuenta `evaluador@uch.edu.pe` (marcar cada uno):
- Login como evaluador → entra directo al grupo `(evaluador)` con **2 pestañas** (Bandeja/Perfil), sin pasar por los tab bars de los otros roles.
- Bandeja: lista SOLO las evaluaciones asignadas al evaluador logueado; cada fila muestra título, estudiante, código y fecha reales (el código viene del `getById` por fila — N+1).
- Cada fila muestra el badge correcto: **"Completada"** (verde) si `completa`, **"Pendiente"** (azul) si no; **"⚠ Conflicto de interés"** (naranja) adicional si aplica.
- Búsqueda por texto (código/título/estudiante) filtra; los filtros de fecha (AAAA-MM-DD) acotan por `fechaEnvio`; "Limpiar" resetea.
- Tocar una evaluación **pendiente** → abre "Evaluación": resumen del expediente + investigador, documentos con "Abrir" (share sheet nativo, verificando que el `Authorization` llega), preview de puntaje/resultado, y los 7 criterios con selector de **píldoras** 0..máx + observación.
- Ajustar puntajes → el preview de "Puntaje acumulado" y "Resultado previsto" (con su color) se actualiza en vivo; los umbrales 0-12 / 13-16 / 17-20 dan No aprobado / Aprobado con observaciones / Aprobado.
- "Guardar avance": guarda (mensaje de éxito) y **NO** cambia el estado ni pierde los puntajes tecleados en pantalla (pero sí se perderían al salir — comportamiento esperado, no se persisten puntajes parciales).
- "Enviar evaluación" con un criterio sin puntaje → muestra el error de validación y NO abre el diálogo; con los 7 completos → pide confirmación; al confirmar, envía y la pantalla pasa a **solo-lectura**.
- En solo-lectura: aparecen los botones de descarga; **"Descargar rúbrica (PDF)"** siempre; **"Descargar dictamen (PDF)" SOLO** si el resultado fue aprobado / aprobado con observaciones (verificar que en un `no_aprobado` NO aparece — este es el fix del bug de la web). La descarga abre el PDF vía share sheet.
- "Declarar conflicto de interés" (en otra evaluación pendiente) → pide confirmación (estilo peligroso); al confirmar, la pantalla se bloquea con la nota de conflicto y NO se pierde el resto del estado cargado.
- Volver a la Bandeja tras enviar/declarar conflicto → el badge de esa fila refleja el nuevo estado **SIN recargar la app** (prueba de `useFocusEffect`).
- Perfil (evaluador): muestra el rol "Evaluador", stats **Pendientes/Completadas** (desde `misEvaluaciones()`) y la fila "Evaluaciones asignadas"; "Cerrar sesión" limpia SecureStore y vuelve a Login.
- **Regresión Fase 3/4/5 (crítico):** entrar con solicitante / `secretaria@uch.edu.pe` / `coordinador@uch.edu.pe` → cada uno entra a su grupo con sus pestañas y flujos intactos.
- **Rol aún no implementado:** entrar con `admin@uch.edu.pe` → muestra "Tu rol todavía no está disponible en la app móvil" (NO el Dashboard del solicitante); "Cerrar sesión" funciona.
- Anti-loop: no hay bucle de redirección entre los 4 grupos en ningún login; la sesión persistente reabre en el grupo correcto por rol.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/README.md
git commit -m "docs(mobile): README rol Evaluador + verificación E2E Android Fase 6"
```

---

## Self-review (autor del plan)

**Cobertura del spec (3 pantallas + 6 funciones de servicio + 3 decisiones + 3 hallazgos técnicos):**
- Pantalla 1 (Bandeja): Task 4 — `misEvaluaciones()` + N+1 `getById` por fila (replicado a propósito), `useFocusEffect`, badges Completada/Pendiente/Conflicto, filtro `evaluacionBandejaFilter.ts` que **reutiliza** `filtrarExpedientes` (no duplica).
- Pantalla 2 (Evaluación): Task 5 (parte 1: datos + rúbrica con Selector-píldora + preview en vivo + documentos) y Task 7 (parte 2: 3 acciones + bloqueo/solo-lectura/conflicto + PDFs con fix de dictamen). Cálculo de puntaje/resultado en `rubricaResultado.ts` (puro + test).
- Pantalla 3 (Perfil): Task 3 — tercera rama en `PerfilScreen.tsx` (`esEvaluador`) con stats Pendientes/Completadas desde `misEvaluaciones()` + wrapper real `(evaluador)/perfil.tsx`.
- Servicios: Task 2 (lectura: `misEvaluaciones`/`getById`/`getRubrica`) y Task 6 (mutantes: `guardarAvance`/`enviarEvaluacion`/`declararConflicto` + `urlDescargarRubrica`/`urlDescargarDictamen`). `list`/`asignarEvaluador` de Fase 5 quedan intactos.
- Arquitectura: `homeGroupForRole` gana `'/(evaluador)'` y saca evaluador del fallback (Task 1); grupo `(evaluador)/` con `_layout` de 2 tabs + ruta oculta `evaluacion/[id]` (Task 3). Los otros 3 grupos no se tocan.
- Fuera de alcance (respetado, ninguna tarea lo introduce): preview embebido de PDF, guardado real de puntajes parciales, `POST /evaluacion`, reasignar/desasignar.

**Escaneo de placeholders (red flags):** Los únicos "placeholder" son `(evaluador)/index.tsx` y `(evaluador)/evaluacion/[id].tsx` creados en Task 3 a propósito para escribir el `_layout` una sola vez; **cada uno se sobrescribe con código completo** (index→T4, evaluacion/[id]→T5 y luego T7). El wrapper de Perfil (T3) es real. La Evaluación se construye incrementalmente (T5 archivo completo y ejecutable; T7 reemplazo completo con acciones): NO hay pseudocódigo, "TBD" ni "similar a Task N" — todo el código va inline y completo, incluidos los dos módulos puros con sus tests.

**Consistencia de tipos/firmas (verificada contra el código real):**
- `EvaluacionDetalleDto` (definido en T2 y re-declarado idéntico en el reemplazo de T6) se importa desde `../../../src/services/evaluacion.service` en la pantalla de Evaluación (T5/T7) con EXACTAMENTE ese nombre y forma (incluye `criterios: {criterioKey, puntaje, observacion}[]`, `resultado`, `completa`, `conflictoInteres`, `tituloProtocolo`, `investigadorNombre`, `expedienteFechaEnvio`). Confirmado 1:1 contra `toResponse` (`evaluacion.service.ts:56-83`).
- `MiEvaluacionDto = EvaluacionDetalleDto` — usado en `evaluacionBandejaFilter.ts` (`FilaEvaluacion.evaluacion`) y en su test (T4), y en `PerfilScreen` (`e.completa`). La forma idéntica está garantizada por el alias (no dos definiciones que puedan divergir).
- `RubricaDto` compartido (`{criterios: {key,nombre,descripcion,puntajeMax}[], puntajeTotalMax, umbrales:{aprobado,aprobado_observaciones,no_aprobado}}`) — `getRubrica()` lo devuelve; `rubricaResultado.ts` (T5) lo consume con esos campos. Confirmado en `packages/shared/src/types.ts:186-190` y `CRITERIOS_RUBRICA`/`resultadoPorPuntaje` en `constants.ts`.
- `EnviarEvaluacionPayload.criterios: CriterioInput[]` (`{key, puntaje, observacion?}`) casa con lo que el backend `update` valida (`c.key`, `c.puntaje`) y con el payload de la web.
- `filtrarExpedientes(expedientes, filtro, estadoPredicate)` — firma verificada en `expedienteListFilter.ts`; T4 la invoca con predicado `() => true`.
- `abrirDocumento(url: string, nombreArchivo: string): Promise<void>` — firma verificada en `documentDownload.ts`; T5/T7 la consumen igual que `(secretaria)/revision/[id].tsx` (URL vía `apiUrl(...)`, estado `abriendo`/`descargando`).
- `useConfirm(): (mensaje, opciones?) => Promise<boolean>` con `opciones.peligroso` — verificado en `ConfirmContext.tsx` (soporta `titulo`/`textoConfirmar`/`peligroso`).
- `Button({title,onPress,variant,disabled,loading,style})`, `TextArea`/`Input` (aceptan `editable`/`style`), `Field({label,children})`, `Badge({label,bg,fg})`, `Screen`, `Card`, `SectionTitle`, `TopBar({titulo})`, `Loading`, `ErrorText` — firmas verificadas en `ui.tsx`/`TopBar.tsx`. Colores usados (`successBg`/`warnBg`/`blue50`/`success`/`warn`/`danger`/`primary`/`slate*`/`lineSoft`/`line`/`navy`/`ink`) existen en `theme.ts`.
- `usuario` con `nombres`/`apellidos`/`correo`/`rol`/`codigo`/`laboratorio`/`especialidad` — usado en Bandeja/Perfil igual que las pantallas existentes.

**Confirmación explícita de los 5 chequeos requeridos (a-e):**
- (a) **Selector-píldora reutilizado, no reinventado:** T5/T7 usan el patrón de píldoras segmentadas (`segment`/`segItem`/`segItemActive`/`segItemDisabled`/`segText`/`segTextActive`), idéntico al `Selector` de `app/(app)/nuevo/index.tsx`, con opciones `0..c.puntajeMax`. NO hay `<select>` ni stepper nuevo.
- (b) **`guardarAvance`/`declararConflicto` NUNCA pisan el estado local:** `onGuardarAvance` (T7) solo hace `setMensaje(res.message)`; `onDeclararConflicto` solo `setEvaluacion(prev => prev ? {...prev, conflictoInteres:true} : prev)`. Ninguno hace `setEvaluacion(res)`. Solo `onEnviar` refresca con el objeto completo real (`enviarEvaluacion` devuelve `EvaluacionDetalleDto`). Documentado en constraints y en los comentarios del código.
- (c) **Fix de visibilidad del dictamen presente:** `const hayDictamen = evaluacion.resultado === 'aprobado' || evaluacion.resultado === 'aprobado_observaciones'` (T7); el botón de dictamen se renderiza `{hayDictamen && ...}`, así que NO aparece en `no_aprobado` (a diferencia de la web).
- (d) **`expedienteListFilter.ts` reutilizado (adaptación fina documentada), no duplicado:** `evaluacionBandejaFilter.ts` (T4) delega en `filtrarExpedientes` sobre la parte `expediente` de cada fila y reconstruye por `expedienteId` — mismo patrón que `bandejaFilter.ts`/`coordinadorFilter.ts`. La adaptación (predicado siempre-true; filas sin expediente al final solo sin filtros) está comentada en el módulo y cubierta por test.
- (e) **`useFocusEffect`/`useSafeAreaInsets`/`Screen` en cada tarea relevante:** Bandeja (T4) usa `useFocusEffect` + header custom con `useSafeAreaInsets` + cuerpo en `Screen`. Evaluación (T5/T7) usa `useEffect([evaluacionId])` (correcto, no mount-only), `TopBar` (safe area interno) y cuerpo en `Screen` (crítico por ser la pantalla más larga). `PerfilScreen` ya usa `useFocusEffect` + `useSafeAreaInsets` + `Screen`.

**Riesgos / notas para el ejecutor:**
1. **`typedRoutes` y el grupo nuevo:** hasta completar Task 3 (carpeta `(evaluador)/` con su `index`), `typecheck` puede rechazar `'/(evaluador)'` como ruta desconocida (afecta el guard de `roles.ts` en Task 1 y el `router.push('/(evaluador)/evaluacion/...')`). Esperado; se resuelve en Task 3. Los tests unitarios no dependen de `typedRoutes`.
2. **N+1 en la Bandeja:** aceptado como comportamiento real replicado (mis-evaluaciones no trae `codigoUnico`); no se optimiza en este corte.
3. **Descarga de PDFs y redirección 302:** los endpoints `descargar-rubrica`/`descargar-dictamen` responden 302→URL firmada (Supabase) o buffer PDF. `abrirDocumento`/`downloadAsync` sigue redirecciones y solo trata `status === 200` como éxito; si el backend aún no generó el PDF responde 404/NotFound y se muestra el error con `ErrorText` sin crashear. Verificar en E2E que la apertura funciona en ambos casos (buffer y presigned).
4. **`getDetalle` best-effort:** si `GET /expedientes/:id` (o sus sub-fetches) falla, la Evaluación igual se muestra con los campos aplanados de la propia evaluación (`tituloProtocolo`/`investigadorNombre`/`expedienteFechaEnvio`); solo se pierden facultad/tipo/documentos. No bloquea calificar.
5. **Puntajes parciales no persistidos:** por decisión de diseño (paridad con la web), salir de la pantalla antes de "Enviar" pierde los puntajes tecleados. Es intencional; el E2E lo verifica como comportamiento esperado, no como bug.

**Desviaciones respecto al desglose sugerido (7 puntos → 8 tareas):**
- Las funciones de servicio se separaron en dos tareas (T2 lectura, T6 mutantes) en vez de una, para que cada función aterrice justo antes de la tarea que la consume (T2 antes de Perfil/Bandeja/Evaluación-parte-1; T6 antes de Evaluación-parte-2) y mantener commits atómicos con typecheck verde.
- La rama de `PerfilScreen` se movió a la tarea de scaffold (T3) en vez de "Task 1", porque depende de `misEvaluaciones()` (T2); así T3 queda con typecheck limpio.
- El cálculo puro (`rubricaResultado.ts` + test) se integró en la tarea de Evaluación parte 1 (T5), mismo precedente que Fase 5 (que integró `evaluadorCarga` en la tarea de su pantalla).

## Critical Files for Implementation
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\pages\evaluador\Evaluacion.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\pages\evaluador\Bandeja.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\pages\Perfil.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\api\src\evaluacion\evaluacion.service.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\api\src\evaluacion\evaluacion.controller.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\packages\shared\src\constants.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\packages\shared\src\types.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\src\lib\roles.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\src\lib\expedienteListFilter.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\src\lib\documentDownload.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\src\services\evaluacion.service.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\src\components\screens\PerfilScreen.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\src\components\ui.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\app\(coordinador)\index.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\app\(secretaria)\revision\[id].tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\app\(app)\nuevo\index.tsx
