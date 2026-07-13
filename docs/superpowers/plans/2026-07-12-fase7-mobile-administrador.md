# App Móvil Expo — Fase 7: Rol Administrador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender `apps/mobile` (app Expo ya construida y verificada para Solicitante/Secretaría/Coordinador/Evaluador en Fases 3-6) con el **último** rol, **Administrador**: un grupo nuevo `(administrador)/` de 4 pestañas (Usuarios/Config/Reportes/Perfil) equivalentes 1:1 a `apps/web/src/pages/admin/*` + `Reportes.tsx` (compartido) + `Perfil.tsx` (compartido), consumiendo la misma API NestJS sin tocar `@comite/shared`, `apps/web` ni `apps/api`.

**Architecture:** Se agrega un grupo de rutas hermano `app/(administrador)/` con su propio `_layout.tsx` (guardia de sesión + Tabs de **4** pestañas: Usuarios=`index` / Config=`configuracion` / Reportes=`reportes` / Perfil=`perfil`). `src/lib/roles.ts` → `homeGroupForRole` gana su valor final `'/(administrador)'` y `administrador` sale del fallback `/rol-no-disponible` (tras esta fase **ningún** rol conocido cae ya en el fallback; se conserva como defensivo). Los grupos `(app)/`/`(secretaria)/`/`(coordinador)/`/`(evaluador)/` quedan intactos. `PerfilScreen.tsx` **no se toca**: el administrador cae en su rama de rol interno existente (misma que Secretaría/Coordinador). Los servicios `users.service.ts` y `config.service.ts` **ya existen** (Fase 3) y se reutilizan sin cambios; solo se agrega un servicio nuevo, `reportes.service.ts`. Los "gráficos" de Reportes se portan como `<View>` nativos proporcionales (sin librería de charts). La exportación a PDF reutiliza `documentDownload.ts` (`abrirDocumento`) sin cambios.

**Tech Stack:** Expo SDK 54 (React Native 0.81, React 19.1, Expo Router 6, `typedRoutes` ON), TypeScript 5.7, `expo-secure-store` 15, `expo-file-system`/`expo-sharing` (ya presentes desde Fase 4), Jest + `jest-expo` 54, `@comite/shared` (workspace), Turborepo, npm workspaces. **No hay dependencias nuevas en esta fase.**

## Global Constraints

- Los grupos `app/(app)/`, `app/(secretaria)/`, `app/(coordinador)/` y `app/(evaluador)/` **se quedan intactos y sin renombrar** — ya verificados en dispositivo real. NO se tocan.
- Se agrega un grupo **nuevo y hermano** `app/(administrador)/` con **4 pestañas**: Usuarios (`index`) / Config (`configuracion`) / Reportes (`reportes`) / Perfil (`perfil`). NO hay dashboard/landing de admin — la pestaña por defecto (`index`) es Usuarios (mismo criterio que la web admin).
- **Tras esta fase NINGÚN rol conocido cae ya en `/rol-no-disponible`.** `administrador` estrena su grupo real; los 7 roles del sistema tienen hogar. La pantalla `/rol-no-disponible` se **conserva igual** como fallback defensivo (por si el backend introdujera un rol futuro/desconocido), pero deja de ser alcanzable por los roles actuales — dejar constancia en un comentario en `roles.ts`.
- **NO se agrega ninguna librería de charts.** Los "gráficos" de Reportes se portan como barras nativas: `<View style={{ width: \`${pct}%\` }}>` proporcionales (mismo cálculo de ancho que `HBarChart`/`StackedHBarChart` de la web). Los tooltips de hover de la web son no-op en táctil (el valor se muestra siempre a la derecha / en la leyenda). Los colores `var(--...)` del CSS web se traducen a hex reales de `src/lib/theme` (RN no soporta CSS vars).
- **Fecha límite (Configuración) = `Input` de texto enmascarado `AAAA-MM-DD`, NO un date picker nativo.** Consistente con cómo TODAS las fechas se ingresan hoy en la app móvil (filtros `AAAA-MM-DD` de Bandeja/Dashboard). Se valida el formato (`/^\d{4}-\d{2}-\d{2}$/`) antes de guardar. NO se agrega `@react-native-community/datetimepicker`.
- **Exportación a PDF reutiliza `documentDownload.ts` (`abrirDocumento`) SIN cambios** — los 3 botones descargan un PDF autenticado (`GET /reportes/exportar?tipo=expedientes|evaluaciones` y `GET /reportes/exportar-reporte`) y lo abren con el share sheet nativo, mismo mecanismo ya usado por Secretaría/Evaluador. `reportes.service.ts` expone helpers de URL (`urlExportar`/`urlExportarReporte`) construidos con `apiUrl`.
- **`users.service.ts` y `config.service.ts` NO se tocan** — ya existen desde Fase 3 con todo lo necesario: `list`/`getById`/`create`/`update`/`deactivate`/`eliminarPermanente` y `getFechaLimite`/`setFechaLimite`. La pantalla de Usuarios y la de Configuración los consumen tal cual. El único servicio nuevo es `reportes.service.ts`.
- **`PerfilScreen.tsx` NO se toca.** El administrador cae en la rama de rol interno existente (`!esSolicitante && !esEvaluador`), la misma de Secretaría/Coordinador (stats Enviados/Aprobados desde `expedientesService.list()`, fila "Expedientes vinculados"). El wrapper `perfil.tsx` es idéntico en forma a `(coordinador)/perfil.tsx`.
- **La pantalla de Usuarios usa `useFocusEffect`** (NO `useEffect(...,[])` mount-only): la lista DEBE refrescarse tras crear/editar/desactivar/eliminar un usuario; `Tabs` mantiene la pantalla montada. Se copia el patrón ya revisado de `app/(coordinador)/index.tsx` (`cargar` devuelve cleanup síncrono; `useFocusEffect(useCallback(() => cargar(), [cargar]))`). Configuración y Reportes son cargas de una sola lectura (no listas que se ensucien al navegar) → `useEffect` mount con flag de cancelación es correcto ahí.
- **Todo header propio (barra superior custom) usa `useSafeAreaInsets()`** y suma `insets.top` a su `paddingTop`. Usuarios, Configuración y Reportes tienen header custom → aplica en las 3. `PerfilScreen` ya lo usa internamente.
- **El cuerpo de toda pantalla nueva va envuelto en `Screen`** de `src/components/ui.tsx` (ScrollView `flex:1` + padding) — crítico en Usuarios y Reportes, que pueden ser largas.
- **Validación de password ≥8** (calcada de la web `admin/Usuarios.tsx`), aunque el backend solo exija ≥6. Se replica la validación de la web sin relajarla.
- **El formulario de crear usuario solo setea campos de evaluador (`especialidad`, `cargaTrabajo`) condicionalmente** (`form.rol === 'evaluador'`); NO setea `laboratorio` ni `codigoEstudiante` (aunque existen en `UserDto`). Se replica igual que la web.
- **Auto-desactivación y auto-eliminación bloqueadas:** los botones "Desactivar" y "Eliminar" quedan deshabilitados sobre la propia cuenta (`u.id === usuario?.id`), y el handler además corta temprano con un mensaje. `useApp()` provee `usuario.id`.
- **"Eliminar permanente" solo para roles internos:** el botón solo se muestra si `ROLES_INTERNOS.includes(u.rol)` (`['administrador','coordinador','secretaria','evaluador']`), igual que la web. `deactivate` (soft) está disponible para cualquier fila; `eliminarPermanente` no.
- **Confirmaciones con `useConfirm()`** antes de desactivar (irreversible-ish, `peligroso: true`), eliminar permanente (`peligroso: true`) y quitar fecha límite. Estados de error/carga con el patrón establecido: `ApiError` capturado + `ErrorText`; `cargando`/`error`/vacío explícitos; flag `activo`/`cancelado` en efectos async.
- **Reutilizar los primitivos UI existentes** (`Card`, `Badge`, `StatusBadge`, `Screen`, `Input`, `Field`, `Button`, `ErrorText`, `Loading`, `SectionTitle`) y el patrón **`Selector`-píldora** (segmented pills, estilos `segment`/`segItem`/`segItemActive`/`segText`/`segTextActive` de `app/(app)/nuevo/index.tsx`) para los dropdowns de rol/estado (en RN no existe `<select>`). No reinventar componentes.
- **La lógica pura se extrae a funciones testeadas** (mismo precedente que `expedienteListFilter`/`coordinadorFilter`/`rubricaResultado`): el filtro de usuarios a `src/lib/usuariosFilter.ts`, y la matemática de ancho de las barras a `src/lib/chartBars.ts` — ambas con su test.
- Endpoints/nombres de funciones/payloads calcan `apps/web/src/services/{users,config,reportes}.service.ts` y las rutas reales de `apps/api/src/{users,config,reportes}/*.controller.ts`.
- **`ResumenReporte` NO existe en `@comite/shared`** (solo `UserDto` y `FechaLimiteDto`): se define un tipo propio en `reportes.service.ts` contra la forma REAL del backend (`apps/api/src/reportes/reportes.service.ts` → `resumen()`), idéntico al de `apps/web/src/services/reportes.service.ts`. Es la única fuente de verdad del tipo que consumen la pantalla de Reportes y los componentes de gráfico.
- Cada tarea termina con `tsc --noEmit` limpio (`npm run typecheck -w @comite/mobile`) y `npm test -w @comite/mobile` si toca tests + commit. La verificación E2E en Android real se concentra en la última tarea.

