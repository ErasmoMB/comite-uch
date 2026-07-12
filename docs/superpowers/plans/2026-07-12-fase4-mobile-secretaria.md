# App Móvil Expo — Fase 4: Rol Secretaría Técnica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender `apps/mobile` (app Expo ya construida y verificada para el rol Solicitante en Fase 3) con el rol interno **Secretaría técnica**: navegación por rol, y las 4 pantallas equivalentes 1:1 a `apps/web/src/pages/secretaria/*` + el Perfil compartido (Bandeja, Revisión de expediente, Chat, Perfil), consumiendo la misma API NestJS sin tocar `@comite/shared`, `apps/web` ni `apps/api`.

**Architecture:** Se agrega un grupo de rutas hermano `app/(secretaria)/` con su propio `_layout.tsx` (guardia de sesión + Tabs de 3 pestañas: Bandeja / Chat / Perfil). El grupo `(app)/` del Solicitante queda intacto. `app/index.tsx` y `login.tsx` dejan de asumir un único destino y calculan el grupo por rol vía una nueva utilidad `src/lib/roles.ts` (`homeGroupForRole`). Cada layout de grupo redirige al grupo correcto si el rol no le corresponde. Los documentos se descargan al almacenamiento temporal con `expo-file-system` (header `Authorization`) y se abren con el selector nativo vía `expo-sharing` (sin visor embebido). `chat.service.ts` se amplía con el lado secretaría; `expedientes.service.ts` se reutiliza sin cambios.

**Tech Stack:** Expo SDK 54 (React Native 0.81, React 19.1, Expo Router 6, `typedRoutes` ON), TypeScript 5.7, `expo-secure-store` 15, **nuevas:** `expo-file-system` (~19.0.x, SDK 54) + `expo-sharing` (~14.0.x, SDK 54), Jest + `jest-expo` 54, `@comite/shared` (workspace), Turborepo, npm workspaces.

## Global Constraints

- El grupo `app/(app)/` **se queda intacto y sin renombrar** — sigue siendo el grupo del Solicitante (ya verificado en dispositivo real en Fase 3). NO se migra a `(solicitante)/`.
- Se agrega un grupo **nuevo y hermano** `app/(secretaria)/` con 3 pestañas: Bandeja (`index`) / Chat (`chat/index`) / Perfil (`perfil`).
- Roles fuera de alcance de esta fase: Coordinador, Evaluador, Administrador. NO implementarlos.
- **Sin visor de documentos embebido.** "Ver" + "Descargar" de la web se colapsan en un único botón **"Abrir"**: descarga autenticada a temporal + selector nativo "Abrir con…".
- Descargas con `expo-file-system` + `expo-sharing`. En SDK 54 la API de `downloadAsync`/`cacheDirectory` con header `Authorization` vive en el submódulo **`expo-file-system/legacy`** (la API nueva por defecto cambió a clases `File`/`Directory`); usar el import legacy.
- `chat.service.ts` se **AMPLÍA** (no se reemplaza): se agregan `getConversaciones`, `getSolicitantes`, `getHiloDeSolicitante`, `enviarComoSecretaria`. El lado solicitante (`getMiHilo`, `enviarComoSolicitante`, `misNoLeidos`) NO se toca.
- `expedientes.service.ts`, `users.service.ts`, `config.service.ts` — **SIN cambios**, ya cubren todo lo que Secretaría necesita (`list`, `getDetalle`, `update`).
- NO se implementa: notificaciones de secretaría, `GET /chat/no-leidos` (badge total), registro/auto-registro de secretaría, persistencia real del texto de "observaciones" al devolver (el backend `PUT /expedientes/:id` no lo guarda — se replica el comportamiento de la web: se pide y valida el texto, sin inventar persistencia).
- `@comite/shared` NUNCA se modifica. `apps/web` y `apps/api` NO se tocan.
- Endpoints/nombres de funciones/payloads/DTO calcan `apps/web/src/services/*` y `@comite/shared`.
- Reutilizar los primitivos UI existentes (`Card`, `StatusBadge`, `Screen`, `Input`, `Field`, `TextArea`, `ErrorText`, `Loading`, `Button`, `SectionTitle`, `Avatar`, `TopBar`) — no reinventar componentes.
- Patrón de estados igual que Fase 3: `ApiError` capturado y mostrado con `ErrorText`; estados `cargando`/`error`/vacío explícitos; `useConfirm()` antes de acciones irreversibles; flag `activo`/`cancelado` en efectos async.
- `EstadoExpediente` (DTO) y `EstadoProyecto` (dominio) son el mismo union de 8 valores; `StatusBadge` recibe `EstadoProyecto` y `ExpedienteDto.estado` es `EstadoExpediente` → son asignables directamente, sin cast.
- Cada tarea termina con `tsc --noEmit` limpio (y `npm test` si toca tests) + commit. La verificación E2E en Android real se concentra en la última tarea.
- **Roles internos aún no implementados (Coordinador, Evaluador, Administrador) NO caen en el grupo `(app)` del Solicitante.** Verían un Dashboard/wizard pensado para otro rol, con datos potencialmente de todo el sistema mostrados como si fueran "sus" proyectos — confuso y engañoso. En vez de eso, `homeGroupForRole` los manda a una pantalla nueva y mínima `app/rol-no-disponible.tsx` ("Tu rol todavía no está disponible en la app móvil" + botón Cerrar sesión).

---

### Task 1: Scaffold navegación por rol — deps de descarga, `roles.ts`, redirección role-aware

**Files:**
- Modify: `apps/mobile/package.json` (agrega `expo-file-system` y `expo-sharing` vía `expo install`)
- Create: `apps/mobile/src/lib/roles.ts`
- Create: `apps/mobile/src/lib/__tests__/roles.test.ts`
- Create: `apps/mobile/app/rol-no-disponible.tsx`
- Modify: `apps/mobile/app/index.tsx` (redirección role-aware)
- Modify: `apps/mobile/app/login.tsx` (redirección role-aware tras login)
- Modify: `apps/mobile/app/(app)/_layout.tsx` (redirige a otro grupo si el rol no es solicitante)

**Interfaces:**
- Consumes: `RolBackend` de `../types/api`; `ROLES_SOLICITANTE` de `../data/types`; `useApp()` (`{ usuario, cargandoSesion, login, logout }`); `Redirect`/`useRouter` de `expo-router`; `Button`, `Screen` de `../src/components/ui`.
- Produces:
  - `src/lib/roles.ts`: `export type HomeGroup = '/(app)' | '/(secretaria)' | '/rol-no-disponible'` y `export function homeGroupForRole(rol: RolBackend): HomeGroup`.
  - `app/rol-no-disponible.tsx`: pantalla mínima para roles internos aún no implementados (Coordinador/Evaluador/Administrador) — mensaje + botón "Cerrar sesión" → `/login`. NO se muestra el tab bar del solicitante para estos roles.
  - `app/index.tsx`: redirige a `homeGroupForRole(usuario.rol)` si hay sesión, a `/login` si no.
  - `login.tsx`: tras login exitoso, `router.replace(homeGroupForRole(u.rol))` (login devuelve `Usuario`).
  - `(app)/_layout.tsx`: si `homeGroupForRole(usuario.rol) !== '/(app)'`, `<Redirect>` a su grupo/pantalla correcta (evita que un rol interno vea el tab bar del solicitante).

- [ ] **Step 1: Instalar `expo-file-system` y `expo-sharing` con versiones compatibles con SDK 54 (2-5 min)**

```bash
# desde la raíz del monorepo — expo install fija las versiones correctas para el SDK 54 instalado
npx expo install expo-file-system expo-sharing --project apps/mobile
# (si el flag --project no aplica en tu versión de expo-cli, ejecutar dentro de apps/mobile:
#   cd apps/mobile && npx expo install expo-file-system expo-sharing )
# Esperado en apps/mobile/package.json (aprox., lo fija expo install):
#   "expo-file-system": "~19.0.x",
#   "expo-sharing": "~14.0.x"
npm install
```

- [ ] **Step 2: Crear `src/lib/roles.ts` (2-5 min)**

```typescript
// src/lib/roles.ts
import type { RolBackend } from '../types/api'
import { ROLES_SOLICITANTE } from '../data/types'

// Grupo de rutas de Expo Router que le corresponde a un rol. Distinta de
// `homePathForRole` de @comite/shared, que devuelve rutas WEB
// ('/secretaria/bandeja', etc.) y no aplica 1:1 a los grupos de carpetas de
// app/. Acá mapeamos rol -> grupo físico para router.replace / <Redirect>.
export type HomeGroup = '/(app)' | '/(secretaria)' | '/rol-no-disponible'

export function homeGroupForRole(rol: RolBackend): HomeGroup {
  if (ROLES_SOLICITANTE.includes(rol)) return '/(app)'
  if (rol === 'secretaria') return '/(secretaria)'
  // Roles internos aún no implementados (coordinador/evaluador/administrador):
  // NO se mandan a '/(app)' (verían el Dashboard/wizard del solicitante con
  // datos de todo el sistema, confuso y engañoso). Se ampliará en fases
  // futuras agregando sus propios grupos y ramas aquí.
  return '/rol-no-disponible'
}
```