---

### Task 1: Scaffold del grupo `(administrador)/` — `homeGroupForRole` final + layout 4 tabs + placeholders + Perfil real

**Files:**
- Modify: `apps/mobile/src/lib/roles.ts`
- Modify: `apps/mobile/src/lib/__tests__/roles.test.ts`
- Create: `apps/mobile/app/(administrador)/_layout.tsx`
- Create: `apps/mobile/app/(administrador)/index.tsx` (placeholder Usuarios — se reemplaza en Task 4)
- Create: `apps/mobile/app/(administrador)/configuracion.tsx` (placeholder — se reemplaza en Task 2)
- Create: `apps/mobile/app/(administrador)/reportes.tsx` (placeholder — se reemplaza en Task 7)
- Create: `apps/mobile/app/(administrador)/perfil.tsx` (wrapper REAL de `PerfilScreen`)

**Interfaces:**
- Consumes: `RolBackend` de `../types/api`; `ROLES_SOLICITANTE` de `../data/types`; `useApp()`; `Loading`; `colors`; `homeGroupForRole`; `Tabs`/`Redirect` de `expo-router`; `PerfilScreen`.
- Produces: `HomeGroup` gana `'/(administrador)'`; `homeGroupForRole` con rama final `rol === 'administrador' → '/(administrador)'` y fallback ya inalcanzable. Grupo `(administrador)/` montado con 4 pestañas (Usuarios/Config/Reportes/Perfil). Guard: sin sesión → `/login`; rol no-administrador → su propio grupo.

Nota: `PerfilScreen.tsx` **NO se modifica** — el administrador (`!esSolicitante && !esEvaluador`) ya cae en su rama de rol interno existente. `app/index.tsx`, `app/login.tsx` y los `_layout.tsx` de los otros grupos NO requieren cambios (ya delegan en `homeGroupForRole`). El único guard nuevo es `(administrador)/_layout.tsx`. Los 3 placeholders (`index`/`configuracion`/`reportes`) permiten escribir el `_layout` una sola vez; `perfil.tsx` se crea real.

- [ ] **Step 1: Reemplazar el contenido completo de `src/lib/roles.ts`**

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
  | '/(administrador)'
  | '/rol-no-disponible'

export function homeGroupForRole(rol: RolBackend): HomeGroup {
  if (ROLES_SOLICITANTE.includes(rol)) return '/(app)'
  if (rol === 'secretaria') return '/(secretaria)'
  if (rol === 'coordinador') return '/(coordinador)'
  if (rol === 'evaluador') return '/(evaluador)'
  if (rol === 'administrador') return '/(administrador)'
  // Tras la Fase 7 los 7 roles del sistema tienen su grupo propio, así que
  // NINGÚN rol conocido llega ya hasta acá. Se conserva la rama como fallback
  // defensivo por si el backend introdujera un rol futuro/desconocido: en ese
  // caso se manda a /rol-no-disponible en vez de a '/(app)' (que mostraría el
  // wizard del solicitante con datos ajenos, confuso y engañoso).
  return '/rol-no-disponible'
}
```

- [ ] **Step 2: Reemplazar el contenido completo de `src/lib/__tests__/roles.test.ts`**

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
  it('manda coordinador a /(coordinador)', () => {
    expect(homeGroupForRole('coordinador')).toBe('/(coordinador)')
  })
  it('manda evaluador a /(evaluador)', () => {
    expect(homeGroupForRole('evaluador')).toBe('/(evaluador)')
  })
  it('manda administrador a su propio grupo /(administrador) (ya no al fallback)', () => {
    expect(homeGroupForRole('administrador')).toBe('/(administrador)')
  })
})
```

- [ ] **Step 3: `app/(administrador)/_layout.tsx` — guard + Tabs de 4 pestañas**

```tsx
// app/(administrador)/_layout.tsx
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

export default function AdministradorLayout() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Cargando…" /></View>
  if (!usuario) return <Redirect href="/login" />
  // Si el usuario no es administrador, mándalo a su propio grupo (evita ver
  // pantallas que no le corresponden si navega a mano a esta URL).
  if (homeGroupForRole(usuario.rol) !== '/(administrador)') {
    return <Redirect href={homeGroupForRole(usuario.rol)} />
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.slate400 }}>
      <Tabs.Screen name="index" options={{ title: 'Usuarios', tabBarIcon: ({ color }) => <TabIcon label="◪" color={color} /> }} />
      <Tabs.Screen name="configuracion" options={{ title: 'Config', tabBarIcon: ({ color }) => <TabIcon label="⚙" color={color} /> }} />
      <Tabs.Screen name="reportes" options={{ title: 'Reportes', tabBarIcon: ({ color }) => <TabIcon label="▤" color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <TabIcon label="◔" color={color} /> }} />
    </Tabs>
  )
}
```

- [ ] **Step 4: Placeholder `app/(administrador)/index.tsx`**

```tsx
// app/(administrador)/index.tsx — placeholder, se reemplaza por la pantalla de Usuarios en Task 4
import { Screen, SectionTitle } from '../../src/components/ui'

export default function UsuariosPlaceholder() {
  return (
    <Screen>
      <SectionTitle>Usuarios (placeholder)</SectionTitle>
    </Screen>
  )
}
```

- [ ] **Step 5: Placeholder `app/(administrador)/configuracion.tsx`**

```tsx
// app/(administrador)/configuracion.tsx — placeholder, se reemplaza en Task 2
import { Screen, SectionTitle } from '../../src/components/ui'

export default function ConfiguracionPlaceholder() {
  return (
    <Screen>
      <SectionTitle>Configuración (placeholder)</SectionTitle>
    </Screen>
  )
}
```

- [ ] **Step 6: Placeholder `app/(administrador)/reportes.tsx`**

```tsx
// app/(administrador)/reportes.tsx — placeholder, se reemplaza en Task 7
import { Screen, SectionTitle } from '../../src/components/ui'

export default function ReportesPlaceholder() {
  return (
    <Screen>
      <SectionTitle>Reportes (placeholder)</SectionTitle>
    </Screen>
  )
}
```

- [ ] **Step 7: `app/(administrador)/perfil.tsx` — wrapper REAL de `PerfilScreen`**

```tsx
// app/(administrador)/perfil.tsx
import PerfilScreen from '../../src/components/screens/PerfilScreen'

export default function PerfilAdministrador() {
  return <PerfilScreen />
}
```

- [ ] **Step 8: Test + typecheck + verificación de montaje**

```bash
npm run build -w @comite/shared
npm test -w @comite/mobile
npm run typecheck -w @comite/mobile
# Android/emulador: login con admin@uch.edu.pe -> entra al grupo
# (administrador) con 4 pestañas (Usuarios/Config/Reportes/Perfil) mostrando
# los placeholders y el Perfil REAL (rama de rol interno: stats
# Enviados/Aprobados y fila "Expedientes vinculados").
# Verificar que NO hay loop de redirección entre los 5 grupos:
#  admin queda estable en (administrador); solicitante en (app), secretaría en
#  (secretaria), coordinador en (coordinador), evaluador en (evaluador).
```

(Con la carpeta del grupo ya creada en este mismo task, `typedRoutes` reconoce `'/(administrador)'` y el typecheck queda limpio.)

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/lib/roles.ts apps/mobile/src/lib/__tests__/roles.test.ts "apps/mobile/app/(administrador)"
git commit -m "feat(mobile): scaffold grupo (administrador) (layout 4 tabs, Perfil real) + homeGroupForRole final"
```

---

### Task 2: Pantalla de Configuración — fecha límite con `Input` enmascarado `AAAA-MM-DD`

**Files:**
- Modify: `apps/mobile/app/(administrador)/configuracion.tsx` (reemplaza el placeholder)

**Interfaces:**
- Consumes: `configService.getFechaLimite()`/`setFechaLimite()` (ya existen, sin cambios); `formatearFecha` de `../../src/lib/dates`; `ApiError`; `useConfirm()`; `useSafeAreaInsets`; primitivos UI (`Card`/`Button`/`ErrorText`/`Field`/`Input`/`Loading`/`Screen`).
- Produces: pantalla Configuración con header custom (`useSafeAreaInsets`), cuerpo en `Screen`, muestra la fecha límite actual (o "sin configurar"), `Input` `AAAA-MM-DD` con validación de formato + "Guardar" (`setFechaLimite(valor)`) y "Quitar" (`setFechaLimite(null)` tras `useConfirm`), mensajes de éxito/error.

Nota: NO se usa date picker nativo — `Input` de texto con placeholder `AAAA-MM-DD` y `maxLength={10}`, coherente con el resto de la app. La validación exige `/^\d{4}-\d{2}-\d{2}$/`. `getFechaLimite`/`setFechaLimite` devuelven `FechaLimiteDto` (`{ fechaLimite: string | null }`). Es una lectura de una sola vez (no una lista que se ensucie al navegar) → `useEffect` mount con flag de cancelación, no `useFocusEffect`.

- [ ] **Step 1: Reemplazar `app/(administrador)/configuracion.tsx`**

```tsx
// app/(administrador)/configuracion.tsx
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, ErrorText, Field, Input, Loading, Screen } from '../../src/components/ui'
import { colors } from '../../src/lib/theme'
import { formatearFecha } from '../../src/lib/dates'
import { ApiError } from '../../src/lib/http'
import { configService } from '../../src/services'
import { useConfirm } from '../../src/state/ConfirmContext'

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