- [ ] **Step 3: Test de `homeGroupForRole` (2-5 min)**

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
  it('roles internos aún no implementados van a la pantalla de rol no disponible, NO a /(app)', () => {
    expect(homeGroupForRole('coordinador')).toBe('/rol-no-disponible')
    expect(homeGroupForRole('evaluador')).toBe('/rol-no-disponible')
    expect(homeGroupForRole('administrador')).toBe('/rol-no-disponible')
  })
})
```

- [ ] **Step 3b: Crear `app/rol-no-disponible.tsx` (2-5 min)**

```tsx
// app/rol-no-disponible.tsx
import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { Button, Screen } from '../src/components/ui'
import { colors } from '../src/lib/theme'
import { ROL_LABEL } from '../src/data/types'
import { useApp } from '../src/state/AppContext'

export default function RolNoDisponible() {
  const { usuario, logout } = useApp()
  const router = useRouter()

  async function cerrarSesion() {
    await logout()
    router.replace('/login')
  }

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.navy, textAlign: 'center' }}>
          Tu rol todavía no está disponible en la app móvil
        </Text>
        <Text style={{ fontSize: 14, color: colors.slate500, textAlign: 'center' }}>
          {usuario ? `Rol: ${ROL_LABEL[usuario.rol]}. ` : ''}
          Por ahora, usa el sitio web del Comité de Ética para esta cuenta.
        </Text>
        <Button title="Cerrar sesión" variant="outline" onPress={cerrarSesion} style={{ marginTop: 12 }} />
      </View>
    </Screen>
  )
}
```

- [ ] **Step 4: Generalizar `app/index.tsx` (redirección role-aware) (2-5 min)**

```tsx
// app/index.tsx
import { Redirect } from 'expo-router'
import { View } from 'react-native'
import { useApp } from '../src/state/AppContext'
import { Loading } from '../src/components/ui'
import { homeGroupForRole } from '../src/lib/roles'

export default function Index() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Iniciando…" /></View>
  return <Redirect href={usuario ? homeGroupForRole(usuario.rol) : '/login'} />
}
```

- [ ] **Step 5: Generalizar la redirección de `app/login.tsx` (2-5 min)**

En `app/login.tsx`, agregar el import y reemplazar el destino fijo por el role-aware. `useApp().login` ya devuelve el `Usuario` logueado.

Agregar import (junto a los demás):
```tsx
import { homeGroupForRole } from '../src/lib/roles'
```

Reemplazar el bloque `try` de `onSubmit`:
```tsx
    try {
      const u = await login(correo.trim(), clave)
      router.replace(homeGroupForRole(u.rol))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
```
(Antes decía `await login(...)` seguido de `router.replace('/(app)')`; ahora se captura el usuario y se navega según su rol.)

- [ ] **Step 6: Guard de rol en `app/(app)/_layout.tsx` (2-5 min)**

Agregar el import de `homeGroupForRole` y, tras el guard de sesión existente, redirigir si el rol no pertenece a `(app)`. El resto del archivo (los `Tabs.Screen`) queda igual.

Import a agregar:
```tsx
import { homeGroupForRole } from '../../src/lib/roles'
```

Reemplazar las dos líneas de guard actuales:
```tsx
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Cargando…" /></View>
  if (!usuario) return <Redirect href="/login" />
```
por:
```tsx
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Cargando…" /></View>
  if (!usuario) return <Redirect href="/login" />
  // Si el rol no corresponde a este grupo (p. ej. secretaría llegó a mano),
  // mándalo a su propio grupo en vez de mostrarle el tab bar del solicitante.
  if (homeGroupForRole(usuario.rol) !== '/(app)') {
    return <Redirect href={homeGroupForRole(usuario.rol)} />
  }
```

- [ ] **Step 7: Test + typecheck (2-5 min)**

```bash
npm run build -w @comite/shared
npm test -w @comite/mobile
npm run typecheck -w @comite/mobile
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/package.json package-lock.json apps/mobile/src/lib/roles.ts apps/mobile/src/lib/__tests__/roles.test.ts apps/mobile/app/rol-no-disponible.tsx apps/mobile/app/index.tsx apps/mobile/app/login.tsx "apps/mobile/app/(app)/_layout.tsx"
git commit -m "feat(mobile): navegación por rol (homeGroupForRole) + deps expo-file-system/expo-sharing"
```

---

### Task 2: Scaffold del grupo `(secretaria)/` — layout de 3 tabs + placeholders

**Files:**
- Create: `apps/mobile/app/(secretaria)/_layout.tsx`
- Create: `apps/mobile/app/(secretaria)/index.tsx` (placeholder Bandeja — se reemplaza en Task 3)
- Create: `apps/mobile/app/(secretaria)/chat/index.tsx` (placeholder — se reemplaza en Task 6)
- Create: `apps/mobile/app/(secretaria)/chat/[solicitanteId].tsx` (placeholder — se reemplaza en Task 7)
- Create: `apps/mobile/app/(secretaria)/revision/[id].tsx` (placeholder — se reemplaza en Task 5)
- Create: `apps/mobile/app/(secretaria)/perfil.tsx` (placeholder — se reemplaza en Task 8)

**Interfaces:**
- Consumes: `useApp()` (`{ usuario, cargandoSesion }`); `Loading` de `../../src/components/ui`; `colors` de `../../src/lib/theme`; `homeGroupForRole` de `../../src/lib/roles`; `Tabs`/`Redirect` de `expo-router`.
- Produces: grupo `(secretaria)/` montado con 3 pestañas (Bandeja=`index`, Chat=`chat/index`, Perfil=`perfil`) y 2 rutas ocultas del tab bar (`revision/[id]`, `chat/[solicitanteId]`). Todas las rutas declaradas en el layout existen como archivo (placeholder) para que Expo Router no falle. Guard: sin sesión → `/login`; rol no-secretaría → su propio grupo.

Nota: se crean placeholders para las 5 rutas que el `_layout` declara para que el layout se escriba **una sola vez** aquí y no haya que tocarlo en tareas posteriores (cada tarea solo sobrescribe el contenido de su archivo).

- [ ] **Step 1: `app/(secretaria)/_layout.tsx` — guard + Tabs de 3 pestañas (2-5 min)**

```tsx
// app/(secretaria)/_layout.tsx
import { Redirect, Tabs } from 'expo-router'
import { Text, View } from 'react-native'
import { useApp } from '../../src/state/AppContext'
import { Loading } from '../../src/components/ui'
import { colors } from '../../src/lib/theme'
import { homeGroupForRole } from '../../src/lib/roles'

// Icono textual simple (mismo criterio que el layout del solicitante).
function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ color, fontSize: 18 }}>{label}</Text>
}

export default function SecretariaLayout() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Cargando…" /></View>
  if (!usuario) return <Redirect href="/login" />
  // Si el usuario no es de secretaría, mándalo a su propio grupo (evita ver
  // pantallas que no le corresponden si navega a mano a esta URL).
  if (homeGroupForRole(usuario.rol) !== '/(secretaria)') {
    return <Redirect href={homeGroupForRole(usuario.rol)} />
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.slate400 }}>
      <Tabs.Screen name="index" options={{ title: 'Bandeja', tabBarIcon: ({ color }) => <TabIcon label="▤" color={color} /> }} />
      <Tabs.Screen name="chat/index" options={{ title: 'Chat', tabBarIcon: ({ color }) => <TabIcon label="💬" color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <TabIcon label="◔" color={color} /> }} />
      {/* Rutas sin pestaña propia (se ocultan del tab bar). */}
      <Tabs.Screen name="revision/[id]" options={{ href: null }} />
      <Tabs.Screen name="chat/[solicitanteId]" options={{ href: null }} />
    </Tabs>
  )
}
```

- [ ] **Step 2: Placeholder `app/(secretaria)/index.tsx` (2 min)**

```tsx
// app/(secretaria)/index.tsx — placeholder, se reemplaza por la Bandeja real en Task 3
import { Screen, SectionTitle } from '../../src/components/ui'

export default function BandejaPlaceholder() {
  return (
    <Screen>
      <SectionTitle>Bandeja de expedientes (placeholder)</SectionTitle>
    </Screen>
  )
}
```

- [ ] **Step 3: Placeholder `app/(secretaria)/chat/index.tsx` (2 min)**

```tsx
// app/(secretaria)/chat/index.tsx — placeholder, se reemplaza en Task 6
import { Screen, SectionTitle } from '../../../src/components/ui'

export default function ChatListaPlaceholder() {
  return (
    <Screen>
      <SectionTitle>Chat (placeholder)</SectionTitle>
    </Screen>
  )
}
```

- [ ] **Step 4: Placeholder `app/(secretaria)/chat/[solicitanteId].tsx` (2 min)**

```tsx
// app/(secretaria)/chat/[solicitanteId].tsx — placeholder, se reemplaza en Task 7
import { Screen, SectionTitle } from '../../../src/components/ui'

export default function ChatHiloPlaceholder() {
  return (
    <Screen>
      <SectionTitle>Hilo de chat (placeholder)</SectionTitle>
    </Screen>
  )
}
```

- [ ] **Step 5: Placeholder `app/(secretaria)/revision/[id].tsx` (2 min)**

```tsx
// app/(secretaria)/revision/[id].tsx — placeholder, se reemplaza en Task 5
import { Screen, SectionTitle } from '../../../src/components/ui'

export default function RevisionPlaceholder() {
  return (
    <Screen>
      <SectionTitle>Revisión de expediente (placeholder)</SectionTitle>
    </Screen>
  )
}
```

- [ ] **Step 6: Placeholder `app/(secretaria)/perfil.tsx` (2 min)**

```tsx
// app/(secretaria)/perfil.tsx — placeholder, se reemplaza por el wrapper de PerfilScreen en Task 8
import { Screen, SectionTitle } from '../../src/components/ui'

export default function PerfilPlaceholder() {
  return (
    <Screen>
      <SectionTitle>Perfil (placeholder)</SectionTitle>
    </Screen>
  )
}
```

- [ ] **Step 7: Verificación de montaje + typecheck (5 min)**

```bash
npm run typecheck -w @comite/mobile
# Android/emulador: login con una cuenta secretaria@uch.edu.pe -> entra al grupo
# (secretaria) con 3 pestañas (Bandeja/Chat/Perfil) mostrando los placeholders.
# Verificar que NO hay loop de redirección entre (app) y (secretaria):
#  - login como secretaría queda estable en (secretaria);
#  - login como solicitante queda estable en (app) (sin parpadeo ni bucle).
```

- [ ] **Step 8: Commit**

```bash
git add "apps/mobile/app/(secretaria)"
git commit -m "feat(mobile): scaffold grupo (secretaria) con layout de 3 tabs y placeholders"
```

---

### Task 3: Bandeja de expedientes — filtro puro + pantalla real

**Files:**
- Create: `apps/mobile/src/lib/bandejaFilter.ts`
- Create: `apps/mobile/src/lib/__tests__/bandejaFilter.test.ts`
- Modify: `apps/mobile/app/(secretaria)/index.tsx` (reemplaza el placeholder)

**Interfaces:**
- Consumes: `expedientesService.list()` (existe, sin cambios) → `Promise<ExpedienteDto[]>`; `fechaLocalISO`, `formatearFecha` de `../lib/dates`; `Card`, `StatusBadge`, `Input`, `ErrorText`, `Loading` de `../components/ui`; `Avatar` de `../components/Avatar`; `useApp()`, `useRouter`, `useSafeAreaInsets`.
- Produces:
  - `bandejaFilter.ts`: `export const ESTADOS_BANDEJA = ['enviado','en_revision','subsanacion'] as const`; `export interface FiltroBandeja { busqueda: string; fechaDesde: string; fechaHasta: string }`; `export function filtrarBandeja(expedientes: ExpedienteDto[], filtro: FiltroBandeja): ExpedienteDto[]`.
  - Pantalla Bandeja (`(secretaria)/index.tsx`): lista filtrable; tap en tarjeta → `router.push(\`/(secretaria)/revision/${e.id}\`)`.

- [ ] **Step 1: `src/lib/bandejaFilter.ts` — lógica pura portada de `Bandeja.tsx` (2-5 min)**

```typescript
// src/lib/bandejaFilter.ts
import { fechaLocalISO } from './dates'
import type { ExpedienteDto } from '../types/api'

// Estados que gestiona la secretaría: recién enviados, en revisión de fondo, o
// reingresados tras subsanación (igual que la web — el backend no filtra por
// estado en el query, se filtra client-side).
export const ESTADOS_BANDEJA = ['enviado', 'en_revision', 'subsanacion'] as const

export interface FiltroBandeja {
  busqueda: string
  fechaDesde: string
  fechaHasta: string
}

export function filtrarBandeja(expedientes: ExpedienteDto[], filtro: FiltroBandeja): ExpedienteDto[] {
  const q = filtro.busqueda.trim().toLowerCase()
  const lista = expedientes
    .filter(e => ESTADOS_BANDEJA.includes(e.estado as (typeof ESTADOS_BANDEJA)[number]))
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

- [ ] **Step 2: Test de `filtrarBandeja` (2-5 min)**

```typescript
// src/lib/__tests__/bandejaFilter.test.ts
import { filtrarBandeja } from '../bandejaFilter'
import type { ExpedienteDto } from '../../types/api'

function exp(over: Partial<ExpedienteDto>): ExpedienteDto {
  return {
    id: 1, codigoUnico: null, tituloProtocolo: 'T', investigadorId: 1, investigadorNombre: null,
    tipoTramite: null, facultad: null, modalidad: null, programaEstudios: null, ciclo: null,
    nivelPosgrado: null, numeroActa: null, tituloAnterior: null, tituloNuevo: null,
    proyectoOrigenId: null, estado: 'enviado', fechaEnvio: null, createdAt: null, updatedAt: null,
    ...over,
  } as ExpedienteDto
}

describe('filtrarBandeja', () => {
  const base = [
    exp({ id: 1, estado: 'enviado', tituloProtocolo: 'Alpha', fechaEnvio: '2026-07-01T10:00:00' }),
    exp({ id: 2, estado: 'en_revision', tituloProtocolo: 'Beta', fechaEnvio: '2026-07-05T10:00:00' }),
    exp({ id: 3, estado: 'aprobado', tituloProtocolo: 'Gamma', fechaEnvio: '2026-07-03T10:00:00' }),
    exp({ id: 4, estado: 'subsanacion', tituloProtocolo: 'Delta', fechaEnvio: '2026-07-02T10:00:00' }),
  ]

  it('descarta estados fuera de la bandeja (aprobado)', () => {
    const r = filtrarBandeja(base, { busqueda: '', fechaDesde: '', fechaHasta: '' })
    expect(r.map(e => e.id).sort()).toEqual([1, 2, 4])
  })
  it('ordena por fechaEnvio descendente', () => {
    const r = filtrarBandeja(base, { busqueda: '', fechaDesde: '', fechaHasta: '' })
    expect(r.map(e => e.id)).toEqual([2, 4, 1])
  })
  it('filtra por texto en título', () => {
    const r = filtrarBandeja(base, { busqueda: 'beta', fechaDesde: '', fechaHasta: '' })
    expect(r.map(e => e.id)).toEqual([2])
  })
  it('filtra por rango de fechas (desde/hasta inclusivo)', () => {
    const r = filtrarBandeja(base, { busqueda: '', fechaDesde: '2026-07-02', fechaHasta: '2026-07-02' })
    expect(r.map(e => e.id)).toEqual([4])
  })
})
```

- [ ] **Step 3: Reemplazar `app/(secretaria)/index.tsx` con la Bandeja real (2-5 min)**

```tsx
// app/(secretaria)/index.tsx
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Card, ErrorText, Input, Loading, StatusBadge } from '../../src/components/ui'
import Avatar from '../../src/components/Avatar'
import { colors } from '../../src/lib/theme'
import { formatearFecha } from '../../src/lib/dates'
import { ApiError } from '../../src/lib/http'
import { filtrarBandeja } from '../../src/lib/bandejaFilter'
import { expedientesService } from '../../src/services'
import { useApp } from '../../src/state/AppContext'
import type { ExpedienteDto } from '../../src/types/api'