function aValorInput(fecha: string | null): string {
  return fecha ? fecha.slice(0, 10) : ''
}

export default function ConfiguracionAdmin() {
  const insets = useSafeAreaInsets()
  const confirmar = useConfirm()
  const [fechaLimite, setFechaLimite] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(() => {
    let activo = true
    ;(async () => {
      setCargando(true)
      setError('')
      try {
        const dto = await configService.getFechaLimite()
        if (!activo) return
        setFechaLimite(dto.fechaLimite)
        setValor(aValorInput(dto.fechaLimite))
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudo cargar la fecha límite.')
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  useEffect(() => cargar(), [cargar])

  // Auto-ocultar el mensaje de éxito a los 3.5s (mismo criterio que la web).
  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(''), 3500)
    return () => clearTimeout(t)
  }, [mensaje])

  async function guardar() {
    const v = valor.trim()
    if (!FORMATO_FECHA.test(v)) {
      setError('Ingresa una fecha válida con el formato AAAA-MM-DD.')
      return
    }
    setError('')
    setMensaje('')
    setGuardando(true)
    try {
      const dto = await configService.setFechaLimite(v)
      setFechaLimite(dto.fechaLimite)
      setValor(aValorInput(dto.fechaLimite))
      setMensaje('Fecha límite guardada correctamente.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la fecha límite.')
    } finally {
      setGuardando(false)
    }
  }

  async function quitar() {
    if (!(await confirmar('¿Quitar la fecha límite configurada?', { titulo: 'Quitar fecha límite' }))) return
    setError('')
    setMensaje('')
    setGuardando(true)
    try {
      const dto = await configService.setFechaLimite(null)
      setFechaLimite(dto.fechaLimite)
      setValor('')
      setMensaje('Fecha límite eliminada.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo quitar la fecha límite.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.headerKicker}>Administración</Text>
        <Text style={s.headerTitle}>Configuración</Text>
      </View>

      <Screen>
        {cargando && <Loading label="Cargando configuración…" />}
        {!cargando && (
          <Card style={{ gap: 14 }}>
            <Text style={s.titulo}>Fecha límite de envío de protocolos</Text>
            <Text style={s.actual}>
              {fechaLimite ? `Fecha límite actual: ${formatearFecha(fechaLimite)}` : 'No hay una fecha límite configurada.'}
            </Text>

            <Field label="Nueva fecha límite">
              <Input
                placeholder="AAAA-MM-DD"
                value={valor}
                onChangeText={setValor}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={10}
              />
            </Field>

            {!!error && <ErrorText>{error}</ErrorText>}
            {!!mensaje && <Text style={s.ok}>{mensaje}</Text>}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title="Quitar" variant="outline" disabled={guardando || !fechaLimite} onPress={quitar} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={guardando ? 'Guardando…' : 'Guardar'} loading={guardando} onPress={guardar} />
              </View>
            </View>
          </Card>
        )}
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  headerKicker: { fontSize: 12.5, color: colors.slate500 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  titulo: { fontSize: 14, fontWeight: '700', color: colors.navy },
  actual: { fontSize: 13, color: colors.slate500 },
  ok: { fontSize: 13, fontWeight: '600', color: colors.success },
})
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck -w @comite/mobile
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(mobile): pantalla Configuración del admin (fecha límite AAAA-MM-DD enmascarada)"
```

---

### Task 3: Filtro puro de usuarios (`usuariosFilter.ts`) + test

**Files:**
- Create: `apps/mobile/src/lib/usuariosFilter.ts`
- Create: `apps/mobile/src/lib/__tests__/usuariosFilter.test.ts`

**Interfaces:**
- Consumes: `RolBackend`, `UserDto` de `../types/api`.
- Produces:
  - `export type FiltroEstadoUsuario = 'todos' | 'activos' | 'inactivos'`
  - `export interface FiltroUsuarios { busqueda: string; rol: RolBackend | 'todos'; estado: FiltroEstadoUsuario }`
  - `export function filtrarUsuarios(usuarios: UserDto[], filtro: FiltroUsuarios): UserDto[]`

Nota: calca la lógica de filtrado inline de `apps/web/src/pages/admin/Usuarios.tsx` (`usuariosFiltrados`): texto sobre `nombre+apellido` o `email`; rol exacto; estado con la convención **activo = `activo !== false`** (incluye `activo === null`) / inactivo = `activo === false`. Se extrae como función pura testeada (precedente: `expedienteListFilter`/`coordinadorFilter`). El cálculo de `rolesPresentes` (para poblar el dropdown de rol) vive en la pantalla, no acá, porque necesita `ROL_LABEL` para ordenar.

- [ ] **Step 1: `src/lib/usuariosFilter.ts`**

```typescript
// src/lib/usuariosFilter.ts
import type { RolBackend, UserDto } from '../types/api'

export type FiltroEstadoUsuario = 'todos' | 'activos' | 'inactivos'

export interface FiltroUsuarios {
  busqueda: string
  rol: RolBackend | 'todos'
  estado: FiltroEstadoUsuario
}

// Filtro puro de la lista de usuarios del Administrador: texto sobre
// nombre+apellido o email, dropdown de rol, y estado. Convención de estado
// calcada de la web (admin/Usuarios.tsx): activo = `activo !== false` (una fila
// con activo === null se considera activa); inactivo = `activo === false`. Se
// extrae como función pura y testeada, mismo precedente que expedienteListFilter.
export function filtrarUsuarios(usuarios: UserDto[], filtro: FiltroUsuarios): UserDto[] {
  const q = filtro.busqueda.trim().toLowerCase()
  return usuarios.filter(u => {
    const coincideTexto =
      !q ||
      `${u.nombre} ${u.apellido}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    const coincideRol = filtro.rol === 'todos' || u.rol === filtro.rol
    const coincideEstado =
      filtro.estado === 'todos' ||
      (filtro.estado === 'activos' ? u.activo !== false : u.activo === false)
    return coincideTexto && coincideRol && coincideEstado
  })
}
```

- [ ] **Step 2: `src/lib/__tests__/usuariosFilter.test.ts`**

```typescript
// src/lib/__tests__/usuariosFilter.test.ts
import { filtrarUsuarios } from '../usuariosFilter'
import type { UserDto } from '../../types/api'

// Solo los campos que el filtro toca importan; el resto se completa con el cast.
function u(over: Partial<UserDto>): UserDto {
  return { id: 1, email: 'ana@uch.pe', nombre: 'Ana', apellido: 'López', rol: 'coordinador', activo: true, ...over } as UserDto
}

describe('filtrarUsuarios', () => {
  const base: UserDto[] = [
    u({ id: 1, nombre: 'Ana', apellido: 'López', email: 'ana@uch.pe', rol: 'coordinador', activo: true }),
    u({ id: 2, nombre: 'Beto', apellido: 'Ruiz', email: 'beto@uch.pe', rol: 'evaluador', activo: false }),
    u({ id: 3, nombre: 'Caro', apellido: 'Díaz', email: 'caro@uch.pe', rol: 'evaluador', activo: null }),
  ]

  it('sin filtros devuelve todos', () => {
    expect(filtrarUsuarios(base, { busqueda: '', rol: 'todos', estado: 'todos' }).map(x => x.id)).toEqual([1, 2, 3])
  })
  it('filtra por texto en nombre/apellido o email (case-insensitive)', () => {
    expect(filtrarUsuarios(base, { busqueda: 'ruiz', rol: 'todos', estado: 'todos' }).map(x => x.id)).toEqual([2])
    expect(filtrarUsuarios(base, { busqueda: 'caro@', rol: 'todos', estado: 'todos' }).map(x => x.id)).toEqual([3])
  })
  it('filtra por rol', () => {
    expect(filtrarUsuarios(base, { busqueda: '', rol: 'evaluador', estado: 'todos' }).map(x => x.id)).toEqual([2, 3])
  })
  it('activos = activo !== false (incluye null); inactivos = activo === false', () => {
    expect(filtrarUsuarios(base, { busqueda: '', rol: 'todos', estado: 'activos' }).map(x => x.id)).toEqual([1, 3])
    expect(filtrarUsuarios(base, { busqueda: '', rol: 'todos', estado: 'inactivos' }).map(x => x.id)).toEqual([2])
  })
})
```

- [ ] **Step 3: Test + typecheck**

```bash
npm test -w @comite/mobile
npm run typecheck -w @comite/mobile
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/usuariosFilter.ts apps/mobile/src/lib/__tests__/usuariosFilter.test.ts
git commit -m "feat(mobile): filtro puro de usuarios (texto/rol/estado) + test"
```

---

### Task 4: Pantalla de Usuarios — CRUD completo (lista + filtros + crear + editar + desactivar/eliminar)

**Files:**
- Modify: `apps/mobile/app/(administrador)/index.tsx` (reemplaza el placeholder)

**Interfaces:**
- Consumes: `usersService.list/create/update/deactivate/eliminarPermanente` (ya existen, sin cambios); `filtrarUsuarios`, `FiltroEstadoUsuario` de `../../src/lib/usuariosFilter`; `useApp()` (para `usuario.id`); `useConfirm()`; `useFocusEffect`; `useSafeAreaInsets`; `ApiError`; `ROL_LABEL` de `../../src/data/types`; `RolBackend`, `UserDto` de `../../src/types/api`; primitivos UI (`Badge`/`Button`/`Card`/`ErrorText`/`Field`/`Input`/`Loading`/`Screen`) + patrón `Selector`-píldora inline.
- Produces: pantalla Usuarios con header custom (`useSafeAreaInsets`), cuerpo en `Screen`, carga con `useFocusEffect`. Búsqueda + filtro de rol (píldoras dinámicas según `rolesPresentes`) + filtro de estado (píldoras Todos/Activos/Inactivos) + "Limpiar". Formulario de crear usuario interno (toggle) con rol en píldoras (`ROLES_INTERNOS`) + campos condicionales de evaluador; validaciones idénticas a la web (todos requeridos, password ≥8, especialidad requerida si evaluador). Edición inline por fila (rol en píldoras + toggle activo → `update(id,{rol,activo})`). Desactivar (soft, `useConfirm` `peligroso`) y Eliminar permanente (solo roles internos, `useConfirm` `peligroso` con advertencia) → ambos bloqueados sobre la propia cuenta.

Nota de diseño: en la web la edición es inline dentro de la fila y hay layout desktop+móvil duplicado; el móvil colapsa todo a una sola columna y usa el patrón `Selector`-píldora (no existe `<select>` en RN). El formulario de crear y la edición inline conviven en el mismo archivo (una sola escritura, sin fase parcial) — la extracción del filtro puro en Task 3 ya peló la parte testeable, dejando la pantalla como una CRUD directa. `cargar()` se invoca (sin `await`) tras crear/editar/desactivar/eliminar para refrescar; `useFocusEffect` cubre además el refresco al volver de otra pestaña.

- [ ] **Step 1: Reemplazar `app/(administrador)/index.tsx`**

```tsx
// app/(administrador)/index.tsx
import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Badge, Button, Card, ErrorText, Field, Input, Loading, Screen } from '../../src/components/ui'
import { colors } from '../../src/lib/theme'
import { ApiError } from '../../src/lib/http'
import { filtrarUsuarios, type FiltroEstadoUsuario } from '../../src/lib/usuariosFilter'
import { usersService } from '../../src/services'
import { useApp } from '../../src/state/AppContext'
import { useConfirm } from '../../src/state/ConfirmContext'
import { ROL_LABEL } from '../../src/data/types'
import type { RolBackend, UserDto } from '../../src/types/api'

const ROLES_INTERNOS: RolBackend[] = ['administrador', 'coordinador', 'secretaria', 'evaluador']
const ESTADOS: { key: FiltroEstadoUsuario; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'activos', label: 'Activos' },
  { key: 'inactivos', label: 'Inactivos' },
]

interface FormState {
  nombre: string
  apellido: string
  email: string
  password: string
  rol: RolBackend
  especialidad: string
  cargaTrabajo: string
}
const FORM_INICIAL: FormState = {
  nombre: '', apellido: '', email: '', password: '',
  rol: 'coordinador', especialidad: '', cargaTrabajo: '',
}

export default function UsuariosAdmin() {
  const { usuario } = useApp()
  const confirmar = useConfirm()
  const insets = useSafeAreaInsets()

  const [usuarios, setUsuarios] = useState<UserDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accionError, setAccionError] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState<RolBackend | 'todos'>('todos')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoUsuario>('todos')

  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [formError, setFormError] = useState('')
  const [creando, setCreando] = useState(false)

  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editRol, setEditRol] = useState<RolBackend>('coordinador')
  const [editActivo, setEditActivo] = useState(true)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  const cargar = useCallback(() => {
    let activo = true
    ;(async () => {
      setCargando(true)
      setError('')
      try {
        const lista = await usersService.list(0, 200)
        if (activo) setUsuarios(lista)
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de usuarios.')
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  // useFocusEffect (NO useEffect mount-only): la lista debe refrescarse tras
  // crear/editar/desactivar/eliminar; Tabs mantiene la pantalla montada, así que
  // se recarga en cada focus (lección de Fases 4/5).
  useFocusEffect(
    useCallback(() => {
      const cancelar = cargar()
      return cancelar
    }, [cargar]),
  )

  // Roles realmente presentes en los datos (no una lista fija que podría quedar
  // corta), ordenados por su etiqueta -- calcado de la web.
  const rolesPresentes = useMemo(
    () => Array.from(new Set(usuarios.map(u => u.rol))).sort((a, b) => ROL_LABEL[a].localeCompare(ROL_LABEL[b])),
    [usuarios],
  )

  const usuariosFiltrados = useMemo(
    () => filtrarUsuarios(usuarios, { busqueda, rol: filtroRol, estado: filtroEstado }),
    [usuarios, busqueda, filtroRol, filtroEstado],
  )

  function actualizarForm<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroRol('todos')
    setFiltroEstado('todos')
  }

  async function crearUsuario() {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.email.trim() || !form.password) {
      setFormError('Completa todos los campos obligatorios.')
      return
    }
    if (form.password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (form.rol === 'evaluador' && !form.especialidad.trim()) {
      setFormError('Indica la especialidad del evaluador.')
      return
    }
    setFormError('')
    setCreando(true)
    try {
      // Solo se envían especialidad/cargaTrabajo cuando el rol es evaluador
      // (NO se setea laboratorio ni codigoEstudiante), calcado de la web.
      await usersService.create({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        email: form.email.trim(),
        password: form.password,
        rol: form.rol,
        especialidad: form.rol === 'evaluador' ? form.especialidad.trim() : undefined,
        cargaTrabajo: form.rol === 'evaluador' && form.cargaTrabajo ? Number(form.cargaTrabajo) : undefined,
      })
      setForm(FORM_INICIAL)
      setMostrarForm(false)
      cargar()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario.')
    } finally {
      setCreando(false)
    }
  }

  function iniciarEdicion(u: UserDto) {
    setAccionError('')
    setEditandoId(u.id)
    setEditRol(u.rol)
    setEditActivo(u.activo !== false)
  }

  async function guardarEdicion(id: number) {
    setGuardandoEdicion(true)
    setAccionError('')
    try {
      await usersService.update(id, { rol: editRol, activo: editActivo })
      setEditandoId(null)
      cargar()
    } catch (err) {
      setAccionError(err instanceof ApiError ? err.message : 'No se pudo actualizar el usuario.')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  async function desactivar(u: UserDto) {
    if (u.id === usuario?.id) {
      setAccionError('No puedes desactivar tu propia cuenta.')
      return
    }
    if (!(await confirmar(`¿Desactivar a ${u.nombre} ${u.apellido}?`, { titulo: 'Desactivar usuario', textoConfirmar: 'Desactivar', peligroso: true }))) return
    setAccionError('')
    try {
      await usersService.deactivate(u.id)
      cargar()
    } catch (err) {
      setAccionError(err instanceof ApiError ? err.message : 'No se pudo desactivar al usuario.')
    }
  }

  async function eliminarPermanente(u: UserDto) {
    if (u.id === usuario?.id) {
      setAccionError('No puedes eliminar tu propia cuenta.')
      return
    }
    if (!(await confirmar(
      `Esto borra la cuenta de ${u.nombre} ${u.apellido} de forma permanente (no se puede deshacer). Solo funciona si no tiene evaluaciones ni mensajes de chat registrados; si los tiene, usa "Desactivar" en su lugar.`,
      { titulo: 'Eliminar permanentemente', textoConfirmar: 'Eliminar', peligroso: true },
    ))) return
    setAccionError('')
    try {
      await usersService.eliminarPermanente(u.id)
      cargar()
    } catch (err) {
      setAccionError(err instanceof ApiError ? err.message : 'No se pudo eliminar al usuario.')
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={s.headerKicker}>Administración</Text>
          <Text style={s.headerTitle}>Usuarios internos</Text>
        </View>
        {!mostrarForm && (
          <Pressable onPress={() => { setMostrarForm(true); setFormError('') }} style={s.nuevoBtn}>
            <Text style={s.nuevoBtnText}>+ Crear</Text>
          </Pressable>
        )}
      </View>

      <Screen>
        {!!error && <ErrorText>{error}</ErrorText>}
        {!!accionError && <ErrorText>{accionError}</ErrorText>}

        {mostrarForm && (
          <Card style={{ gap: 12 }}>
            <Text style={s.formTitulo}>Nuevo usuario interno</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Nombres"><Input placeholder="María" value={form.nombre} onChangeText={v => actualizarForm('nombre', v)} /></Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Apellidos"><Input placeholder="Fernández" value={form.apellido} onChangeText={v => actualizarForm('apellido', v)} /></Field>
              </View>
            </View>
            <Field label="Correo institucional">
              <Input placeholder="usuario@uch.pe" value={form.email} onChangeText={v => actualizarForm('email', v)} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
            </Field>
            <Field label="Contraseña">
              <Input placeholder="Mínimo 8 caracteres" value={form.password} onChangeText={v => actualizarForm('password', v)} secureTextEntry autoCapitalize="none" />
            </Field>
            <Field label="Rol">
              <View style={s.segment}>
                {ROLES_INTERNOS.map(r => (
                  <Pressable key={r} onPress={() => actualizarForm('rol', r)} style={[s.segItem, form.rol === r && s.segItemActive]}>
                    <Text style={[s.segText, form.rol === r && s.segTextActive]}>{ROL_LABEL[r]}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            {form.rol === 'evaluador' && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Especialidad"><Input placeholder="Bioética" value={form.especialidad} onChangeText={v => actualizarForm('especialidad', v)} /></Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Carga de trabajo"><Input placeholder="0" value={form.cargaTrabajo} onChangeText={v => actualizarForm('cargaTrabajo', v)} keyboardType="number-pad" /></Field>
                </View>
              </View>
            )}
            {!!formError && <ErrorText>{formError}</ErrorText>}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title="Cancelar" variant="outline" onPress={() => { setMostrarForm(false); setForm(FORM_INICIAL); setFormError('') }} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={creando ? 'Creando…' : 'Crear usuario'} loading={creando} onPress={crearUsuario} />
              </View>
            </View>
          </Card>
        )}

        <Input placeholder="Buscar por nombre o correo…" value={busqueda} onChangeText={setBusqueda} autoCapitalize="none" />

        <View style={s.segment}>
          <Pressable onPress={() => setFiltroRol('todos')} style={[s.segItem, filtroRol === 'todos' && s.segItemActive]}>
            <Text style={[s.segText, filtroRol === 'todos' && s.segTextActive]}>Todos</Text>
          </Pressable>
          {rolesPresentes.map(r => (
            <Pressable key={r} onPress={() => setFiltroRol(r)} style={[s.segItem, filtroRol === r && s.segItemActive]}>
              <Text style={[s.segText, filtroRol === r && s.segTextActive]}>{ROL_LABEL[r]}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.segment}>
          {ESTADOS.map(e => (
            <Pressable key={e.key} onPress={() => setFiltroEstado(e.key)} style={[s.segItem, filtroEstado === e.key && s.segItemActive]}>
              <Text style={[s.segText, filtroEstado === e.key && s.segTextActive]}>{e.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.contador}>
            {cargando ? 'Cargando…' : `${usuariosFiltrados.length} de ${usuarios.length}`}
          </Text>
          <Pressable onPress={limpiarFiltros}><Text style={s.limpiar}>Limpiar</Text></Pressable>
        </View>

        <View style={{ gap: 10 }}>
          {cargando && <Loading label="Cargando usuarios…" />}
          {!cargando && usuariosFiltrados.map(u => {
            const esYo = u.id === usuario?.id
            const inactivo = u.activo === false
            const editando = editandoId === u.id
            return (
              <Card key={u.id} style={{ gap: 8 }}>
                <View>
                  <Text numberOfLines={1} style={s.nombre}>{u.nombre} {u.apellido}</Text>
                  <Text style={s.email}>{u.email}</Text>
                </View>

                {editando ? (
                  <View style={{ gap: 10 }}>
                    <View style={s.segment}>
                      {ROLES_INTERNOS.map(r => (
                        <Pressable key={r} onPress={() => setEditRol(r)} style={[s.segItem, editRol === r && s.segItemActive]}>
                          <Text style={[s.segText, editRol === r && s.segTextActive]}>{ROL_LABEL[r]}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable onPress={() => setEditActivo(v => !v)} style={s.check}>
                      <View style={[s.checkBox, editActivo && s.checkBoxOn]}>{editActivo && <Text style={s.checkMark}>✓</Text>}</View>
                      <Text style={s.checkLabel}>Cuenta activa</Text>
                    </Pressable>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}><Button title="Cancelar" variant="outline" onPress={() => setEditandoId(null)} /></View>
                      <View style={{ flex: 1 }}><Button title={guardandoEdicion ? 'Guardando…' : 'Guardar'} loading={guardandoEdicion} onPress={() => guardarEdicion(u.id)} /></View>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <Badge label={ROL_LABEL[u.rol]} bg={colors.blue50} fg={colors.primary} />
                      <Badge label={inactivo ? 'Inactivo' : 'Activo'} bg={inactivo ? colors.chipBg : colors.successBg} fg={inactivo ? colors.slate500 : colors.success} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 18, flexWrap: 'wrap', marginTop: 2 }}>
                      <Pressable onPress={() => iniciarEdicion(u)}><Text style={s.accion}>Editar</Text></Pressable>
                      <Pressable disabled={esYo} onPress={() => desactivar(u)}><Text style={[s.accionDanger, esYo && s.accionOff]}>Desactivar</Text></Pressable>
                      {ROLES_INTERNOS.includes(u.rol) && (
                        <Pressable disabled={esYo} onPress={() => eliminarPermanente(u)}><Text style={[s.accionDanger, esYo && s.accionOff]}>Eliminar</Text></Pressable>
                      )}
                    </View>
                  </>
                )}
              </Card>
            )
          })}
          {!cargando && !error && usuariosFiltrados.length === 0 && (
            <Text style={s.vacio}>{usuarios.length === 0 ? 'No hay usuarios registrados.' : 'Ningún usuario coincide con esos filtros.'}</Text>
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
  nuevoBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  nuevoBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  formTitulo: { fontSize: 14, fontWeight: '700', color: colors.navy },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  segItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: 12.5, color: colors.slate500, fontWeight: '600' },
  segTextActive: { color: '#fff' },
  contador: { fontSize: 13, fontWeight: '700', color: colors.navy },
  limpiar: { fontSize: 13, fontWeight: '600', color: colors.primary },
  nombre: { fontSize: 14, fontWeight: '700', color: colors.ink },
  email: { fontSize: 12, color: colors.slate400, marginTop: 1 },
  accion: { fontSize: 13, fontWeight: '600', color: colors.primary },
  accionDanger: { fontSize: 13, fontWeight: '600', color: colors.danger },
  accionOff: { color: colors.slate400 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  checkLabel: { fontSize: 13, color: colors.slate700 },
  vacio: { textAlign: 'center', fontSize: 13.5, color: colors.slate500, marginTop: 24 },
})
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck -w @comite/mobile
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(mobile): pantalla Usuarios del admin (CRUD: lista/filtros/crear/editar/desactivar/eliminar, self-block, useFocusEffect)"
```

---

### Task 5: Servicio `reportes.service.ts` (nuevo) + tipo `ResumenReporte` + barrel

**Files:**
- Create: `apps/mobile/src/services/reportes.service.ts`
- Modify: `apps/mobile/src/services/index.ts`

**Interfaces:**
- Consumes: `apiUrl`, `request` de `../lib/http`.
- Produces:
  - `export interface CargaEvaluador`, `ResultadoEmitido`, `TiempoAtencion`, `ResumenReporte`.
  - `export function resumen(): Promise<ResumenReporte>` (`GET /reportes/resumen`).
  - `export function urlExportar(tipo: 'expedientes' | 'evaluaciones'): string` (URL absoluta para `abrirDocumento`).
  - `export function urlExportarReporte(): string`.
  - Barrel: `export * as reportesService from './reportes.service'`.

Nota (confirmado en `apps/api/src/reportes/reportes.service.ts` → `resumen()`, líneas 225-236): la respuesta real es `{ fechaGeneracion, expedientes:{total,porEstado}, evaluadores:{totalEvaluadores,cargaPromedio,cargaMaxima}, tiemposAtencion:[], cargaEvaluadores:[{evaluadorId,nombre,totalEvaluaciones}], resultados:[{tipo,total}] }`. `@comite/shared` NO expone `ResumenReporte` (solo `UserDto`/`FechaLimiteDto`), así que se define acá — idéntico al de `apps/web/src/services/reportes.service.ts`. `tiemposAtencion` se incluye por fidelidad al backend aunque la pantalla de Reportes no lo consuma. Los endpoints de exportación (`GET /reportes/exportar?tipo=...` y `GET /reportes/exportar-reporte`) devuelven un PDF real con `Content-Disposition: attachment` (buffer directo), por eso `abrirDocumento` los maneja igual que cualquier documento; los helpers solo construyen la URL absoluta.

- [ ] **Step 1: `src/services/reportes.service.ts`**

```typescript
// src/services/reportes.service.ts
import { apiUrl, request } from '../lib/http'

// Forma REAL de GET /reportes/resumen (apps/api/src/reportes/reportes.service.ts
// -> resumen(), líneas 225-236). @comite/shared NO exporta un ResumenReporte, así
// que se define acá contra la forma del backend (misma que
// apps/web/src/services/reportes.service.ts). tiemposAtencion se incluye por
// fidelidad aunque la pantalla de Reportes no lo consuma.
export interface CargaEvaluador {
  evaluadorId: number
  nombre: string | null
  totalEvaluaciones: number
}
export interface ResultadoEmitido {
  tipo: string
  total: number
}
export interface TiempoAtencion {
  expedienteId: number
  codigo: string | null
  dias: number
  estado: string
}
export interface ResumenReporte {
  fechaGeneracion: string
  expedientes: { total: number; porEstado: Record<string, number> }
  evaluadores: { totalEvaluadores: number; cargaPromedio: number; cargaMaxima: number }
  tiemposAtencion: TiempoAtencion[]
  cargaEvaluadores: CargaEvaluador[]
  resultados: ResultadoEmitido[]
}

// GET /reportes/resumen -- solo administrador/coordinador/secretaria (RolesGuard
// en el backend). Agrega todo lo que la pantalla de Reportes necesita en una
// sola llamada.
export function resumen(): Promise<ResumenReporte> {
  return request<ResumenReporte>('/reportes/resumen')
}

// Helpers de URL absoluta para abrirDocumento (documentDownload.ts): los
// endpoints de exportación devuelven un PDF real (Content-Disposition
// attachment) igual que los documentos del evaluador/secretaría, así que se
// descargan y abren con el mismo mecanismo (share sheet), sin plumbing nuevo.
export function urlExportar(tipo: 'expedientes' | 'evaluaciones'): string {
  return apiUrl(`/reportes/exportar?tipo=${tipo}`)
}
export function urlExportarReporte(): string {
  return apiUrl('/reportes/exportar-reporte')
}
```

- [ ] **Step 2: Agregar el barrel en `src/services/index.ts`**

Agregar esta línea al final del archivo (dejando el resto intacto):

```typescript
export * as reportesService from './reportes.service'
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck -w @comite/mobile
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/services/reportes.service.ts apps/mobile/src/services/index.ts
git commit -m "feat(mobile): reportes.service (resumen + helpers de URL de exportación) con tipo ResumenReporte real"
```

---

### Task 6: Componentes de gráfico nativos (`HBarChart`/`StackedHBarChart`) + matemática de ancho pura testeada

**Files:**
- Create: `apps/mobile/src/lib/chartBars.ts`
- Create: `apps/mobile/src/lib/__tests__/chartBars.test.ts`
- Create: `apps/mobile/src/components/charts/HBarChart.tsx`
- Create: `apps/mobile/src/components/charts/StackedHBarChart.tsx`

**Interfaces:**
- Consumes: `colors` de `../../lib/theme`; `anchoBarra`/`maximoValor`/`porcentajeSegmento`/`totalValores` de `../../lib/chartBars`.
- Produces:
  - `chartBars.ts`: `anchoBarra(valor, maximo)`, `maximoValor(valores)`, `porcentajeSegmento(valor, total)`, `totalValores(valores)`.
  - `HBarChart.tsx`: `export interface HBarDatum { key; label; value; color }` + componente por defecto (barras horizontales nativas).
  - `StackedHBarChart.tsx`: `export interface StackedDatum { key; label; value; color }` + componente por defecto (barra apilada + leyenda).

Nota: puerto fiel de `apps/web/src/components/charts/HBarChart.tsx` y `StackedHBarChart.tsx`. La única lógica no trivial es el mapeo valor→% (HBar: `Math.max(2, round(value/max*100))` con `max=Math.max(1,...)`; Stacked: `value/total*100`), extraída a `chartBars.ts` con test. Sin librería de charts, sin tooltip de hover (en táctil el valor va a la derecha en HBar y en la leyenda en Stacked). Los colores llegan ya resueltos a hex desde el caller (Task 7), porque RN no soporta `var(--...)`.

Nota TS (anchos porcentuales): en RN 0.81 `width` es `DimensionValue`, que admite el template `` `${number}%` ``. Escribir `width: \`${anchoBarra(...)}%\`` typechea porque `anchoBarra` devuelve `number`. Si `tsc` se quejara del tipo del template, importar `DimensionValue` de `react-native` y castear el objeto de estilo — no debería hacer falta.

- [ ] **Step 1: `src/lib/chartBars.ts`**

```typescript
// src/lib/chartBars.ts
// Cálculo puro de anchos/porcentajes para las barras nativas de Reportes
// (equivalente a la matemática de HBarChart/StackedHBarChart de la web). Se
// extrae y testea porque el mapeo valor->% es la única lógica no trivial del
// port a <View>s nativos.

// HBarChart: cada barra se escala contra el máximo del set, con piso de 2% para
// que un valor > 0 siempre sea visible. Calcado de la web:
// Math.max(2, Math.round(value / max * 100)), con max = Math.max(1, ...valores).
export function maximoValor(valores: number[]): number {
  return Math.max(1, ...valores)
}
export function anchoBarra(valor: number, maximo: number): number {
  const max = Math.max(1, maximo)
  return Math.max(2, Math.round((valor / max) * 100))
}

// StackedHBarChart: cada segmento es su proporción del total (value/total*100).
// El caller solo pinta segmentos con value > 0 (con minWidth para visibilidad).
export function totalValores(valores: number[]): number {
  return valores.reduce((acc, v) => acc + v, 0)
}
export function porcentajeSegmento(valor: number, total: number): number {
  if (total <= 0) return 0
  return (valor / total) * 100
}
```

- [ ] **Step 2: `src/lib/__tests__/chartBars.test.ts`**

```typescript
// src/lib/__tests__/chartBars.test.ts
import { anchoBarra, maximoValor, porcentajeSegmento, totalValores } from '../chartBars'

describe('chartBars', () => {
  it('anchoBarra escala contra el máximo con piso de 2%', () => {
    expect(anchoBarra(10, 10)).toBe(100)
    expect(anchoBarra(5, 10)).toBe(50)
    expect(anchoBarra(1, 100)).toBe(2) // round(1) = 1 -> piso 2
    expect(anchoBarra(0, 5)).toBe(2)   // valor 0 -> piso 2
  })
  it('maximoValor nunca baja de 1 (evita división por 0)', () => {
    expect(maximoValor([1, 4, 2])).toBe(4)
    expect(maximoValor([])).toBe(1)
    expect(maximoValor([0, 0])).toBe(1)
  })
  it('porcentajeSegmento es la proporción del total; 0 si total <= 0', () => {
    expect(porcentajeSegmento(1, 4)).toBe(25)
    expect(porcentajeSegmento(3, 4)).toBe(75)
    expect(porcentajeSegmento(2, 0)).toBe(0)
  })
  it('totalValores suma la lista', () => {
    expect(totalValores([1, 2, 3])).toBe(6)
    expect(totalValores([])).toBe(0)
  })
})
```

- [ ] **Step 3: `src/components/charts/HBarChart.tsx`**

```tsx
// src/components/charts/HBarChart.tsx
import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../../lib/theme'
import { anchoBarra, maximoValor } from '../../lib/chartBars'

export interface HBarDatum {
  key: string
  label: string
  value: number
  color: string
}

// Puerto nativo de apps/web/src/components/charts/HBarChart.tsx: una fila por
// categoría (etiqueta + barra proporcional con <View> + valor a la derecha). Sin
// librería de charts, sin tooltip de hover (en táctil el valor se muestra
// siempre). El ancho sale de anchoBarra() (misma matemática que la web).
export default function HBarChart({ data }: { data: HBarDatum[] }) {
  if (data.length === 0) {
    return <Text style={s.vacio}>Sin datos por el momento.</Text>
  }
  const max = maximoValor(data.map(d => d.value))
  return (
    <View style={{ gap: 10 }}>
      {data.map(d => (
        <View key={d.key} style={s.fila}>
          <Text numberOfLines={1} style={s.label}>{d.label}</Text>
          <View style={s.track}>
            <View style={{ height: '100%', width: `${anchoBarra(d.value, max)}%`, backgroundColor: d.color, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
          </View>
          <Text style={s.valor}>{d.value}</Text>
        </View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { width: 96, fontSize: 12, fontWeight: '600', color: colors.slate700 },
  track: { flex: 1, height: 14, backgroundColor: colors.lineSoft, borderRadius: 4, overflow: 'hidden' },
  valor: { width: 30, textAlign: 'right', fontSize: 12.5, fontWeight: '700', color: colors.ink },
  vacio: { fontSize: 13, color: colors.slate500 },
})
```

- [ ] **Step 4: `src/components/charts/StackedHBarChart.tsx`**

```tsx
// src/components/charts/StackedHBarChart.tsx
import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../../lib/theme'
import { porcentajeSegmento, totalValores } from '../../lib/chartBars'

export interface StackedDatum {
  key: string
  label: string
  value: number
  color: string
}

// Puerto nativo de apps/web/src/components/charts/StackedHBarChart.tsx: una sola
// barra dividida en segmentos proporcionales + leyenda debajo. Sin librería, sin
// tooltip (el valor va en la leyenda). Los segmentos se separan por un gap de 2px
// que deja ver el fondo blanco de la barra (igual que la web).
export default function StackedHBarChart({ data }: { data: StackedDatum[] }) {
  const total = totalValores(data.map(d => d.value))
  if (total === 0) {
    return <Text style={s.vacio}>Aún no hay evaluaciones completas.</Text>
  }
  return (
    <View style={{ gap: 14 }}>
      <View style={s.barra}>
        {data.filter(d => d.value > 0).map(d => (
          <View key={d.key} style={{ width: `${porcentajeSegmento(d.value, total)}%`, backgroundColor: d.color, minWidth: 3 }} />
        ))}
      </View>
      <View style={s.leyenda}>
        {data.map(d => (
          <View key={d.key} style={s.item}>
            <View style={[s.punto, { backgroundColor: d.color }]} />
            <Text style={s.itemLabel}>{d.label}</Text>
            <Text style={s.itemValor}>{d.value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  barra: { flexDirection: 'row', height: 22, borderRadius: 6, overflow: 'hidden', gap: 2, backgroundColor: colors.white },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  punto: { width: 10, height: 10, borderRadius: 3 },
  itemLabel: { fontSize: 12.5, color: colors.slate700 },
  itemValor: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  vacio: { fontSize: 13, color: colors.slate500 },
})
```

- [ ] **Step 5: Test + typecheck**

```bash
npm test -w @comite/mobile
npm run typecheck -w @comite/mobile
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/chartBars.ts apps/mobile/src/lib/__tests__/chartBars.test.ts "apps/mobile/src/components/charts"
git commit -m "feat(mobile): HBarChart/StackedHBarChart nativos (<View> proporcionales) + chartBars puro + test"
```

---

### Task 7: Pantalla de Reportes — 4 KPI + 2 barras horizontales + 1 barra apilada + 3 exportaciones PDF

**Files:**
- Modify: `apps/mobile/app/(administrador)/reportes.tsx` (reemplaza el placeholder)

**Interfaces:**
- Consumes: `reportesService.resumen/urlExportar/urlExportarReporte` (Task 5); `HBarChart`/`HBarDatum` y `StackedHBarChart`/`StackedDatum` (Task 6); `ESTADO_LABEL` de `../../src/lib/mappers`; `abrirDocumento` de `../../src/lib/documentDownload`; `ApiError`; `useSafeAreaInsets`; `ResumenReporte` de `../../src/services/reportes.service`; primitivos UI.
- Produces: pantalla Reportes con header custom (`useSafeAreaInsets`), cuerpo en `Screen`, carga `resumen()` con `useEffect` mount + flag. 4 tarjetas KPI (Expedientes totales / Evaluadores / Carga promedio / Carga máxima), `HBarChart` "Expedientes por estado", `HBarChart` "Carga por evaluador", `StackedHBarChart` "Resultados emitidos", y 3 botones de exportación PDF vía `abrirDocumento` (por-botón: estado de carga individual).

Nota: calca `apps/web/src/pages/Reportes.tsx` (el admin pasa `scopeLabel="Administrador"` en la web; en móvil el header ya dice "Administración"). Las mismas transformaciones de datos: `datosPorEstado` filtra `total>0` y ordena desc; `datosCarga` ordena desc; `carga promedio` se redondea a 1 decimal. Los colores `var(--...)` se traducen a hex de `theme` en un `ESTADO_COLOR` local. La exportación reemplaza el `descargarBlob` de la web por `abrirDocumento(url, nombre)` (share sheet). Es una lectura de una sola vez → `useEffect` mount, no `useFocusEffect`.

- [ ] **Step 1: Reemplazar `app/(administrador)/reportes.tsx`**

```tsx
// app/(administrador)/reportes.tsx
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, ErrorText, Loading, Screen } from '../../src/components/ui'
import HBarChart, { type HBarDatum } from '../../src/components/charts/HBarChart'
import StackedHBarChart, { type StackedDatum } from '../../src/components/charts/StackedHBarChart'
import { colors } from '../../src/lib/theme'
import { ESTADO_LABEL } from '../../src/lib/mappers'
import { ApiError } from '../../src/lib/http'
import { abrirDocumento } from '../../src/lib/documentDownload'
import { reportesService } from '../../src/services'
import type { ResumenReporte } from '../../src/services/reportes.service'

function estadoLabel(estado: string) {
  return ESTADO_LABEL[estado as keyof typeof ESTADO_LABEL] ?? estado
}

// Colores hex reales (RN no soporta var(--...) del CSS web). Alineados con
// theme/badgeColors para que el gráfico hable el mismo idioma visual que las
// badges de estado del resto de la app.
const ESTADO_COLOR: Record<string, string> = {
  borrador: colors.slate400,
  enviado: colors.primary,
  en_revision: colors.primary,
  subsanacion: colors.warn,
  aprobado: colors.success,
  aprobado_observaciones: colors.warn,
  no_aprobado: colors.danger,
  archivado: colors.slate400,
}

export default function ReportesAdmin() {
  const insets = useSafeAreaInsets()
  const [resumen, setResumen] = useState<ResumenReporte | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [errorExport, setErrorExport] = useState('')
  const [exportando, setExportando] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    reportesService
      .resumen()
      .then(r => { if (!cancelado) setResumen(r) })
      .catch(e => { if (!cancelado) setError(e instanceof ApiError ? e.message : 'No se pudo cargar el reporte.') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [])

  const exportar = useCallback(async (clave: string, url: string, nombre: string) => {
    setErrorExport('')
    setExportando(clave)
    try {
      // Reutiliza documentDownload.ts (Fase 4): descarga autenticada + share
      // sheet nativo -- mismo camino que los PDFs de rúbrica/dictamen.
      await abrirDocumento(url, nombre)
    } catch (e) {
      setErrorExport(e instanceof Error ? e.message : 'No se pudo exportar.')
    } finally {
      setExportando(null)
    }
  }, [])

  const metricas = resumen
    ? [
        { n: resumen.expedientes.total, label: 'Expedientes totales', color: colors.primary },
        { n: resumen.evaluadores.totalEvaluadores, label: 'Evaluadores', color: colors.navy },
        { n: Math.round(resumen.evaluadores.cargaPromedio * 10) / 10, label: 'Carga promedio', color: colors.warn },
        { n: resumen.evaluadores.cargaMaxima, label: 'Carga máxima', color: colors.success },
      ]
    : []

  const datosPorEstado: HBarDatum[] = resumen
    ? Object.entries(resumen.expedientes.porEstado)
        .filter(([, total]) => total > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([estado, total]) => ({ key: estado, label: estadoLabel(estado), value: total, color: ESTADO_COLOR[estado] ?? colors.slate400 }))
    : []

  const datosCarga: HBarDatum[] = resumen
    ? [...resumen.cargaEvaluadores]
        .sort((a, b) => b.totalEvaluaciones - a.totalEvaluaciones)
        .map(c => ({ key: String(c.evaluadorId), label: c.nombre ?? `Evaluador #${c.evaluadorId}`, value: c.totalEvaluaciones, color: colors.primary }))
    : []

  const datosResultados: StackedDatum[] = resumen
    ? resumen.resultados.map(r => ({ key: r.tipo, label: estadoLabel(r.tipo), value: r.total, color: ESTADO_COLOR[r.tipo] ?? colors.slate400 }))
    : []

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.headerKicker}>Administración</Text>
        <Text style={s.headerTitle}>Reportes</Text>
      </View>

      <Screen>
        {!!error && <ErrorText>{error}</ErrorText>}
        {cargando && <Loading label="Cargando reporte…" />}

        {resumen && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
              {metricas.map(m => (
                <Card key={m.label} style={{ flexBasis: '47%', flexGrow: 1, alignItems: 'center', paddingVertical: 12 }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: m.color }}>{m.n}</Text>
                  <Text style={{ fontSize: 11.5, color: colors.slate500, textAlign: 'center' }}>{m.label}</Text>
                </Card>
              ))}
            </View>

            <Card style={{ gap: 12 }}>
              <Text style={s.tituloGrafico}>Expedientes por estado</Text>
              <HBarChart data={datosPorEstado} />
            </Card>

            <Card style={{ gap: 12 }}>
              <Text style={s.tituloGrafico}>Carga por evaluador</Text>
              <HBarChart data={datosCarga} />
            </Card>

            <Card style={{ gap: 12 }}>
              <Text style={s.tituloGrafico}>Resultados emitidos</Text>
              <StackedHBarChart data={datosResultados} />
            </Card>

            <Card style={{ gap: 10 }}>
              <Text style={s.tituloGrafico}>Exportar</Text>
              <Button
                title={exportando === 'expedientes' ? 'Descargando…' : 'Expedientes (PDF)'}
                variant="outline"
                loading={exportando === 'expedientes'}
                onPress={() => exportar('expedientes', reportesService.urlExportar('expedientes'), 'expedientes.pdf')}
              />
              <Button
                title={exportando === 'evaluaciones' ? 'Descargando…' : 'Evaluaciones (PDF)'}
                variant="outline"
                loading={exportando === 'evaluaciones'}
                onPress={() => exportar('evaluaciones', reportesService.urlExportar('evaluaciones'), 'evaluaciones.pdf')}
              />
              <Button
                title={exportando === 'reporte' ? 'Descargando…' : 'Reporte con gráficos (PDF)'}
                variant="outline"
                loading={exportando === 'reporte'}
                onPress={() => exportar('reporte', reportesService.urlExportarReporte(), 'reporte-gestion.pdf')}
              />
              {!!errorExport && <ErrorText>{errorExport}</ErrorText>}
            </Card>
          </>
        )}
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  headerKicker: { fontSize: 12.5, color: colors.slate500 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  tituloGrafico: { fontSize: 13, fontWeight: '700', color: colors.navy },
})
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck -w @comite/mobile
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(mobile): pantalla Reportes del admin (4 KPI + 2 HBar + 1 apilada + exportación PDF vía documentDownload)"
```

---

### Task 8: Verificación final — typecheck/test de todo el monorepo, README y E2E en Android (cierre del proyecto móvil)

**Files:**
- Modify: `apps/mobile/README.md` (si existe — documentar el 5º grupo / los 7 roles cubiertos)

**Interfaces:**
- Consumes: todo lo construido en Fases 3-7.
- Produces: confirmación de que la app móvil cubre los 7 roles con navegación coherente entre los 5 grupos de rutas y ningún rol queda sin hogar.

Nota: esta es la última fase del proyecto móvil. La verificación no es solo del rol Administrador sino del sistema completo de navegación por roles.

- [ ] **Step 1: Typecheck + tests de todo el workspace**

```bash
npm run build -w @comite/shared
npm run typecheck -w @comite/mobile
npm test -w @comite/mobile
# Sanidad del resto del monorepo (nada de lo tocado debería afectarlo, pero se confirma):
npm run typecheck -w @comite/web
npm run typecheck -w @comite/api
```

- [ ] **Step 2: Actualizar el README del móvil (si existe)**

Leer `apps/mobile/README.md` y actualizar la sección de grupos/roles para reflejar que existe el grupo `(administrador)/` (4 pestañas: Usuarios/Config/Reportes/Perfil) y que **los 7 roles del sistema ya tienen su grupo de rutas** (proyecto móvil completo). Si no existe un README con esa sección, omitir este paso (no crear documentación nueva sin necesidad).

- [ ] **Step 3: Checklist manual E2E en Android real (`admin@uch.edu.pe`)**

```text
# Login como administrador:
- [ ] Login con admin@uch.edu.pe aterriza en el grupo (administrador) con 4
      pestañas (Usuarios/Config/Reportes/Perfil); pestaña por defecto = Usuarios.

# Usuarios:
- [ ] La lista carga; el contador "N de M" es correcto.
- [ ] Búsqueda por nombre/correo filtra; filtro de rol (píldoras dinámicas) y de
      estado (Todos/Activos/Inactivos) filtran; "Limpiar" resetea.
- [ ] "+ Crear" abre el formulario; validaciones: campos requeridos, password ≥8,
      especialidad requerida si rol = evaluador. Crear un evaluador con
      especialidad+carga funciona; crear un coordinador (sin campos de evaluador)
      funciona. La lista se refresca sola tras crear (useFocusEffect).
- [ ] "Editar" en una fila permite cambiar rol (píldoras) y togglear "Cuenta
      activa"; "Guardar" persiste y refresca; "Cancelar" descarta.
- [ ] "Desactivar" pide confirmación y desactiva (badge pasa a Inactivo).
- [ ] "Eliminar" solo aparece en roles internos; pide confirmación con la
      advertencia; elimina si el backend lo permite (o muestra el error del
      backend si la cuenta tiene evaluaciones/mensajes).
- [ ] Sobre la PROPIA cuenta: "Desactivar" y "Eliminar" están deshabilitados
      (gris) y no ejecutan nada.

# Configuración:
- [ ] Muestra la fecha límite actual (o "sin configurar").
- [ ] Guardar con formato inválido muestra el error de formato; con AAAA-MM-DD
      válido guarda y muestra mensaje de éxito.
- [ ] "Quitar" pide confirmación y limpia la fecha límite.

# Reportes:
- [ ] Las 4 tarjetas KPI muestran números coherentes.
- [ ] "Expedientes por estado" y "Carga por evaluador" muestran barras nativas
      proporcionales; "Resultados emitidos" muestra la barra apilada + leyenda.
- [ ] Los 3 botones de exportar descargan un PDF y abren el share sheet nativo
      (verificar los 3: expedientes, evaluaciones, reporte con gráficos).

# Perfil:
- [ ] Muestra nombre/rol (Administrador), stats de rol interno y "Cerrar sesión"
      funciona (vuelve a /login).

# Regresión de TODOS los roles (cierre del proyecto: navegación de los 5 grupos):
- [ ] Solicitante -> (app); Secretaría -> (secretaria); Coordinador ->
      (coordinador); Evaluador -> (evaluador); Administrador -> (administrador).
- [ ] Ningún rol cae en /rol-no-disponible; no hay loops de redirección entre
      grupos; cada rol queda estable en su grupo tras login.
```

- [ ] **Step 4: Commit final (solo si el README se modificó)**

```bash
git commit -am "docs(mobile): README refleja el grupo (administrador) y el cierre del proyecto móvil (7 roles)"
```

---

## Self-review

Re-leí el spec sección por sección y verifiqué el mapeo a tareas:

- **Alcance (4 pantallas):** Usuarios → Task 4; Configuración → Task 2; Reportes → Task 7 (+ servicio Task 5, charts Task 6); Perfil → Task 1 (wrapper real, `PerfilScreen` sin tocar). ✅
- **Arquitectura (grupo nuevo + `homeGroupForRole` final):** Task 1 (roles.ts + test + layout 4 tabs + placeholders + perfil). El fallback `/rol-no-disponible` queda inalcanzable pero conservado, con comentario. ✅
- **Fuera de alcance:** no se portan bandeja/chat de admin ni los endpoints `/reportes/*` no usados; Reportes solo consume `GET /reportes/resumen`. ✅
- **Consistencia de tipos:** `ResumenReporte` se define UNA vez en `reportes.service.ts` (Task 5) contra la forma real del backend (`apps/api/.../reportes.service.ts:225-236`, idéntica a la web), y es la que consumen la pantalla de Reportes (Task 7) y —vía `HBarDatum`/`StackedDatum`— los componentes de gráfico (Task 6). Los `HBarDatum`/`StackedDatum` se definen en sus componentes y se importan en la pantalla. `UserDto`/`FechaLimiteDto`/`RolBackend` salen de `@comite/shared` vía `types/api`. `ROL_LABEL` de `data/types`. Sin placeholders sin resolver. ✅
- **Firmas de servicios confirmadas contra el código real:** `usersService.{list,create,update,deactivate,eliminarPermanente}` y `configService.{getFechaLimite,setFechaLimite}` existen con las firmas usadas (leídos en `apps/mobile/src/services/*`); `CreateUserPayload`/`UpdateUserPayload` calzan con los payloads del formulario. `apiUrl` existe en `http.ts`. `abrirDocumento(url, nombre)` existe en `documentDownload.ts`. ✅
- **Right-sizing:** 8 tareas. Usuarios NO se partió en dos escrituras de archivo completo (habría duplicado ~250 líneas); en su lugar se extrajo el filtro puro como Task 3 propia y la pantalla se escribe una sola vez en Task 4 — mejor ingeniería y menos duplicación que el patrón parcial-luego-completo de Fase 6, cumpliendo igual el espíritu de "separar la complejidad". Reportes se dividió en servicio (5) + charts (6) + pantalla (7). Es la única desviación respecto al breakdown sugerido, y es a favor de menos duplicación.

Confirmación explícita de los 6 checks pedidos:
- **(a) NO se agrega dependencia de charts:** los gráficos son `<View>` nativos (`HBarChart`/`StackedHBarChart`, Task 6); `package.json` no cambia. ✅
- **(b) Fecha límite con `Input` enmascarado AAAA-MM-DD, no date picker:** Task 2 usa `Input` + regex `/^\d{4}-\d{2}-\d{2}$/` + `maxLength={10}`; no se agrega `datetimepicker`. ✅
- **(c) `users.service.ts`/`config.service.ts` sin tocar:** no aparecen en ningún bloque `Modify`; solo se crea `reportes.service.ts` y se agrega su línea al barrel. ✅
- **(d) `PerfilScreen.tsx` sin tocar:** no aparece en ningún `Modify`; el admin cae en su rama de rol interno existente (verificado leyendo el archivo: `!esSolicitante && !esEvaluador`). ✅
- **(e) `useFocusEffect` + `useSafeAreaInsets` + `Screen`:** Usuarios usa `useFocusEffect` (Task 4); Usuarios/Config/Reportes usan `useSafeAreaInsets` en su header custom y `Screen` como cuerpo. Config/Reportes son lecturas de una sola vez → `useEffect` mount con flag (correcto, no son listas que se ensucien). ✅
- **(f) Auto-desactivación/auto-eliminación bloqueadas + eliminar permanente solo roles internos:** Task 4 deshabilita ambos botones sobre `u.id === usuario?.id` y corta en el handler; "Eliminar" solo se renderiza si `ROLES_INTERNOS.includes(u.rol)`. ✅

Riesgos anotados para el controlador (ver también "Riesgos" del spec):
1. **Exportación PDF vía `abrirDocumento`:** los endpoints `/reportes/exportar*` devuelven el PDF como buffer directo con `Content-Disposition: attachment` (confirmado en `reportes.controller.ts:94-102`), así que `downloadAsync` recibirá `status 200` y un archivo válido — mismo camino que rúbrica/dictamen. Verificar en E2E que el share sheet abre los 3 PDFs.
2. **Anchos porcentuales en RN/TS:** `width: \`${n}%\`` debería typechear contra `DimensionValue` en RN 0.81; si `tsc` se quejara, castear con `DimensionValue` (nota incluida en Task 6). Riesgo bajo, contenido en una sola tarea.
3. **`keyboardType` en Configuración:** se dejó sin `keyboardType` numérico para no complicar el tipeo del guion en Android; el teclado por defecto permite AAAA-MM-DD. Si en E2E el tipeo resulta incómodo, es un ajuste cosmético menor.