export default function Bandeja() {
  const { usuario } = useApp()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [expedientes, setExpedientes] = useState<ExpedienteDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    let activo = true
    ;(async () => {
      setCargando(true)
      setError('')
      try {
        const lista = await expedientesService.list()
        if (activo) setExpedientes(lista)
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudo cargar la bandeja de expedientes.')
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  const pendientes = useMemo(
    () => filtrarBandeja(expedientes, { busqueda, fechaDesde, fechaHasta }),
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
        <Text style={s.headerTitle}>Bandeja de expedientes</Text>
        <Pressable onPress={() => router.push('/(secretaria)/perfil')}>
          <Avatar nombres={usuario?.nombres} apellidos={usuario?.apellidos} size={40} />
        </Pressable>
      </View>

      <View style={s.filtros}>
        <Input
          placeholder="Buscar por código, título o remitente…"
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
            {cargando ? 'Cargando…' : `${pendientes.length} expediente(s) pendiente(s)`}
          </Text>
          <Pressable onPress={limpiarFiltros}><Text style={s.limpiar}>Limpiar</Text></Pressable>
        </View>
      </View>

      <View style={s.lista}>
        {cargando && <Loading label="Cargando bandeja…" />}
        {!cargando && !!error && <View style={{ padding: 14 }}><ErrorText>{error}</ErrorText></View>}
        {!cargando && !error && pendientes.map(e => (
          <Pressable key={e.id} onPress={() => router.push(`/(secretaria)/revision/${e.id}`)}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Text numberOfLines={1} style={s.titulo}>{e.tituloProtocolo}</Text>
                <StatusBadge estado={e.estado} />
              </View>
              <Text style={s.remitente}>{e.investigadorNombre ?? 'Solicitante desconocido'}</Text>
              <Text style={s.meta}>{(e.codigoUnico ?? '—')} · {formatearFecha(e.fechaEnvio)}</Text>
            </Card>
          </Pressable>
        ))}
        {!cargando && !error && pendientes.length === 0 && (
          <Text style={s.vacio}>No hay expedientes pendientes de gestión administrativa.</Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  filtros: { padding: 16, gap: 10 },
  contador: { fontSize: 12.5, fontWeight: '500', color: colors.slate400 },
  limpiar: { fontSize: 13, fontWeight: '600', color: colors.primary },
  lista: { paddingHorizontal: 16, gap: 10, flex: 1 },
  titulo: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  remitente: { fontSize: 12.5, fontWeight: '500', color: colors.slate500, marginBottom: 4 },
  meta: { fontSize: 12, fontWeight: '500', color: colors.slate400 },
  vacio: { textAlign: 'center', fontSize: 13.5, color: colors.slate500, marginTop: 24 },
})
```

Nota: la `lista` no usa `FlatList` porque la Bandeja de la secretaría es corta (expedientes en gestión activa); si se volviera muy larga se migra a `FlatList`. Si se requiere scroll, envolver `s.lista` en un `ScrollView` — por ahora la vista completa cabe con el header fijo + filtros.

- [ ] **Step 4: Test + typecheck (2-5 min)**

```bash
npm test -w @comite/mobile
npm run typecheck -w @comite/mobile
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/bandejaFilter.ts apps/mobile/src/lib/__tests__/bandejaFilter.test.ts "apps/mobile/app/(secretaria)/index.tsx"
git commit -m "feat(mobile): Bandeja de expedientes de secretaría con filtro puro testeado"
```

---

### Task 4: Descarga/apertura de documentos — `documentDownload.ts` + saneado de nombre testeado

**Files:**
- Create: `apps/mobile/src/lib/fileName.ts`
- Create: `apps/mobile/src/lib/__tests__/fileName.test.ts`
- Create: `apps/mobile/src/lib/documentDownload.ts`

**Interfaces:**
- Consumes: `getToken` de `./http`; `sanitizeFileName` de `./fileName`; `expo-file-system/legacy` (`cacheDirectory`, `downloadAsync`), `expo-sharing` (`isAvailableAsync`, `shareAsync`).
- Produces:
  - `fileName.ts`: `export function sanitizeFileName(nombre: string): string`.
  - `documentDownload.ts`: `export async function abrirDocumento(url: string, nombreArchivo: string): Promise<void>` — descarga autenticada a temporal y abre el selector nativo. El caller construye `url` con `apiUrl(...)`.

Nota de aislamiento del test: la lógica pura (saneado del nombre de archivo) vive en `fileName.ts`, **sin imports nativos**, para poder testearla sin depender de mocks de `expo-file-system`/`expo-sharing`. `documentDownload.ts` la reutiliza.

- [ ] **Step 1: `src/lib/fileName.ts` — saneado puro del nombre (2-5 min)**

```typescript
// src/lib/fileName.ts
// Sanea un nombre de archivo para escribirlo en el filesystem del dispositivo:
// reemplaza separadores de ruta y caracteres inválidos por '_'. Sin imports
// nativos para poder testearlo de forma aislada.
export function sanitizeFileName(nombre: string): string {
  const limpio = (nombre ?? '').trim()
  if (!limpio) return 'documento'
  return limpio.replace(/[/\\?%*:|"<>]/g, '_')
}
```

- [ ] **Step 2: Test de `sanitizeFileName` (2-5 min)**

```typescript
// src/lib/__tests__/fileName.test.ts
import { sanitizeFileName } from '../fileName'

describe('sanitizeFileName', () => {
  it('reemplaza separadores de ruta y caracteres inválidos por guion bajo', () => {
    expect(sanitizeFileName('a/b\\c:d?e*f.pdf')).toBe('a_b_c_d_e_f.pdf')
  })
  it('conserva un nombre válido tal cual', () => {
    expect(sanitizeFileName('proyecto_final.pdf')).toBe('proyecto_final.pdf')
  })
  it('usa un nombre por defecto cuando viene vacío o solo espacios', () => {
    expect(sanitizeFileName('')).toBe('documento')
    expect(sanitizeFileName('   ')).toBe('documento')
  })
})
```

- [ ] **Step 3: `src/lib/documentDownload.ts` — descarga autenticada + selector nativo (2-5 min)**

```typescript
// src/lib/documentDownload.ts
// SDK 54: la API de downloadAsync/cacheDirectory con header Authorization vive
// en el submódulo legacy (la API nueva por defecto usa clases File/Directory).
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { getToken } from './http'
import { sanitizeFileName } from './fileName'

// Descarga un documento autenticado (token Bearer) a almacenamiento temporal
// del dispositivo y abre el selector nativo "Abrir con…" (share sheet de
// Android) para que el usuario lo vea con su app instalada (visor PDF, galería,
// Drive, etc.). Sustituye al visor embebido de la web, no disponible en RN.
//
// `url` debe ser una URL absoluta (el caller la construye con apiUrl(...)).
export async function abrirDocumento(url: string, nombreArchivo: string): Promise<void> {
  const token = await getToken()
  const destino = `${FileSystem.cacheDirectory}${sanitizeFileName(nombreArchivo)}`

  const { status, uri } = await FileSystem.downloadAsync(url, destino, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  if (status !== 200) {
    throw new Error(`No se pudo descargar el documento (código ${status}).`)
  }

  const disponible = await Sharing.isAvailableAsync()
  if (!disponible) {
    throw new Error('Abrir/compartir archivos no está disponible en este dispositivo.')
  }

  await Sharing.shareAsync(uri)
}
```

- [ ] **Step 4: Test + typecheck (2-5 min)**

```bash
npm test -w @comite/mobile
npm run typecheck -w @comite/mobile
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/fileName.ts apps/mobile/src/lib/__tests__/fileName.test.ts apps/mobile/src/lib/documentDownload.ts
git commit -m "feat(mobile): documentDownload (expo-file-system + expo-sharing) con saneado de nombre testeado"
```

---

### Task 5: Revisión de expediente — datos, documentos "Abrir", acciones Admitir/Devolver

**Files:**
- Modify: `apps/mobile/app/(secretaria)/revision/[id].tsx` (reemplaza el placeholder)

**Interfaces:**
- Consumes: `expedientesService.getDetalle(id)` → `{ expediente, bitacora, historial, documentos }` y `expedientesService.update(id, { estado })` (existen, sin cambios); `abrirDocumento` de `../../../src/lib/documentDownload`; `apiUrl` de `../../../src/lib/http`; `useConfirm()`; `TopBar`; `Card`, `StatusBadge`, `Button`, `TextArea`, `Field`, `ErrorText`, `Loading`, `SectionTitle` de `ui`; `formatearFechaHora` de `../../../src/lib/dates`; `useLocalSearchParams`/`useRouter`.
- Produces: pantalla `(secretaria)/revision/[id]` con header (código + estado + título), Autores, Documentos (botón "Abrir" por doc → `abrirDocumento(apiUrl(\`/expedientes/${id}/documentos/${doc.id}/descargar\`), doc.nombreArchivo)`), Bitácora/Historial, `TextArea` de observaciones, y las acciones Admitir (`estado:'en_revision'`) / Devolver (`estado:'subsanacion'`, requiere observaciones no vacías) — ambas con `useConfirm()` y `router.replace('/(secretaria)')` al terminar.

- [ ] **Step 1: Reemplazar `app/(secretaria)/revision/[id].tsx` (2-5 min)**

Portado de `apps/web/src/pages/secretaria/Revision.tsx` (rama móvil), reemplazando los dos botones "Ver"/"Descargar" por un único "Abrir" vía `abrirDocumento`, y el modal de preview por nada (no hay visor embebido). Endpoint de descarga: el mismo que usa la web para `mode='descargar'` (`/expedientes/:eid/documentos/:did/descargar`).

```tsx
// app/(secretaria)/revision/[id].tsx
import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { Button, Card, ErrorText, Field, Loading, SectionTitle, StatusBadge, TextArea } from '../../../src/components/ui'
import TopBar from '../../../src/components/TopBar'
import { colors } from '../../../src/lib/theme'
import { formatearFechaHora } from '../../../src/lib/dates'
import { ApiError, apiUrl } from '../../../src/lib/http'
import { abrirDocumento } from '../../../src/lib/documentDownload'
import { expedientesService } from '../../../src/services'
import { useConfirm } from '../../../src/state/ConfirmContext'
import type { BitacoraDto, DocumentoDto, ExpedienteDto, HistorialDto } from '../../../src/types/api'

interface Detalle {
  expediente: ExpedienteDto
  bitacora: BitacoraDto[]
  historial: HistorialDto[]
  documentos: DocumentoDto[]
}

export default function Revision() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const expedienteId = Number(id)
  const router = useRouter()
  const confirmar = useConfirm()

  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [accionEnCurso, setAccionEnCurso] = useState<'admitir' | 'devolver' | null>(null)
  const [abriendo, setAbriendo] = useState<number | null>(null)

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      try {
        setCargando(true)
        const data = await expedientesService.getDetalle(expedienteId)
        if (cancelado) return
        setDetalle(data)
        setError('')
      } catch (err) {
        if (cancelado) return
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el expediente.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    if (!Number.isNaN(expedienteId)) cargar()
    return () => { cancelado = true }
  }, [expedienteId])

  async function handleAbrir(doc: DocumentoDto) {
    try {
      setAbriendo(doc.id)
      setError('')
      await abrirDocumento(apiUrl(`/expedientes/${expedienteId}/documentos/${doc.id}/descargar`), doc.nombreArchivo)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'No se pudo abrir el documento.'))
    } finally {
      setAbriendo(null)
    }
  }

  async function handleAdmitir() {
    if (!(await confirmar('¿Admitir este expediente y pasarlo a revisión de fondo?', { titulo: 'Admitir expediente', textoConfirmar: 'Admitir' }))) return
    try {
      setAccionEnCurso('admitir')
      await expedientesService.update(expedienteId, { estado: 'en_revision' })
      router.replace('/(secretaria)')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo admitir el expediente.')
    } finally {
      setAccionEnCurso(null)
    }
  }

  async function handleDevolver() {
    if (!observaciones.trim()) {
      setError('Describe las observaciones para el investigador antes de devolver el expediente.')
      return
    }
    if (!(await confirmar('¿Devolver este expediente al investigador para subsanación?', { titulo: 'Devolver para subsanación', textoConfirmar: 'Devolver' }))) return
    try {
      setAccionEnCurso('devolver')
      // NOTA: el backend actual (PUT /expedientes/:id) no persiste el texto de
      // observaciones (limitación conocida, igual que en la web). Se pide y
      // valida el texto porque el flujo lo requiere, sin inventar persistencia.
      await expedientesService.update(expedienteId, { estado: 'subsanacion' })
      router.replace('/(secretaria)')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo devolver el expediente para subsanación.')
    } finally {
      setAccionEnCurso(null)
    }
  }

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Revisión de expediente" />
        <Loading label="Cargando expediente…" />
      </View>
    )
  }

  if (!detalle) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Revisión de expediente" />
        <View style={{ padding: 16 }}><ErrorText>{error || 'Expediente no encontrado.'}</ErrorText></View>
      </View>
    )
  }

  const { expediente, bitacora, historial, documentos } = detalle
  const cargandoAccion = accionEnCurso !== null

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar titulo="Revisión de expediente" />
      <ScrollableBody>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={s.codigo}>{expediente.codigoUnico ?? '—'}</Text>
            <StatusBadge estado={expediente.estado} />
          </View>
          <Text style={s.titulo}>{expediente.tituloProtocolo}</Text>
        </Card>

        {!!error && <ErrorText>{error}</ErrorText>}

        <SectionTitle>Autores</SectionTitle>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {(expediente.autores ?? []).map((a, i) => (
            <View key={a.id ?? i} style={s.row}>
              <Text style={s.rowMain}>{a.apellidosNombres}</Text>
              <Text style={s.rowSub}>{a.esPrincipal ? 'Autor principal' : 'Coautor'} · {a.correo ?? '—'}</Text>
            </View>
          ))}
          {(expediente.autores ?? []).length === 0 && (
            <Text style={s.vacioRow}>Sin autores registrados.</Text>
          )}
        </Card>

        <SectionTitle>Documentos</SectionTitle>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {documentos.map(d => (
            <View key={d.id} style={[s.row, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={s.rowMain}>{d.nombreArchivo}</Text>
                <Text style={s.rowSub}>{d.tipoDocumento}</Text>
              </View>
              <Button
                title={abriendo === d.id ? 'Abriendo…' : 'Abrir'}
                variant="outline"
                loading={abriendo === d.id}
                onPress={() => handleAbrir(d)}
                style={{ paddingHorizontal: 16, paddingVertical: 9 }}
              />
            </View>
          ))}
          {documentos.length === 0 && (
            <Text style={s.vacioRow}>Este expediente no tiene documentos cargados.</Text>
          )}
        </Card>

        <SectionTitle>Bitácora / historial</SectionTitle>
        <Card>
          {historial.map(h => (
            <View key={`h-${h.id}`} style={{ marginBottom: 8 }}>
              <Text style={s.feedFecha}>{formatearFechaHora(h.createdAt)} — {(h.estadoAnterior ?? '—')} → {h.estadoNuevo}</Text>
              {!!h.observaciones && <Text style={s.feedDetalle}>{h.observaciones}</Text>}
            </View>
          ))}
          {bitacora.map(b => (
            <View key={`b-${b.id}`} style={{ marginBottom: 8 }}>
              <Text style={s.feedFecha}>{formatearFechaHora(b.createdAt)} — {b.accion}</Text>
              {!!b.detalle && <Text style={s.feedDetalle}>{b.detalle}</Text>}
            </View>
          ))}
          {historial.length === 0 && bitacora.length === 0 && (
            <Text style={s.vacioRow}>Sin movimientos registrados.</Text>
          )}
        </Card>

        <Field label="Observaciones para subsanación">
          <TextArea
            placeholder="Describe qué debe corregir o completar el investigador…"
            value={observaciones}
            onChangeText={setObservaciones}
          />
        </Field>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title={accionEnCurso === 'devolver' ? 'Enviando…' : 'Devolver'} variant="outline" style={{ flex: 1 }} disabled={cargandoAccion} loading={accionEnCurso === 'devolver'} onPress={handleDevolver} />
          <Button title={accionEnCurso === 'admitir' ? 'Admitiendo…' : 'Admitir'} style={{ flex: 1 }} disabled={cargandoAccion} loading={accionEnCurso === 'admitir'} onPress={handleAdmitir} />
        </View>
      </ScrollableBody>
    </View>
  )
}

// Cuerpo scrolleable con el padding estándar de pantalla.
function ScrollableBody({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  codigo: { fontSize: 12, fontWeight: '600', color: colors.slate400 },
  titulo: { fontSize: 15, fontWeight: '700', color: colors.ink, lineHeight: 20 },
  row: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  rowMain: { fontSize: 13.5, fontWeight: '500', color: colors.ink },
  rowSub: { fontSize: 11.5, color: colors.slate400, marginTop: 2 },
  vacioRow: { fontSize: 12.5, color: colors.slate500, padding: 14 },
  feedFecha: { fontSize: 12, fontWeight: '600', color: colors.ink, lineHeight: 18 },
  feedDetalle: { fontSize: 12, color: colors.slate500, lineHeight: 18 },
})
```

Agregar los imports de `ScrollView` y el tipo `React` que usa `ScrollableBody`. En la cabecera del archivo, la línea de import de `react-native` debe incluir `ScrollView`:
```tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native'
```
y agregar al inicio:
```tsx
import type { ReactNode } from 'react'
```
cambiando la firma de `ScrollableBody` a `{ children }: { children: ReactNode }`.

- [ ] **Step 2: Typecheck (2-5 min)**

```bash
npm run typecheck -w @comite/mobile
```

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(secretaria)/revision/[id].tsx"
git commit -m "feat(mobile): pantalla Revisión de expediente (Abrir docs + Admitir/Devolver)"
```

---

### Task 6: `chat.service` (lado secretaría) + Chat — lista de conversaciones

**Files:**
- Modify: `apps/mobile/src/services/chat.service.ts` (AMPLÍA con el lado secretaría)
- Modify: `apps/mobile/app/(secretaria)/chat/index.tsx` (reemplaza el placeholder)

**Interfaces:**
- Consumes (service): `request` de `../lib/http`; `ConversacionChatDto`, `MensajeChatDto`, `SolicitanteChatDto` de `../types/api`.
- Consumes (pantalla): `chatService.getConversaciones()`, `chatService.getSolicitantes()`; `ROL_LABEL` de `../../src/data/types`; `Card`, `ErrorText`, `Loading` de `ui`; `useRouter`, `useSafeAreaInsets`; `formatearFecha` de dates.
- Produces:
  - `chat.service.ts` amplía con: `getConversaciones(): Promise<ConversacionChatDto[]>` (`GET /chat/conversaciones`), `getSolicitantes(): Promise<SolicitanteChatDto[]>` (`GET /chat/solicitantes`), `getHiloDeSolicitante(solicitanteId: number): Promise<MensajeChatDto[]>` (`GET /chat/:solicitanteId`), `enviarComoSecretaria(solicitanteId: number, texto: string): Promise<MensajeChatDto>` (`POST /chat/:solicitanteId`).
  - Pantalla lista (`chat/index.tsx`): poll de conversaciones cada 10s, tarjeta por conversación (iniciales, nombre, preview, badge no leídos, hora), botón "+ Nuevo" que abre un picker de solicitantes; tap en conversación o al iniciar una nueva → `router.push({ pathname: '/(secretaria)/chat/[solicitanteId]', params: { solicitanteId, nombre, detalle } })`.

- [ ] **Step 1: Ampliar `src/services/chat.service.ts` con el lado secretaría (2-5 min)**

Reemplazar el contenido completo del archivo por (conserva el lado solicitante intacto y agrega el lado secretaría, calcando `apps/web/src/services/chat.service.ts` salvo `totalNoLeidos`, fuera de alcance):

```typescript
// src/services/chat.service.ts
import { request } from '../lib/http'
import type { ConversacionChatDto, MensajeChatDto, SolicitanteChatDto } from '../types/api'

// ---------- Lado solicitante (investigador / estudiante_*) — NO tocar ----------
export function getMiHilo(): Promise<MensajeChatDto[]> {
  return request<MensajeChatDto[]>('/chat/mios')
}
export function enviarComoSolicitante(texto: string): Promise<MensajeChatDto> {
  return request<MensajeChatDto>('/chat/mios', { method: 'POST', body: { texto } })
}
export function misNoLeidos(): Promise<{ noLeidos: number }> {
  return request('/chat/mios/no-leidos')
}

// ---------- Lado secretaría / administrador ----------
export function getConversaciones(): Promise<ConversacionChatDto[]> {
  return request<ConversacionChatDto[]>('/chat/conversaciones')
}
export function getSolicitantes(): Promise<SolicitanteChatDto[]> {
  return request<SolicitanteChatDto[]>('/chat/solicitantes')
}
export function getHiloDeSolicitante(solicitanteId: number): Promise<MensajeChatDto[]> {
  return request<MensajeChatDto[]>(`/chat/${solicitanteId}`)
}
export function enviarComoSecretaria(solicitanteId: number, texto: string): Promise<MensajeChatDto> {
  return request<MensajeChatDto>(`/chat/${solicitanteId}`, { method: 'POST', body: { texto } })
}
```

(No se porta `totalNoLeidos` / `GET /chat/no-leidos`: ninguna pantalla lo usa — fuera de alcance.)

- [ ] **Step 2: Reemplazar `app/(secretaria)/chat/index.tsx` con la lista + picker "+ Nuevo" (2-5 min)**

Portado de `apps/web/src/pages/secretaria/Chat.tsx` (solo la parte de lista + panel "Nuevo"). El picker se resuelve con un `Modal` de RN listando `Pressable` (mismo patrón que `ConfirmContext`). Al elegir conversación o solicitante, se navega al hilo pasando `nombre` y `detalle` por params (el hilo no vuelve a resolver el nombre).

```tsx
// app/(secretaria)/chat/index.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Card, ErrorText, Loading } from '../../../src/components/ui'
import { colors } from '../../../src/lib/theme'
import { formatearFecha } from '../../../src/lib/dates'
import { ApiError } from '../../../src/lib/http'
import { ROL_LABEL } from '../../../src/data/types'
import { chatService } from '../../../src/services'
import type { ConversacionChatDto, RolBackend, SolicitanteChatDto } from '../../../src/types/api'

const INTERVALO_CONVERSACIONES = 10000

function iniciales(nombreCompleto?: string) {
  const partes = (nombreCompleto ?? '').trim().split(/\s+/)
  return `${partes[0]?.[0] ?? ''}${partes[1]?.[0] ?? ''}`.toUpperCase() || 'U'
}

// Encabezado del hilo: tipo + código (si aplica) + correo.
function detalleSolicitante(s: { rol: RolBackend; codigoEstudiante: string | null; email: string }): string {
  const partes = [ROL_LABEL[s.rol] ?? s.rol]
  if (s.codigoEstudiante) partes.push(`Código ${s.codigoEstudiante}`)
  partes.push(s.email)
  return partes.join(' · ')
}

// Línea bajo el nombre en la lista (solo estudiantes tienen código).
function subInfo(rol: RolBackend, codigoEstudiante: string | null): string {
  if (!codigoEstudiante) return ''
  return `Código ${codigoEstudiante} · ${ROL_LABEL[rol] ?? rol}`
}

function formatearHora(fecha: string | null) {
  if (!fecha) return ''
  return new Date(fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatLista() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [conversaciones, setConversaciones] = useState<ConversacionChatDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [solicitantes, setSolicitantes] = useState<SolicitanteChatDto[]>([])
  const [cargandoSolicitantes, setCargandoSolicitantes] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const lista = await chatService.getConversaciones()
        if (activo) { setConversaciones(lista); setError('') }
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las conversaciones.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    const t = setInterval(cargar, INTERVALO_CONVERSACIONES)
    return () => { activo = false; clearInterval(t) }
  }, [])

  async function abrirNuevo() {
    setMostrarNuevo(true)
    if (solicitantes.length === 0) {
      try {
        setCargandoSolicitantes(true)
        const lista = await chatService.getSolicitantes()
        setSolicitantes(lista)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de solicitantes.')
      } finally {
        setCargandoSolicitantes(false)
      }
    }
  }

  function irAlHilo(solicitanteId: number, nombre: string, detalle: string) {
    router.push({ pathname: '/(secretaria)/chat/[solicitanteId]', params: { solicitanteId: String(solicitanteId), nombre, detalle } })
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.headerTitle}>Chat</Text>
        <Pressable onPress={abrirNuevo}><Text style={s.nuevo}>+ Nuevo</Text></Pressable>
      </View>

      {!!error && <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><ErrorText>{error}</ErrorText></View>}
      {cargando && <Loading label="Cargando conversaciones…" />}

      <View style={{ flex: 1 }}>
        {!cargando && conversaciones.map(c => (
          <Pressable key={c.solicitanteId} style={s.convRow} onPress={() => irAlHilo(c.solicitanteId, c.nombre, detalleSolicitante(c))}>
            <View style={s.avatar}><Text style={s.avatarText}>{iniciales(c.nombre)}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                <Text numberOfLines={1} style={s.convNombre}>{c.nombre}</Text>
                <Text style={s.convHora}>{formatearHora(c.ultimaFecha)}</Text>
              </View>
              {!!subInfo(c.rol, c.codigoEstudiante) && <Text numberOfLines={1} style={s.convSub}>{subInfo(c.rol, c.codigoEstudiante)}</Text>}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                <Text numberOfLines={1} style={s.convPreview}>{c.ultimoMensaje ?? 'Sin mensajes'}</Text>
                {c.noLeidos > 0 && <View style={s.badge}><Text style={s.badgeText}>{c.noLeidos}</Text></View>}
              </View>
            </View>
          </Pressable>
        ))}
        {!cargando && conversaciones.length === 0 && !error && (
          <Text style={s.vacio}>Aún no hay conversaciones. Usa "+ Nuevo" para escribirle a un solicitante.</Text>
        )}
      </View>

      <Modal visible={mostrarNuevo} transparent animationType="slide" onRequestClose={() => setMostrarNuevo(false)}>
        <Pressable style={s.backdrop} onPress={() => setMostrarNuevo(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>Nueva conversación</Text>
            {cargandoSolicitantes && <Loading label="Cargando solicitantes…" />}
            {!cargandoSolicitantes && solicitantes.map(so => (
              <Pressable
                key={so.id}
                style={s.pickerRow}
                onPress={() => { setMostrarNuevo(false); irAlHilo(so.id, so.nombre, detalleSolicitante(so)) }}
              >
                <Text style={s.pickerNombre}>{so.nombre}</Text>
                <Text style={s.pickerDetalle}>{detalleSolicitante(so)}</Text>
              </Pressable>
            ))}
            {!cargandoSolicitantes && solicitantes.length === 0 && (
              <Text style={s.vacio}>No hay solicitantes disponibles.</Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  nuevo: { fontSize: 14, fontWeight: '600', color: colors.primary },
  convRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  convNombre: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.ink },
  convHora: { fontSize: 10.5, color: colors.slate400 },
  convSub: { fontSize: 10.5, fontWeight: '500', color: colors.primary, marginTop: 1 },
  convPreview: { flex: 1, fontSize: 11.5, color: colors.slate500, marginTop: 1 },
  badge: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  vacio: { textAlign: 'center', fontSize: 13, color: colors.slate500, margin: 24 },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,32,74,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, gap: 4, maxHeight: '70%' },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.navy, marginBottom: 8 },
  pickerRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  pickerNombre: { fontSize: 14, fontWeight: '600', color: colors.ink },
  pickerDetalle: { fontSize: 11.5, color: colors.slate500, marginTop: 2 },
})
```

Nota: el `sheet` con `Pressable` interno usa `onPress={() => {}}` para que el tap dentro del panel no lo cierre (mismo truco que el `ConfirmContext`). Si la lista de solicitantes fuera larga, envolver los `pickerRow` en un `ScrollView` dentro del `sheet`.

- [ ] **Step 3: Typecheck (2-5 min)**

```bash
npm run typecheck -w @comite/mobile
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/services/chat.service.ts "apps/mobile/app/(secretaria)/chat/index.tsx"
git commit -m "feat(mobile): chat.service lado secretaría + lista de conversaciones con picker Nuevo"
```

---

### Task 7: Chat — hilo de conversación (secretaría)

**Files:**
- Modify: `apps/mobile/app/(secretaria)/chat/[solicitanteId].tsx` (reemplaza el placeholder)

**Interfaces:**
- Consumes: `chatService.getHiloDeSolicitante(id)` (poll 4s) y `chatService.enviarComoSecretaria(id, texto)` (definidos en Task 6); `Input` de `ui`; `colors`; `ApiError`; `useLocalSearchParams`/`useRouter`; `useSafeAreaInsets`; `KeyboardAvoidingView`.
- Produces: pantalla `(secretaria)/chat/[solicitanteId]` — hilo con burbujas (`esMio = m.esDeSecretaria` directo), polling 4s, auto-scroll, envío optimista, header con nombre/detalle (de params) y botón atrás (`‹`) que hace `router.back()` a la lista.

- [ ] **Step 1: Reemplazar `app/(secretaria)/chat/[solicitanteId].tsx` (2-5 min)**

Adaptado de `apps/mobile/app/(app)/consultas.tsx` (Fase 3): misma estructura de burbujas/polling/`KeyboardAvoidingView`/auto-scroll, pero poll vía `getHiloDeSolicitante(id)`, envío vía `enviarComoSecretaria(id, texto)`, `esMio(m) = !!m.esDeSecretaria`, y header con back + nombre/detalle recibidos por params.

```tsx
// app/(secretaria)/chat/[solicitanteId].tsx
import { useEffect, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Input } from '../../../src/components/ui'
import { colors } from '../../../src/lib/theme'
import { ApiError } from '../../../src/lib/http'
import { chatService } from '../../../src/services'
import type { MensajeChatDto } from '../../../src/types/api'

const INTERVALO_POLLING = 4000

function iniciales(nombreCompleto?: string) {
  const partes = (nombreCompleto ?? '').trim().split(/\s+/)
  return `${partes[0]?.[0] ?? ''}${partes[1]?.[0] ?? ''}`.toUpperCase() || 'U'
}

export default function ChatHilo() {
  const { solicitanteId, nombre, detalle } = useLocalSearchParams<{ solicitanteId: string; nombre?: string; detalle?: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const id = Number(solicitanteId)
  const [mensajes, setMensajes] = useState<MensajeChatDto[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (Number.isNaN(id)) return
    let activo = true
    async function refrescar() {
      try {
        const lista = await chatService.getHiloDeSolicitante(id)
        if (activo) setMensajes(lista)
      } catch {
        // si falla un ciclo de polling, se reintenta en el siguiente
      }
    }
    refrescar()
    const t = setInterval(refrescar, INTERVALO_POLLING)
    return () => { activo = false; clearInterval(t) }
  }, [id])

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensajes.length])

  async function onEnviar() {
    const contenido = texto.trim()
    if (!contenido || enviando || Number.isNaN(id)) return
    setEnviando(true)
    setError('')
    try {
      const nuevo = await chatService.enviarComoSecretaria(id, contenido)
      setMensajes(prev => [...prev, nuevo])
      setTexto('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el mensaje.')
    } finally {
      setEnviando(false)
    }
  }

  function esMio(m: MensajeChatDto) {
    return !!m.esDeSecretaria
  }
  function hora(iso: string) {
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={s.container}>
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.back}><Text style={s.backText}>‹</Text></Pressable>
          <View style={s.avatar}><Text style={s.avatarText}>{iniciales(nombre)}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={s.headerTitulo}>{nombre || 'Solicitante'}</Text>
            {!!detalle && <Text numberOfLines={1} style={s.headerDetalle}>{detalle}</Text>}
          </View>
        </View>

        <ScrollView ref={scrollRef} style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
          {mensajes.map(m => (
            <View key={m.id} style={[s.bubble, esMio(m) ? s.bubbleMe : s.bubbleThem]}>
              <Text style={esMio(m) ? s.bubbleTextMe : s.bubbleTextThem}>{m.texto}</Text>
              <Text style={[s.hora, esMio(m) ? s.horaMe : s.horaThem]}>{hora(m.createdAt)}</Text>
            </View>
          ))}
          {mensajes.length === 0 && (
            <Text style={s.vacio}>Aún no hay mensajes en esta conversación. Escribe el primero.</Text>
          )}
        </ScrollView>

        {!!error && <Text style={s.error}>{error}</Text>}

        <View style={s.footer}>
          <Input style={s.input} placeholder="Escribe un mensaje…" value={texto} onChangeText={setTexto} onSubmitEditing={onEnviar} returnKeyType="send" />
          <Pressable onPress={onEnviar} disabled={enviando} style={[s.sendBtn, enviando && s.sendBtnDisabled]}>
            <Text style={s.sendBtnText}>➤</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef2f7' },
  header: { backgroundColor: '#fff', paddingHorizontal: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  back: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: colors.slate500, lineHeight: 30 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  headerTitulo: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  headerDetalle: { fontSize: 11, fontWeight: '500', color: colors.slate500 },
  body: { flex: 1 },
  bodyContent: { padding: 14, gap: 8 },
  bubble: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.lineSoft },
  bubbleTextMe: { color: '#fff', fontSize: 14 },
  bubbleTextThem: { color: colors.ink, fontSize: 14 },
  hora: { fontSize: 10, alignSelf: 'flex-end' },
  horaMe: { color: 'rgba(255,255,255,0.75)' },
  horaThem: { color: colors.slate400 },
  vacio: { textAlign: 'center', fontSize: 13, color: colors.slate500, marginTop: 20 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '500', marginHorizontal: 12 },
  footer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderRadius: 999 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 17 },
})
```

- [ ] **Step 2: Typecheck (2-5 min)**

```bash
npm run typecheck -w @comite/mobile
```

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(secretaria)/chat/[solicitanteId].tsx"
git commit -m "feat(mobile): hilo de chat de secretaría (poll 4s, enviarComoSecretaria)"
```

---

### Task 8: Perfil generalizado — `PerfilScreen.tsx` compartido + wrappers por grupo

**Files:**
- Create: `apps/mobile/src/components/screens/PerfilScreen.tsx`
- Modify: `apps/mobile/app/(app)/perfil.tsx` (pasa a ser wrapper fino)
- Modify: `apps/mobile/app/(secretaria)/perfil.tsx` (reemplaza el placeholder por un wrapper fino)

**Interfaces:**
- Consumes: `useApp()` (`{ usuario, logout }`); `ROL_LABEL`, `ROLES_SOLICITANTE` de `../../data/types`; `expedientesService.list()`; `Button`, `Card`, `Screen` de `../ui`; `Avatar`; `colors`; `useRouter`; `useSafeAreaInsets`.
- Produces:
  - `PerfilScreen` (componente compartido sin props): decide la rama por `usuario.rol`. Rama solicitante (`ROLES_SOLICITANTE.includes(rol)`): stats En revisión/Aprobados/Subsanación + fila "Proyectos registrados". Rama interna (else, p. ej. secretaría): stats Enviados (`enviado`|`en_revision`) / Aprobados (`aprobado`|`aprobado_observaciones`) + fila "Expedientes vinculados". Botón "Cerrar sesión" → `await logout()` → `router.replace('/login')`.
  - Ambos archivos-ruta renderizan `<PerfilScreen />`.

Nota: se toma como base el `app/(app)/perfil.tsx` actual (Fase 3) y se le agrega la rama interna calcada de la rama `else` de `apps/web/src/pages/Perfil.tsx` (sin la rama `evaluador`, fuera de alcance).

- [ ] **Step 1: `src/components/screens/PerfilScreen.tsx` — componente compartido con ambas ramas (2-5 min)**

```tsx
// src/components/screens/PerfilScreen.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Screen } from '../ui'
import Avatar from '../Avatar'
import { colors } from '../../lib/theme'
import { ROL_LABEL, ROLES_SOLICITANTE } from '../../data/types'
import { expedientesService } from '../../services'
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

  useEffect(() => {
    if (!usuario) return
    let cancelado = false
    async function cargar() {
      try {
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
          // Rama de rol interno (secretaría), calcada de la rama else de la web.
          setStats([
            { n: proyectos.filter(p => p.estado === 'enviado' || p.estado === 'en_revision').length, label: 'Enviados', color: colors.primary },
            { n: proyectos.filter(p => p.estado === 'aprobado' || p.estado === 'aprobado_observaciones').length, label: 'Aprobados', color: colors.success },
          ])
        }
      } catch {
        if (!cancelado) setStats([])
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [usuario, esSolicitante])

  const filas = [
    { label: 'Correo institucional', valor: usuario?.correo ?? '—' },
    ...(usuario?.codigo ? [{ label: 'Código de estudiante', valor: usuario.codigo }] : []),
    ...(usuario?.laboratorio ? [{ label: 'Laboratorio', valor: usuario.laboratorio }] : []),
    ...(usuario?.especialidad ? [{ label: 'Especialidad', valor: usuario.especialidad }] : []),
    ...(totalRegistros !== null ? [{ label: esSolicitante ? 'Proyectos registrados' : 'Expedientes vinculados', valor: String(totalRegistros) }] : []),
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

- [ ] **Step 2: Convertir `app/(app)/perfil.tsx` en wrapper fino (2-5 min)**

Reemplazar TODO el contenido del archivo por:
```tsx
// app/(app)/perfil.tsx
import PerfilScreen from '../../src/components/screens/PerfilScreen'

export default function Perfil() {
  return <PerfilScreen />
}
```
(La rama solicitante — con las stats En revisión/Aprobados/Subsanación y "Proyectos registrados" que hoy vive aquí — ahora está dentro de `PerfilScreen` para `esSolicitante === true`, así que el comportamiento visible para el solicitante no cambia.)

- [ ] **Step 3: Reemplazar `app/(secretaria)/perfil.tsx` por el mismo wrapper (2-5 min)**

```tsx
// app/(secretaria)/perfil.tsx
import PerfilScreen from '../../src/components/screens/PerfilScreen'

export default function PerfilSecretaria() {
  return <PerfilScreen />
}
```

- [ ] **Step 4: Typecheck (2-5 min)**

```bash
npm run typecheck -w @comite/mobile
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/screens/PerfilScreen.tsx "apps/mobile/app/(app)/perfil.tsx" "apps/mobile/app/(secretaria)/perfil.tsx"
git commit -m "feat(mobile): PerfilScreen compartido (rama interna secretaría) + wrappers por grupo"
```

---

### Task 9: Verificación final — typecheck/test global, README y checklist E2E Android

**Files:**
- Modify: `apps/mobile/README.md` (mención del rol Secretaría y su grupo de rutas)

**Interfaces:**
- Consumes: toda la app.
- Produces: verificación de que Secretaría funciona E2E en Android real contra la API, y de que el refactor de navegación por rol NO rompió el flujo del Solicitante ya verificado en Fase 3.

- [ ] **Step 1: `npm run typecheck` y `npm test` globales del monorepo (2-5 min)**

```bash
npm run build -w @comite/shared
npm run typecheck    # turbo: no debe romper @comite/mobile ni el resto
npm test             # turbo: tests de mobile (mappers, documentFormats, ui, roles, bandejaFilter, fileName) en verde
```

- [ ] **Step 2: Actualizar `apps/mobile/README.md` — sección de roles y estructura (2-5 min)**

En la sección "Estructura", agregar tras la línea del grupo `(app)/` una viñeta para el nuevo grupo:
```markdown
- `app/(secretaria)/` — grupo del rol Secretaría técnica (guard de sesión + Tabs de
  3 pestañas): `index` (Bandeja de expedientes), `chat/` (lista `index` y hilo
  `[solicitanteId]`), `perfil`, más la ruta oculta `revision/[id]`. La redirección
  post-login elige el grupo según el rol (`src/lib/roles.ts` → `homeGroupForRole`).
```
En la sección "Alcance de este corte" → "Incluido", agregar:
```markdown
- Rol **Secretaría técnica**: Bandeja (lista/búsqueda/filtro de fecha), Revisión de
  expediente (autores, documentos con apertura nativa vía `expo-file-system` +
  `expo-sharing`, bitácora/historial, Admitir/Devolver), Chat (lista + hilo) y Perfil
  con la rama de rol interno. Navegación por rol vía grupos de rutas separados.
```

- [ ] **Step 3: Recorrer el checklist E2E en Android real contra la API real (10-15 min)**

```bash
# Terminal 1: API real
npm run build -w @comite/shared
npm run dev -w @comite/api
# Terminal 2: Expo (Android)
npm run dev -w @comite/mobile   # 'a' para emulador, o QR en Expo Go (dispositivo físico)
```

Checklist E2E — cuenta `secretaria@uch.edu.pe` (marcar cada uno):
- Login como secretaría → entra directo al grupo `(secretaria)` (3 pestañas: Bandeja/Chat/Perfil), sin pasar por el tab bar del solicitante.
- Bandeja: carga expedientes reales en estados enviado/en_revision/subsanacion; la búsqueda por texto filtra; los filtros de fecha (AAAA-MM-DD) acotan por `fechaEnvio`; "Limpiar" resetea.
- Abrir un expediente desde la Bandeja → la Revisión muestra código/estado/título, Autores, Documentos, Bitácora/Historial reales.
- Documentos: tocar "Abrir" en un documento dispara la descarga autenticada y aparece el **share sheet nativo** de Android ("Abrir con…"); el archivo abre en un visor externo. Verificar específicamente que el header `Authorization` llegó (no 401/403 en la descarga).
- Admitir expediente: confirma → el estado cambia a `en_revision` y el ítem se comporta acorde (sigue en bandeja si era `enviado`; ya no aparece como "enviado"); vuelve a la Bandeja.
- Devolver para subsanar: sin observaciones muestra error de validación; con observaciones + confirmación → estado `subsanacion`, vuelve a la Bandeja.
- Chat lista: muestra conversaciones reales con preview/hora/badge de no leídos; poll refresca cada 10s.
- "+ Nuevo": abre el picker con solicitantes reales; elegir uno navega al hilo.
- Hilo: enviar un mensaje aparece de inmediato (burbuja propia, lado derecho); el poll de 4s trae respuestas; "‹" vuelve a la lista.
- Perfil (secretaría): muestra el rol "Secretaría", stats Enviados/Aprobados y "Expedientes vinculados"; "Cerrar sesión" limpia SecureStore y vuelve a Login.
- **Regresión Fase 3 (crítico):** cerrar sesión y entrar con una cuenta de solicitante → entra al grupo `(app)` con sus 5 pestañas y TODO el flujo del solicitante funciona exactamente igual que en Fase 3 (Dashboard, Proyectos, Nuevo, Consultas, Perfil). Esto guarda contra que el refactor de navegación por rol haya roto lo ya verificado.
- **Roles aún no implementados:** entrar con `coordinador@uch.edu.pe` (o `evaluador@uch.edu.pe`/`admin@uch.edu.pe`) → muestra la pantalla "Tu rol todavía no está disponible en la app móvil" (NO el Dashboard del solicitante); "Cerrar sesión" funciona desde ahí.
- Navegación a mano / anti-loop: no hay bucle de redirección entre `(app)` y `(secretaria)` en ningún login; la sesión persistente reabre en el grupo correcto según el rol.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/README.md
git commit -m "docs(mobile): README rol Secretaría + verificación E2E Android Fase 4"
```

---

## Self-review (autor del plan)

**Cobertura del spec (4 pantallas + 2 decisiones de arquitectura):**
- Decisión 1 (navegación por rol): `src/lib/roles.ts` + `homeGroupForRole` (Task 1); `app/index.tsx`/`login.tsx` role-aware (Task 1); grupo `(secretaria)/_layout.tsx` con guard + redirect por rol (Task 2); guard de rol añadido a `(app)/_layout.tsx` (Task 1). `(app)/` queda sin renombrar. Anti-loop verificado en Task 2 Step 7 y Task 9.
- Decisión 2 (ver/descargar documentos): `src/lib/documentDownload.ts` con `abrirDocumento` (Task 4), cableado al botón "Abrir" en Revisión (Task 5). Sin visor embebido.
- Pantalla 1 (Bandeja): Task 3 — lista, búsqueda, filtro de fecha, tarjeta, navegación a Revisión; filtro extraído a `bandejaFilter.ts` puro + test.
- Pantalla 2 (Revisión): Task 5 — carga vía `getDetalle`, autores/documentos/bitácora+historial, "Abrir", Admitir/Devolver con `useConfirm`, observaciones validadas sin persistencia inventada.
- Pantalla 3 (Chat): `chat.service` ampliado + lista con "+ Nuevo" (Task 6) y hilo (Task 7), dos pantallas de stack.
- Pantalla 4 (Perfil): `PerfilScreen.tsx` compartido con rama interna + wrappers finos en ambos grupos (Task 8).
- Servicios/librerías nuevas del spec: `expo-file-system` + `expo-sharing` (Task 1); `documentDownload.ts` (Task 4); `roles.ts` (Task 1); `chat.service.ts` ampliado (Task 6). `expedientes/users/config` sin cambios (respetado, nunca se editan en el plan).
- Fuera de alcance del spec (respetado): notificaciones, `GET /chat/no-leidos` (no se porta `totalNoLeidos`), registro de secretaría, persistencia de observaciones.

**Escaneo de placeholders:** Los únicos "placeholder" son los archivos-ruta temporales de Task 2, creados a propósito para que el `_layout` se escriba una sola vez, y **cada uno es sobrescrito con código completo** en su tarea (index→T3, revision/[id]→T5, chat/index→T6, chat/[solicitanteId]→T7, perfil→T8). No hay TBD ni "similar a Task N": todo el código nuevo (roles, layouts, documentDownload, fileName, chat.service, PerfilScreen, wrappers, bandejaFilter y las 4 pantallas) está inline y completo. Las porciones "portadas de la web" van acompañadas del código RN completo, no solo de la referencia.

**Consistencia de tipos/firmas verificada contra el código real:**
- `homeGroupForRole(rol: RolBackend): HomeGroup` ('/(app)' | '/(secretaria)') — usada idéntica en `index.tsx`, `login.tsx`, ambos `_layout.tsx`.
- `chatService.getConversaciones(): Promise<ConversacionChatDto[]>`, `getSolicitantes(): Promise<SolicitanteChatDto[]>`, `getHiloDeSolicitante(id: number): Promise<MensajeChatDto[]>`, `enviarComoSecretaria(id: number, texto: string): Promise<MensajeChatDto>` — definidas en Task 6 y consumidas con esas firmas exactas en Tasks 6 y 7. Endpoints confirmados contra `chat.controller.ts` (`/chat/conversaciones`, `/chat/solicitantes`, `/chat/:solicitanteId` GET/POST) y `apps/web/src/services/chat.service.ts`.
- `abrirDocumento(url: string, nombreArchivo: string): Promise<void>` (Task 4) consumida en Task 5 con `apiUrl('/expedientes/:id/documentos/:did/descargar')` — endpoint confirmado contra `apps/web/src/services/expedientes.service.ts` (`descargarDocumento` mode `'descargar'`).
- `expedientesService.list()`, `getDetalle(id)`, `update(id, { estado })` — existen sin cambios en `apps/mobile/src/services/expedientes.service.ts` (leído); `getDetalle` devuelve `{ expediente, bitacora, historial, documentos }`.
- DTOs (`ExpedienteDto`, `DocumentoDto`, `BitacoraDto`, `HistorialDto`, `ConversacionChatDto`, `SolicitanteChatDto`, `MensajeChatDto`) importados de `../types/api` (re-export de `@comite/shared`); campos usados (`investigadorNombre`, `codigoUnico`, `fechaEnvio`, `autores[].apellidosNombres/esPrincipal/correo`, `documento.nombreArchivo/tipoDocumento`, `m.esDeSecretaria`, `c.noLeidos/ultimoMensaje/ultimaFecha`) verificados en `packages/shared/src/types.ts`.
- `StatusBadge estado={e.estado}`: `EstadoExpediente` y `EstadoProyecto` son el mismo union de 8 valores → asignable sin cast.
- `useConfirm()` firma `(mensaje, opciones?) => Promise<boolean>` con `{ titulo, textoConfirmar }` — verificado en `ConfirmContext.tsx`.

**Riesgos anotados para el ejecutor:** (1) **SDK 54 file-system**: usar `expo-file-system/legacy` para `downloadAsync`/`cacheDirectory` con header `Authorization` (la API por defecto cambió a clases `File`/`Directory`); verificar en dispositivo real que el `Authorization` llega (Task 9 lo cubre explícitamente). (2) **Grupos hermanos y loops**: el diseño evita loops porque `homeGroupForRole` es una función total y cada `_layout` solo redirige cuando el grupo no coincide — cubierto en Task 2 Step 7 y en la regresión de Task 9. (3) **Versiones de `expo-file-system`/`expo-sharing`**: fijarlas con `npx expo install` (no hardcodear) para que coincidan con el SDK 54 ya instalado. (4) **Params del hilo de chat**: el nombre/detalle del solicitante viajan por query params desde la lista/picker (el hilo no re-resuelve el nombre); si se entra al hilo por deep-link directo sin params, el header muestra "Solicitante" (aceptable en este corte, no hay deep-linking configurado).

## Critical Files for Implementation
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\pages\secretaria\Bandeja.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\pages\secretaria\Revision.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\pages\secretaria\Chat.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\services\chat.service.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\services\expedientes.service.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\src\services\chat.service.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\app\(app)\_layout.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\app\(app)\perfil.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\mobile\src\lib\http.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\packages\shared\src\types.ts
