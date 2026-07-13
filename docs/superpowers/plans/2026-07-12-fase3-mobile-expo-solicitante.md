# App Móvil Expo (Rol Solicitante) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `apps/mobile/`, una app Expo (React Native, solo Android, managed workflow) dentro del monorepo Turborepo existente que porta 1:1 las pantallas del rol Solicitante/Investigador de `apps/web`, consumiendo la misma API NestJS y compartiendo `@comite/shared` sin modificarlo.

**Architecture:** App Expo con Expo Router (file-based routing), token de sesión en `expo-secure-store`, capa de servicios/`lib`/`state` calcada de `apps/web/src` (misma responsabilidad, implementación RN en lugar de DOM), UI propia con `StyleSheet` (sin librería de UI). Un grupo de rutas protegido `(app)/` monta un guard de sesión + tab bar; las rutas públicas (login, registro, recuperar, acerca) viven en la raíz de `app/`. El fetch wrapper y los mappers son idénticos en lógica al web, solo cambia `localStorage`→`SecureStore` (async) y se elimina el manejo de `Blob`/`FormData` de DOM.

**Tech Stack:** Expo SDK 52 (React Native 0.76, React 18.3), Expo Router 4, TypeScript 5.7, `expo-secure-store`, Jest + `jest-expo` + `@testing-library/react-native`, `@comite/shared` (workspace), Turborepo, npm workspaces.

## Global Constraints

- Solo rol Solicitante/Investigador: sub-roles auto-registrables `estudiante_pregrado`, `estudiante_postgrado`, `investigador` (comparten vista). NO implementar Secretaría, Coordinador, Evaluador, Admin.
- Solo Android (Expo managed workflow, sin código nativo custom, sin iOS).
- `@comite/shared` se reutiliza tal cual: NUNCA modificar `packages/shared/`. Importar tipos/constantes/utils desde `@comite/shared`.
- `apps/web` y `apps/api` NO se tocan en ningún paso.
- Sin librerías de UI (ni Paper, ni Tamagui, ni NativeWind): solo `View`/`Text`/`TextInput`/`Pressable`/`ScrollView`/`FlatList`/`Modal`/`ActivityIndicator` de React Native + `StyleSheet`.
- Sin axios, sin react-query: fetch nativo con el wrapper propio adaptado de `apps/web/src/lib/http.ts`.
- Endpoints, nombres de funciones de servicio, firmas de payloads y tipos DTO deben coincidir EXACTAMENTE con `apps/web/src/services/*` y `@comite/shared` (el backend real ya está desplegado).
- Paleta de colores portada de `apps/web/src/styles/global.css` (`:root`): `navy #08204a`, `primary #0b57b7`, etc. — centralizada en `src/lib/theme.ts`.
- `expo-secure-store` es asíncrono: `getToken()` retorna `Promise<string | null>` (a diferencia del web síncrono). Todo el código que consume el token debe usar `await`.
- Subida real de documentos con cámara/galería está FUERA DE ALCANCE: `registrarDocumento`/`uploadDocumento` se dejan definidos en el servicio (firma lista) pero las pantallas que suben archivos muestran la UI de checklist en modo lectura/pendiente sin abrir picker nativo (se marca con un `// TODO Fase posterior: expo-document-picker`).
- El nombre del paquete es `@comite/mobile`. La variable de entorno de la API es `EXPO_PUBLIC_API_URL` (convención Expo para exponerla al bundle).
- Cada bloque de pantallas termina con una tarea de verificación manual en emulador/dispositivo Android (Expo Go) contra la API real.

---

### Task 1: Scaffold del proyecto Expo e integración en el monorepo

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/metro.config.js`
- Create: `apps/mobile/.gitignore`
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/index.tsx`
- Create: `apps/mobile/assets/icon.png` (copiar desde `apps/web/public/uch.png` si existe, o placeholder)
- Modify: `apps/mobile/` no requiere tocar `turbo.json` (las tasks `dev`/`build`/`lint`/`typecheck` ya son genéricas y aplican por workspace)

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces: proyecto Expo arrancable con `npm run dev -w @comite/mobile`; alias TS `@/*` → `apps/mobile/src/*`; workspace `@comite/mobile` reconocido por npm.

- [ ] **Step 1: Crear `apps/mobile/package.json` con dependencias Expo SDK 52 y el workspace `@comite/shared` (2-5 min)**

```json
{
  "name": "@comite/mobile",
  "version": "0.1.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "android": "expo start --android",
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "lint": "expo lint",
    "test": "jest --passWithNoTests"
  },
  "dependencies": {
    "@comite/shared": "*",
    "expo": "~52.0.0",
    "expo-constants": "~17.0.0",
    "expo-linking": "~7.0.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.5",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.4.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@testing-library/react-native": "^12.9.0",
    "@types/jest": "^29.5.14",
    "@types/react": "~18.3.12",
    "jest": "^29.7.0",
    "jest-expo": "~52.0.0",
    "typescript": "^5.7.3"
  }
}
```

- [ ] **Step 2: Crear `apps/mobile/app.json` (config Expo, solo Android, plugin expo-router + secure-store) (2-5 min)**

```json
{
  "expo": {
    "name": "Comité de Ética UCH",
    "slug": "comite-etica-uch",
    "version": "0.1.0",
    "orientation": "portrait",
    "scheme": "comiteuch",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "icon": "./assets/icon.png",
    "splash": {
      "resizeMode": "contain",
      "backgroundColor": "#08204a"
    },
    "android": {
      "package": "pe.edu.uch.comite",
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon.png",
        "backgroundColor": "#08204a"
      }
    },
    "plugins": [
      "expo-router",
      "expo-secure-store"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 3: Crear `apps/mobile/tsconfig.json` (extiende expo/tsconfig.base, alias `@/*`) (2-5 min)**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 4: Crear `apps/mobile/babel.config.js` y `apps/mobile/metro.config.js` (Metro debe resolver el workspace raíz para `@comite/shared`) (2-5 min)**

```javascript
// babel.config.js
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
  }
}
```

```javascript
// metro.config.js — permite a Metro seguir symlinks de node_modules del monorepo
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)
config.watchFolders = [monorepoRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = false

module.exports = config
```

- [ ] **Step 5: Crear `apps/mobile/.gitignore` (2 min)**

```
node_modules/
.expo/
dist/
*.tsbuildinfo
expo-env.d.ts
.DS_Store
```

- [ ] **Step 6: Crear layout raíz mínimo y una pantalla index temporal para verificar arranque (2-5 min)**

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}
```

```tsx
// app/index.tsx (temporal — se reemplaza por la redirección real en Task 9)
import { Text, View } from 'react-native'

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Comité de Ética UCH — scaffold OK</Text>
    </View>
  )
}
```

- [ ] **Step 7: Instalar dependencias desde la raíz del monorepo y verificar que Expo arranca (2-5 min)**

```bash
# desde la raíz del monorepo
npm install
npm run build -w @comite/shared   # @comite/mobile consume el dist compilado
npm run typecheck -w @comite/mobile
# Verificación de arranque (manual, no bloquea el commit):
#   npm run dev -w @comite/mobile   -> abrir en Expo Go (Android) y ver "scaffold OK"
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/tsconfig.json apps/mobile/babel.config.js apps/mobile/metro.config.js apps/mobile/.gitignore apps/mobile/app/_layout.tsx apps/mobile/app/index.tsx apps/mobile/assets package-lock.json
git commit -m "feat(mobile): scaffold Expo app e integración en monorepo"
```

---

### Task 2: Capa base — theme, http (SecureStore), dates, mappers, documentFormats

**Files:**
- Create: `apps/mobile/src/lib/theme.ts`
- Create: `apps/mobile/src/lib/http.ts`
- Create: `apps/mobile/src/lib/dates.ts`
- Create: `apps/mobile/src/lib/mappers.ts`
- Create: `apps/mobile/src/lib/documentFormats.ts`
- Create: `apps/mobile/src/types/api.ts`
- Create: `apps/mobile/src/data/types.ts`
- Test: `apps/mobile/src/lib/__tests__/mappers.test.ts`
- Test: `apps/mobile/src/lib/__tests__/documentFormats.test.ts`

**Interfaces:**
- Consumes: `@comite/shared` (`formatearFecha`, `formatearFechaHora`, `fechaLocalISO`, tipos DTO, constantes de roles).
- Produces:
  - `theme.ts`: `export const colors` (navy, primary, accent, blue50, blue100, bg, ink, slate700, slate500, slate400, line, lineSoft, success, successBg, warn, warnBg, danger, dangerBg, chipBg) y `export const badgeColors: Record<EstadoExpediente, {bg,fg}>`.
  - `http.ts`: `getToken(): Promise<string|null>`, `setToken(t: string): Promise<void>`, `clearToken(): Promise<void>`, `ApiError`, `setUnauthorizedHandler(fn)`, `request<T>(path, options?): Promise<T>`, `apiUrl(path)`, `plantillaUrl(key, modo?)`, `uploadDocumento<T>(path, {uri,name,type}, fields?): Promise<T>` (firma lista, sin picker).
  - `dates.ts`: re-export de `formatearFecha`, `formatearFechaHora`, `fechaLocalISO`.
  - `mappers.ts`: `toDomainUser`, `toDomainNotificacion`, `toDomainProyecto`, `ESTADO_LABEL`.
  - `documentFormats.ts`: `MAX_SIZE_MB`, `formatoDocumento`, `validarDocumento`.
  - `types/api.ts`, `data/types.ts`: idénticos al web.

- [ ] **Step 1: `src/types/api.ts` y `src/data/types.ts` (copia exacta del web — TS puro, 100% portable) (2-5 min)**

Copiar textualmente `apps/web/src/types/api.ts` (re-export de tipos de `@comite/shared`) y `apps/web/src/data/types.ts` (dominio `Proyecto`/`Usuario`/`Notificacion`/`Autor`/`DocumentoRequisito` + re-exports de `ROLES_SOLICITANTE`, `ROLES_AUTO_REGISTRO`, `ROL_LABEL`, `homePathForRole`). Sin cambios: no usan DOM.

```typescript
// src/types/api.ts
export type {
  RolBackend, EstadoExpediente, UserDto, LoginResponse, AutorExpedienteDto,
  ExpedienteDto, DocumentoDto, BitacoraDto, HistorialDto, PlantillaInfo,
  TipoDocumentoInfo, GuiaNombresDto, RequisitosDto, CatalogosDto,
  ElegibleCambioTituloDto, EvaluacionCriterioDto, EvaluacionDto, CriterioRubrica,
  RubricaDto, NotificacionDto, MensajeChatDto, SolicitanteChatDto,
  ConversacionChatDto, FechaLimiteDto,
} from '@comite/shared'
```

```typescript
// src/data/types.ts  (idéntico a apps/web/src/data/types.ts)
import type { RolBackend } from '@comite/shared'
import {
  ROLES_SOLICITANTE as SHARED_ROLES_SOLICITANTE,
  ROLES_AUTO_REGISTRO as SHARED_ROLES_AUTO_REGISTRO,
  ROL_LABEL as SHARED_ROL_LABEL,
  homePathForRole as sharedHomePath,
} from '@comite/shared'

export type EstadoProyecto =
  | 'borrador' | 'enviado' | 'en_revision' | 'subsanacion'
  | 'aprobado' | 'aprobado_observaciones' | 'no_aprobado' | 'archivado'

export type Rol = RolBackend

export interface DocumentoRequisito {
  id: number; nombre: string; detalle: string; cargado: boolean
  archivo?: string; tipoDocumento: string
}
export interface Observacion { id: string; seccion: string; detalle: string }
export interface Autor {
  nombre: string; rol: 'Autor' | 'Coautor'; codigo: string; correo: string; telefono: string
}
export interface Proyecto {
  id: number; codigo: string | null; titulo: string; programa: string; ciclo: string
  estado: EstadoProyecto; fechaEnvio: string | null; fechaCreacion: string
  investigadorId: number; autores: Autor[]; documentos: DocumentoRequisito[]; observaciones: Observacion[]
}
export interface Notificacion {
  id: number; titulo: string; detalle: string; codigoProyecto: string; fecha: string; leida: boolean
}
export interface Mensaje { id: number; de: 'yo' | 'secretaria'; texto: string; hora: string; autorId: number }
export interface Usuario {
  id: number; nombres: string; apellidos: string; correo: string; rol: Rol; codigo: string | null
  programa?: string; especialidad?: string | null; cargaTrabajo?: number | null; laboratorio?: string | null
}

export const ROLES_SOLICITANTE = SHARED_ROLES_SOLICITANTE
export const ROLES_AUTO_REGISTRO = SHARED_ROLES_AUTO_REGISTRO
export const ROL_LABEL = SHARED_ROL_LABEL
export const homePathForRole = sharedHomePath
```

- [ ] **Step 2: `src/lib/theme.ts` — paleta portada de global.css + colores de badge por estado (2-5 min)**

```typescript
// src/lib/theme.ts
import type { EstadoProyecto } from '../data/types'

export const colors = {
  navy: '#08204a',
  primary: '#0b57b7',
  accent: '#4c93eb',
  blue50: '#eaf5ff',
  blue100: '#cfe4fb',
  bg: '#f7f9fc',
  white: '#ffffff',
  ink: '#172033',
  slate700: '#344054',
  slate500: '#667085',
  slate400: '#98a2b3',
  line: '#d9e1ec',
  lineSoft: '#eef2f7',
  success: '#067647',
  successBg: '#ecfdf3',
  warn: '#b54708',
  warnBg: '#fef7ec',
  danger: '#d92d20',
  dangerBg: '#fef3f2',
  chipBg: '#f2f4f7',
} as const

// Colores de las badges de estado (equivalente a .badge-<estado> del CSS web).
export const badgeColors: Record<EstadoProyecto, { bg: string; fg: string }> = {
  borrador: { bg: colors.chipBg, fg: colors.slate500 },
  enviado: { bg: colors.blue50, fg: colors.primary },
  en_revision: { bg: colors.blue50, fg: colors.primary },
  subsanacion: { bg: colors.warnBg, fg: colors.warn },
  aprobado: { bg: colors.successBg, fg: colors.success },
  aprobado_observaciones: { bg: colors.successBg, fg: colors.success },
  no_aprobado: { bg: colors.dangerBg, fg: colors.danger },
  archivado: { bg: colors.chipBg, fg: colors.slate500 },
}
```

- [ ] **Step 3: `src/lib/http.ts` — fetch wrapper portado, con SecureStore async y `EXPO_PUBLIC_API_URL` (2-5 min)**

```typescript
// src/lib/http.ts
import * as SecureStore from 'expo-secure-store'

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8002').replace(/\/$/, '')

// SecureStore no permite ciertos caracteres en las keys; guion bajo es válido.
const TOKEN_KEY = 'ce_auth_token'

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}
export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

interface RequestOptions {
  method?: string
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  auth?: boolean
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(`${BASE_URL}${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data?.message === 'string') return data.message
    if (Array.isArray(data?.message)) return data.message.join(', ')
    if (typeof data?.error === 'string') return data.error
    // Endpoints de negocio (ej. POST /expedientes/:id/enviar) devuelven {mensaje, faltantes[]}
    if (typeof data?.mensaje === 'string') {
      const faltantes = Array.isArray(data?.faltantes) ? (data.faltantes as string[]) : []
      return faltantes.length > 0 ? `${data.mensaje} ${faltantes.join(', ')}` : data.mensaje
    }
  } catch {
    // respuesta sin JSON
  }
  return `Error inesperado (${res.status})`
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = options
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = await getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    await clearToken()
    onUnauthorized?.()
    throw new ApiError(401, 'Tu sesión expiró, vuelve a iniciar sesión.')
  }
  if (!res.ok) throw new ApiError(res.status, await extractErrorMessage(res))
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// Subida multipart en RN: el "file" es {uri,name,type} en vez de un Blob del DOM.
// Firma lista para cuando se integre expo-document-picker (Fase posterior).
export interface RNFile { uri: string; name: string; type: string }
export async function uploadDocumento<T>(
  path: string,
  file: RNFile,
  fields: Record<string, string> = {},
): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const formData = new FormData()
  // RN acepta este shape para multipart; TS no lo tipa, de ahí el cast.
  formData.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob)
  for (const [k, v] of Object.entries(fields)) formData.append(k, v)
  const res = await fetch(buildUrl(path), { method: 'POST', headers, body: formData })
  if (res.status === 401) {
    await clearToken()
    onUnauthorized?.()
    throw new ApiError(401, 'Tu sesión expiró, vuelve a iniciar sesión.')
  }
  if (!res.ok) throw new ApiError(res.status, await extractErrorMessage(res))
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export function apiUrl(path: string) {
  return `${BASE_URL}${path}`
}
export function plantillaUrl(key: string, modo: 'ver' | 'descargar' = 'ver') {
  return apiUrl(`/plantillas/${key}?modo=${modo}`)
}
```

- [ ] **Step 4: `src/lib/dates.ts` (re-export, idéntico al web) y `src/lib/documentFormats.ts` (copia exacta — no usa DOM salvo el tipo `File`) (2-5 min)**

`dates.ts` idéntico:
```typescript
export { formatearFecha, formatearFechaHora, fechaLocalISO } from '@comite/shared'
```

`documentFormats.ts`: copiar textual de `apps/web/src/lib/documentFormats.ts`, pero cambiar la firma de `validarDocumento` para no depender del DOM `File`. Usar un shape mínimo:
```typescript
// src/lib/documentFormats.ts (encabezado del cambio respecto al web)
export interface ArchivoValidable { name: string; type?: string; size?: number }

export function validarDocumento(file: ArchivoValidable, tipo: string): string | null {
  const formato = formatoDocumento(tipo)
  const nombre = file.name.toLowerCase()
  const extensionValida = formato.extensions.some(ext => nombre.endsWith(ext))
  if (!extensionValida) return `Formato no válido. Se espera: ${formato.label}.`
  if (file.type && !formato.mimeTypes.includes(file.type)) return `Formato no válido. Se espera: ${formato.label}.`
  if (file.size !== undefined && file.size > MAX_SIZE_BYTES) return `El archivo supera el tamaño máximo de ${MAX_SIZE_MB} MB.`
  return null
}
```
El resto de `documentFormats.ts` (`MAX_SIZE_MB`, `MAX_SIZE_BYTES`, `DOCUMENT_FORMATS`, `FORMATO_GENERICO`, `formatoDocumento`) se copia idéntico.

- [ ] **Step 5: `src/lib/mappers.ts` — copia exacta del web (no usa DOM) (2-5 min)**

Copiar textual `apps/web/src/lib/mappers.ts` (`toDomainUser`, `toDomainNotificacion`, `toDomainAutor`, `toDomainDocumento`, `toDomainProyecto`, `ESTADO_LABEL`). Imports desde `../types/api`, `../data/types`, `./dates`.

- [ ] **Step 6: Tests de mappers y documentFormats (TDD sobre la lógica portable) (2-5 min)**

```typescript
// src/lib/__tests__/mappers.test.ts
import { toDomainProyecto, toDomainUser, ESTADO_LABEL } from '../mappers'
import type { ExpedienteDto, UserDto } from '../../types/api'

describe('mappers', () => {
  it('toDomainUser mapea nombre/apellido/email a dominio', () => {
    const dto = {
      id: 1, email: 'a@uch.pe', nombre: 'Ana', apellido: 'Ruiz', rol: 'investigador',
      activo: true, especialidad: null, cargaTrabajo: null, conflictoInteres: null,
      codigoEstudiante: null, laboratorio: 'Lab A', createdAt: null, updatedAt: null,
    } as UserDto
    const u = toDomainUser(dto)
    expect(u).toMatchObject({ nombres: 'Ana', apellidos: 'Ruiz', correo: 'a@uch.pe', laboratorio: 'Lab A' })
  })

  it('toDomainProyecto usa facultad como fallback de programa y mapea autores', () => {
    const dto = {
      id: 5, codigoUnico: 'CE-001', tituloProtocolo: 'T', investigadorId: 1, facultad: 'Medicina',
      programaEstudios: null, ciclo: null, nivelPosgrado: null, estado: 'enviado',
      fechaEnvio: null, createdAt: '2026-01-01', autores: [
        { orden: 1, apellidosNombres: 'Ruiz, Ana', codigoEstudiante: null, correo: null, telefono: null, esPrincipal: true },
      ],
    } as unknown as ExpedienteDto
    const p = toDomainProyecto(dto)
    expect(p.programa).toBe('Medicina')
    expect(p.autores[0]).toMatchObject({ nombre: 'Ruiz, Ana', rol: 'Autor', codigo: '—' })
  })

  it('ESTADO_LABEL cubre los 8 estados', () => {
    expect(ESTADO_LABEL.aprobado_observaciones).toBe('Aprobado c/ observ.')
  })
})
```

```typescript
// src/lib/__tests__/documentFormats.test.ts
import { validarDocumento, MAX_SIZE_MB } from '../documentFormats'

describe('validarDocumento', () => {
  it('rechaza extensión no válida', () => {
    expect(validarDocumento({ name: 'x.txt' }, 'proyecto_pdf')).toContain('Formato no válido')
  })
  it('acepta pdf para proyecto_pdf', () => {
    expect(validarDocumento({ name: 'x.pdf', type: 'application/pdf' }, 'proyecto_pdf')).toBeNull()
  })
  it('rechaza archivo demasiado grande', () => {
    const big = (MAX_SIZE_MB + 1) * 1024 * 1024
    expect(validarDocumento({ name: 'x.pdf', type: 'application/pdf', size: big }, 'proyecto_pdf')).toContain('tamaño máximo')
  })
})
```

Agregar a `package.json` (si no está) la config de Jest:
```json
"jest": { "preset": "jest-expo" }
```

- [ ] **Step 7: Ejecutar tests y typecheck (2-5 min)**

```bash
npm run build -w @comite/shared
npm test -w @comite/mobile
npm run typecheck -w @comite/mobile
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/lib apps/mobile/src/types apps/mobile/src/data apps/mobile/package.json
git commit -m "feat(mobile): capa base http/theme/dates/mappers/documentFormats portada de web"
```

---

### Task 3: Componentes UI base (StyleSheet)

**Files:**
- Create: `apps/mobile/src/components/ui.tsx` (Screen, Card, Field, Button, StatusBadge, Logo, Stepper, ErrorText, Loading)
- Create: `apps/mobile/src/components/Avatar.tsx`
- Test: `apps/mobile/src/components/__tests__/ui.test.tsx`

**Interfaces:**
- Consumes: `colors`, `badgeColors` de `../lib/theme`; `ESTADO_LABEL` de `../lib/mappers`; `EstadoProyecto` de `../data/types`; `useApp` (Task 4 — se importa pero Avatar se completa cuando exista el context; para evitar dependencia circular, Avatar recibe `usuario` por prop).
- Produces:
  - `Button({ title, onPress, variant?: 'primary'|'outline'|'danger'|'ghost', disabled?, loading?, style? })`
  - `Field({ label, children })`, `Input` (wrapper de `TextInput` con estilo `.input`), `TextArea`
  - `Card({ children, style? })`, `Screen({ children, scroll?, style? })`
  - `StatusBadge({ estado })`, `Badge({ label, bg, fg })`
  - `Logo({ size? })`, `Stepper({ pasos, actual })`, `ErrorText({ children })`, `Loading({ label? })`, `SectionTitle`
  - `Avatar({ nombres, apellidos, size?, style? })`

- [ ] **Step 1: `src/components/ui.tsx` con primitivos y `StyleSheet` (equivalentes a las clases `.btn`, `.card`, `.input`, `.field`, `.badge`, `.field-error` del web) (2-5 min)**

```tsx
// src/components/ui.tsx
import type { ReactNode } from 'react'
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native'
import { colors, badgeColors } from '../lib/theme'
import { ESTADO_LABEL } from '../lib/mappers'
import type { EstadoProyecto } from '../data/types'

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  if (scroll) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={[s.screenContent, style]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    )
  }
  return <View style={[s.screen, s.screenContent, style]}>{children}</View>
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.slate400} {...props} style={[s.input, props.style]} />
}

export function TextArea(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.slate400} multiline {...props} style={[s.input, s.textarea, props.style]} />
}

type Variant = 'primary' | 'outline' | 'danger' | 'ghost'
export function Button({
  title, onPress, variant = 'primary', disabled, loading, style,
}: { title: string; onPress?: () => void; variant?: Variant; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [s.btn, btnVariant[variant], isDisabled && s.btnDisabled, pressed && s.btnPressed, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? colors.primary : '#fff'} />
      ) : (
        <Text style={[s.btnText, variant === 'outline' || variant === 'ghost' ? s.btnTextDark : undefined, variant === 'danger' ? undefined : undefined]}>
          {title}
        </Text>
      )}
    </Pressable>
  )
}

export function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{label}</Text>
    </View>
  )
}

export function StatusBadge({ estado }: { estado: EstadoProyecto }) {
  const c = badgeColors[estado]
  return <Badge label={ESTADO_LABEL[estado]} bg={c.bg} fg={c.fg} />
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <Text style={s.errorText}>{children}</Text>
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={s.muted}>{label}</Text>
    </View>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={s.sectionTitle}>{children}</Text>
}

export function Logo({ size = 52 }: { size?: number }) {
  // Sin asset remoto: cuadrado navy con iniciales UCH (placeholder consistente).
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.27, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.32 }}>UCH</Text>
    </View>
  )
}

export function Stepper({ pasos, actual }: { pasos: string[]; actual: number }) {
  return (
    <View style={s.stepper}>
      {pasos.map((nombre, i) => (
        <View key={nombre} style={s.stepItem}>
          {i > 0 && <View style={[s.stepBar, i <= actual && { backgroundColor: colors.primary }]} />}
          <View style={[s.stepDot, i <= actual ? { backgroundColor: colors.primary } : { backgroundColor: colors.blue50 }]}>
            <Text style={[s.stepDotText, i <= actual ? { color: '#fff' } : { color: colors.slate400 }]}>{i < actual ? '✓' : i + 1}</Text>
          </View>
          <Text style={s.stepLabel}>{nombre}</Text>
        </View>
      ))}
    </View>
  )
}

const btnVariant: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  outline: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: colors.bg },
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.lineSoft, padding: 14 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.slate700 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnTextDark: { color: colors.primary },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '500' },
  loading: { padding: 20, alignItems: 'center', gap: 8 },
  muted: { color: colors.slate500, fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepBar: { width: 24, height: 2, backgroundColor: colors.line },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepDotText: { fontSize: 12, fontWeight: '700' },
  stepLabel: { fontSize: 11, color: colors.slate500, marginLeft: 4 },
})
```

- [ ] **Step 2: `src/components/Avatar.tsx` — iniciales del nombre (solicitante), recibe usuario por prop para evitar ciclo con AppContext (2-5 min)**

```tsx
// src/components/Avatar.tsx
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors } from '../lib/theme'

function iniciales(nombres?: string, apellidos?: string) {
  return `${nombres?.[0] ?? ''}${apellidos?.[0] ?? ''}`.toUpperCase() || 'U'
}

export default function Avatar({
  nombres, apellidos, size = 40, style,
}: { nombres?: string; apellidos?: string; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Text style={{ color: '#fff', fontSize: size * 0.34, fontWeight: '700' }}>{iniciales(nombres, apellidos)}</Text>
    </View>
  )
}
const s = StyleSheet.create({
  avatar: { backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
})
```

- [ ] **Step 3: Test de render de StatusBadge/Button (2-5 min)**

```tsx
// src/components/__tests__/ui.test.tsx
import { render } from '@testing-library/react-native'
import { StatusBadge, Button } from '../ui'

describe('ui', () => {
  it('StatusBadge muestra la etiqueta del estado', () => {
    const { getByText } = render(<StatusBadge estado="subsanacion" />)
    expect(getByText('Subsanación')).toBeTruthy()
  })
  it('Button muestra su título', () => {
    const { getByText } = render(<Button title="Ingresar" />)
    expect(getByText('Ingresar')).toBeTruthy()
  })
})
```

- [ ] **Step 4: Ejecutar tests + typecheck y commit (2-5 min)**

```bash
npm test -w @comite/mobile
npm run typecheck -w @comite/mobile
git add apps/mobile/src/components
git commit -m "feat(mobile): componentes UI base con StyleSheet"
```

---

### Task 4: Estado global — AppContext y ConfirmContext

**Files:**
- Create: `apps/mobile/src/services/index.ts` (barrel — solo servicios en alcance)
- Create: `apps/mobile/src/state/AppContext.tsx`
- Create: `apps/mobile/src/state/ConfirmContext.tsx`

**Interfaces:**
- Consumes: `getToken`, `setUnauthorizedHandler` de `../lib/http`; `toDomainNotificacion`, `toDomainUser` de `../lib/mappers`; `authService`, `notificacionesService` de `../services` (Task 4 crea el barrel; auth/notificaciones se crean en Tasks 5 y 12 — para no bloquear, el barrel exporta lo que exista y se completa incrementalmente).
- Produces:
  - `AppProvider`, `useApp()` → `{ usuario, cargandoSesion, notificaciones, login(correo,clave), logout(), registrar(payload), refrescarNotificaciones(), marcarNotifsLeidas() }`.
  - `ConfirmProvider`, `useConfirm()` → `(mensaje, opciones?) => Promise<boolean>`.

Nota de secuenciación: esta tarea depende de `auth.service` y `notificaciones.service`. Para evitar bloqueo, crear en esta tarea un `services/auth.service.ts` mínimo (login/register/getMe/logout/recuperación) — es la Task 5 adelantada — y un `notificaciones.service.ts`. Se documenta abajo. El barrel `services/index.ts` exporta ambos.

- [ ] **Step 1: `src/services/auth.service.ts` — portado del web, `login` ahora `await setToken` (2-5 min)**

```typescript
// src/services/auth.service.ts
import { clearToken, request, setToken } from '../lib/http'
import type { LoginResponse, RolBackend, UserDto } from '../types/api'

export interface LoginPayload { email: string; password: string }
export interface RegisterPayload {
  email: string; password: string; nombre: string; apellido: string
  rol: RolBackend; codigoEstudiante?: string; laboratorio?: string
}

export async function login({ email, password }: LoginPayload): Promise<UserDto> {
  const { access_token } = await request<LoginResponse>('/auth/login', {
    method: 'POST', body: { username: email, password }, auth: false,
  })
  await setToken(access_token)
  return request<UserDto>('/users/me')
}
export async function register(payload: RegisterPayload): Promise<UserDto> {
  return request<UserDto>('/auth/register', { method: 'POST', body: payload, auth: false })
}
export async function getMe(): Promise<UserDto> {
  return request<UserDto>('/users/me')
}
export async function logout() {
  await clearToken()
}
export function solicitarRecuperacion(email: string): Promise<{ message: string }> {
  return request('/auth/recuperar/solicitar', { method: 'POST', body: { email }, auth: false })
}
export function verificarCodigoRecuperacion(email: string, codigo: string): Promise<{ message: string }> {
  return request('/auth/recuperar/verificar', { method: 'POST', body: { email, codigo }, auth: false })
}
export function cambiarPasswordRecuperacion(email: string, codigo: string, nuevaPassword: string): Promise<{ message: string }> {
  return request('/auth/recuperar/cambiar', { method: 'POST', body: { email, codigo, nuevaPassword }, auth: false })
}
```

- [ ] **Step 2: `src/services/notificaciones.service.ts` — portado idéntico (2-5 min)**

```typescript
// src/services/notificaciones.service.ts
import { request } from '../lib/http'
import type { NotificacionDto } from '../types/api'

export function list(skip = 0, limit = 50): Promise<NotificacionDto[]> {
  return request<NotificacionDto[]>('/notificaciones', { query: { skip, limit } })
}
export function sinLeer(): Promise<{ sinLeer: number }> {
  return request('/notificaciones/sin-leer')
}
export function marcarTodasLeidas(): Promise<void> {
  return request('/notificaciones/marcar-todas-leidas', { method: 'POST' })
}
export function marcarLeida(id: number, leida = true): Promise<NotificacionDto> {
  return request(`/notificaciones/${id}`, { method: 'PUT', body: { leida } })
}
```

- [ ] **Step 3: `src/services/index.ts` — barrel (solo servicios en alcance; se ampliará en Tasks 6/10/12) (2 min)**

```typescript
// src/services/index.ts
export * as authService from './auth.service'
export * as notificacionesService from './notificaciones.service'
// (Tasks siguientes agregan: expedientesService, chatService, usersService, configService)
```

- [ ] **Step 4: `src/state/AppContext.tsx` — portado; `getToken()` ahora es async dentro de `hidratar` (2-5 min)**

```tsx
// src/state/AppContext.tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getToken, setUnauthorizedHandler } from '../lib/http'
import { toDomainNotificacion, toDomainUser } from '../lib/mappers'
import { authService, notificacionesService } from '../services'
import type { RegisterPayload } from '../services/auth.service'
import type { Notificacion, Usuario } from '../data/types'

interface AppState {
  usuario: Usuario | null
  cargandoSesion: boolean
  notificaciones: Notificacion[]
  login: (correo: string, clave: string) => Promise<Usuario>
  logout: () => Promise<void>
  registrar: (payload: RegisterPayload) => Promise<void>
  refrescarNotificaciones: () => Promise<void>
  marcarNotifsLeidas: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])

  async function refrescarNotificaciones() {
    try {
      const lista = await notificacionesService.list(0, 50)
      setNotificaciones(lista.map(toDomainNotificacion))
    } catch {
      // sesión aún no lista o backend no disponible; se reintenta
    }
  }

  useEffect(() => {
    setUnauthorizedHandler(() => setUsuario(null))
    async function hidratar() {
      const token = await getToken()
      if (!token) {
        setCargandoSesion(false)
        return
      }
      try {
        const dto = await authService.getMe()
        setUsuario(toDomainUser(dto))
      } catch {
        setUsuario(null)
      } finally {
        setCargandoSesion(false)
      }
    }
    hidratar()
  }, [])

  useEffect(() => {
    if (!usuario) return
    refrescarNotificaciones()
    const t = setInterval(refrescarNotificaciones, 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id])

  const value = useMemo<AppState>(
    () => ({
      usuario,
      cargandoSesion,
      notificaciones,
      login: async (correo, clave) => {
        const dto = await authService.login({ email: correo, password: clave })
        const u = toDomainUser(dto)
        setUsuario(u)
        return u
      },
      logout: async () => {
        await authService.logout()
        setUsuario(null)
        setNotificaciones([])
      },
      registrar: async payload => {
        await authService.register(payload)
      },
      refrescarNotificaciones,
      marcarNotifsLeidas: async () => {
        await notificacionesService.marcarTodasLeidas()
        setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
      },
    }),
    [usuario, cargandoSesion, notificaciones],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}
```

- [ ] **Step 5: `src/state/ConfirmContext.tsx` — portado a RN con `Modal` en vez de div backdrop (2-5 min)**

```tsx
// src/state/ConfirmContext.tsx
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../lib/theme'
import { Button } from '../components/ui'

export interface ConfirmOptions {
  titulo?: string
  textoConfirmar?: string
  textoCancelar?: string
  peligroso?: boolean
}
interface ConfirmState extends ConfirmOptions { mensaje: string }
type ConfirmFn = (mensaje: string, opciones?: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<ConfirmState | null>(null)
  const resolverRef = useRef<((v: boolean) => void) | null>(null)

  const confirmar = useCallback<ConfirmFn>((mensaje, opciones) => {
    setEstado({ mensaje, ...opciones })
    return new Promise<boolean>(resolve => { resolverRef.current = resolve })
  }, [])

  function responder(valor: boolean) {
    resolverRef.current?.(valor)
    resolverRef.current = null
    setEstado(null)
  }

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <Modal visible={!!estado} transparent animationType="fade" onRequestClose={() => responder(false)}>
        <Pressable style={s.backdrop} onPress={() => responder(false)}>
          <Pressable style={s.card} onPress={() => {}}>
            {estado?.titulo && <Text style={s.titulo}>{estado.titulo}</Text>}
            <Text style={s.mensaje}>{estado?.mensaje}</Text>
            <View style={s.row}>
              <Button title={estado?.textoCancelar ?? 'Cancelar'} variant="outline" style={{ flex: 1 }} onPress={() => responder(false)} />
              <Button title={estado?.textoConfirmar ?? 'Confirmar'} variant={estado?.peligroso ? 'danger' : 'primary'} style={{ flex: 1 }} onPress={() => responder(true)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>')
  return ctx
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,32,74,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, gap: 8 },
  titulo: { fontSize: 16, fontWeight: '700', color: colors.navy },
  mensaje: { fontSize: 14, lineHeight: 20, color: colors.slate700, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
})
```

- [ ] **Step 6: Actualizar `app/_layout.tsx` para envolver con los providers (2-5 min)**

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AppProvider } from '../src/state/AppContext'
import { ConfirmProvider } from '../src/state/ConfirmContext'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ConfirmProvider>
        <AppProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AppProvider>
      </ConfirmProvider>
    </SafeAreaProvider>
  )
}
```

- [ ] **Step 7: Typecheck y commit (2-5 min)**

```bash
npm run typecheck -w @comite/mobile
git add apps/mobile/src/services apps/mobile/src/state apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): AppContext, ConfirmContext y servicios auth/notificaciones"
```

---

### Task 5: Pantallas de autenticación — Login, Registro, RegistroExito, Recuperar

**Files:**
- Create: `apps/mobile/app/index.tsx` (reemplaza el placeholder: redirige según sesión)
- Create: `apps/mobile/app/login.tsx`
- Create: `apps/mobile/app/registro.tsx`
- Create: `apps/mobile/app/registro-exito.tsx`
- Create: `apps/mobile/app/recuperar.tsx`
- Create: `apps/mobile/app/acerca.tsx`

**Interfaces:**
- Consumes: `useApp()` (login, registrar), `authService` (recuperación), `ApiError`, componentes UI, `ROL_LABEL`, `ROLES_AUTO_REGISTRO`, `homePathForRole`, `useRouter`/`Redirect` de expo-router.
- Produces: rutas públicas `/login`, `/registro`, `/registro-exito`, `/recuperar`, `/acerca`; `/` (index) que redirige a `/login` o `/(app)` según `usuario`.

Nota de mapeo de rutas web→móvil: web `/registro/exito` → móvil `/registro-exito`; web usa `navigate(state)` para pasar `correo`/`codigo` → móvil usa query params de expo-router (`router.push({ pathname, params })` + `useLocalSearchParams`).

- [ ] **Step 1: `app/index.tsx` — redirección según estado de sesión (2-5 min)**

```tsx
// app/index.tsx
import { Redirect } from 'expo-router'
import { useApp } from '../src/state/AppContext'
import { Loading } from '../src/components/ui'
import { View } from 'react-native'

export default function Index() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Iniciando…" /></View>
  return <Redirect href={usuario ? '/(app)' : '/login'} />
}
```

- [ ] **Step 2: `app/login.tsx` — versión mobile-only del Login del web (misma validación y flujo) (2-5 min)**

```tsx
// app/login.tsx
import { useState } from 'react'
import { Link, useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { Button, ErrorText, Field, Input, Logo } from '../src/components/ui'
import { colors } from '../src/lib/theme'
import { ApiError } from '../src/lib/http'
import { useApp } from '../src/state/AppContext'

export default function Login() {
  const { login } = useApp()
  const router = useRouter()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function onSubmit() {
    if (!correo.trim() || !clave) {
      setError('Ingresa tu correo institucional y contraseña.')
      return
    }
    setError('')
    setEnviando(true)
    try {
      await login(correo.trim(), clave)
      router.replace('/(app)')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <View style={s.wrap}>
      <View style={s.card}>
        <View style={s.header}>
          <Logo />
          <Text style={s.title}>Comité de Ética</Text>
          <Text style={s.subtitle}>UNIV. DE CIENCIAS Y HUMANIDADES</Text>
        </View>
        <Field label="Correo institucional">
          <Input placeholder="usuario@uch.pe" autoCapitalize="none" keyboardType="email-address" value={correo} onChangeText={setCorreo} />
        </Field>
        <Field label="Contraseña">
          <Input placeholder="••••••••" secureTextEntry value={clave} onChangeText={setClave} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button title={enviando ? 'Ingresando…' : 'Ingresar'} loading={enviando} onPress={onSubmit} />
        <View style={s.links}>
          <Link href="/registro" style={s.link}>Registrarse</Link>
          <Text style={{ color: colors.line }}>·</Text>
          <Link href="/recuperar" style={s.link}>Recuperar</Link>
        </View>
        <Link href="/acerca" style={s.acerca}>Acerca del Comité de Ética</Link>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.navy, justifyContent: 'center', padding: 22 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, gap: 14 },
  header: { alignItems: 'center', gap: 6, marginBottom: 10 },
  title: { fontSize: 19, fontWeight: '700', color: colors.navy },
  subtitle: { fontSize: 10.5, fontWeight: '600', color: colors.slate500, letterSpacing: 1.2 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 6 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  acerca: { textAlign: 'center', color: colors.slate500, fontSize: 13, marginTop: 6 },
})
```

- [ ] **Step 3: `app/registro.tsx` — mismas validaciones que el web (regex `@uch.(pe|edu.pe)`, min 6, confirmar), rol vía selector propio (2-5 min)**

Portar la lógica de `apps/web/src/pages/Registro.tsx`: estado `f` con `nombres/apellidos/correo/rol/codigo/clave/confirmar`; `esEstudiante`/`esInvestigador`; validaciones idénticas; payload idéntico a `registrar(...)`. Para el `<select>` de rol usar un grupo de `Pressable` (segmented) con `OPCIONES_ROL = ROLES_AUTO_REGISTRO.map(r => ({ value: r, label: ROL_LABEL[r] }))`. Al éxito: `router.push({ pathname: '/registro-exito', params: { correo: f.correo.trim() } })`.

```tsx
// app/registro.tsx (núcleo — selector de rol y submit)
import { useState } from 'react'
import { Link, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Button, Card, ErrorText, Field, Input } from '../src/components/ui'
import { colors } from '../src/lib/theme'
import { ROL_LABEL, ROLES_AUTO_REGISTRO, type Rol } from '../src/data/types'
import { ApiError } from '../src/lib/http'
import { useApp } from '../src/state/AppContext'

const OPCIONES_ROL = ROLES_AUTO_REGISTRO.map(rol => ({ value: rol as Rol, label: ROL_LABEL[rol] }))

export default function Registro() {
  const { registrar } = useApp()
  const router = useRouter()
  const [f, setF] = useState({ nombres: '', apellidos: '', correo: '', rol: OPCIONES_ROL[0].value, codigo: '', clave: '', confirmar: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const esEstudiante = f.rol === 'estudiante_pregrado' || f.rol === 'estudiante_postgrado'
  const esInvestigador = f.rol === 'investigador'
  const etiquetaCodigo = esInvestigador ? 'Laboratorio (opcional)' : 'Código de estudiante'
  const set = (k: keyof typeof f) => (v: string) => setF(prev => ({ ...prev, [k]: v }))

  async function onSubmit() {
    if (!f.nombres.trim() || !f.apellidos.trim() || !f.correo.trim() || !f.clave) return setError('Completa todos los campos obligatorios.')
    if (!/@uch\.(pe|edu\.pe)$/i.test(f.correo.trim())) return setError('Usa tu correo institucional (@uch.pe).')
    if (f.clave.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (f.clave !== f.confirmar) return setError('Las contraseñas no coinciden.')
    setError('')
    setEnviando(true)
    try {
      await registrar({
        nombre: f.nombres.trim(), apellido: f.apellidos.trim(), email: f.correo.trim(), password: f.clave, rol: f.rol,
        codigoEstudiante: esEstudiante ? f.codigo.trim() || undefined : undefined,
        laboratorio: esInvestigador ? f.codigo.trim() || undefined : undefined,
      })
      router.push({ pathname: '/registro-exito', params: { correo: f.correo.trim() } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }
  // ... render: TopBar "Crear cuenta", campos nombres/apellidos/correo, selector rol (Pressable[]),
  //     bloque código si esEstudiante||esInvestigador, clave/confirmar, ErrorText, Button, Link a /login.
  // (Estructura completa análoga a Login; selector rol:)
  return (
    <View style={{ flex: 1 }}>
      {/* TopBar y campos aquí; selector de rol: */}
      <Field label="Rol">
        <View style={s.segment}>
          {OPCIONES_ROL.map(r => (
            <Pressable key={r.value} onPress={() => setF(prev => ({ ...prev, rol: r.value }))}
              style={[s.segItem, f.rol === r.value && s.segItemActive]}>
              <Text style={[s.segText, f.rol === r.value && s.segTextActive]}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      </Field>
      {(esEstudiante || esInvestigador) && (
        <Card style={{ backgroundColor: colors.blue50, borderColor: colors.blue100 }}>
          <Field label={etiquetaCodigo}><Input value={f.codigo} onChangeText={set('codigo')} placeholder={esInvestigador ? 'Lab. Central' : '2021xxxxx'} /></Field>
        </Card>
      )}
      <ErrorText>{error}</ErrorText>
      <Button title={enviando ? 'Creando cuenta…' : 'Crear cuenta'} loading={enviando} onPress={onSubmit} />
      <Text style={{ textAlign: 'center' }}>¿Ya tienes cuenta? <Link href="/login" style={{ color: colors.primary }}>Ingresar</Link></Text>
    </View>
  )
}
const s = StyleSheet.create({
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  segItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: 12.5, color: colors.slate500, fontWeight: '600' },
  segTextActive: { color: '#fff' },
})
```

- [ ] **Step 4: `app/registro-exito.tsx` — usa `useLocalSearchParams` para el correo (2-5 min)**

```tsx
// app/registro-exito.tsx
import { Link, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../src/lib/theme'

export default function RegistroExito() {
  const { correo } = useLocalSearchParams<{ correo?: string }>()
  return (
    <View style={s.wrap}>
      <View style={s.check}><Text style={s.checkMark}>✓</Text></View>
      <Text style={s.h2}>¡Cuenta creada!</Text>
      <Text style={s.p}>Tu cuenta fue registrada con el correo <Text style={{ fontWeight: '700', color: colors.ink }}>{correo ?? 'usuario@uch.pe'}</Text>. Ya puedes iniciar sesión y enviar tu primer proyecto.</Text>
      <Link href="/login" style={s.btn}>Ir al inicio de sesión</Link>
    </View>
  )
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  check: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  checkMark: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, color: '#fff', textAlign: 'center', textAlignVertical: 'center', fontSize: 22, fontWeight: '700', overflow: 'hidden' },
  h2: { fontSize: 21, color: colors.navy, fontWeight: '700' },
  p: { fontSize: 14.5, lineHeight: 22, color: colors.slate500, textAlign: 'center' },
  btn: { backgroundColor: colors.primary, color: '#fff', fontWeight: '700', paddingHorizontal: 20, paddingVertical: 13, borderRadius: 10, overflow: 'hidden', marginTop: 12 },
})
```

- [ ] **Step 5: `app/recuperar.tsx` — wizard de 4 pasos portado (solicitar/verificar/cambiar), OTP de 6 dígitos con inputs y refs (2-5 min)**

Portar `apps/web/src/pages/Recuperar.tsx`: estado `paso` (1-4), `correo`, `codigo` (array 6), `clave`, `confirmar`, `error`, `enviando`, `reenviado`. Lógica `siguiente()` idéntica llamando `authService.solicitarRecuperacion`/`verificarCodigoRecuperacion`/`cambiarPasswordRecuperacion`. OTP: 6 `TextInput` con `keyboardType="number-pad"`, `maxLength={1}`, `refs` para auto-focus al siguiente. `Progreso` como componente RN. En paso 4, botón `router.replace('/login')`.

- [ ] **Step 6: `app/acerca.tsx` — portado (pilares + FAQs colapsables con estado `abierta`) (2-5 min)**

Portar `apps/web/src/pages/Acerca.tsx` versión mobile: header navy con título/descr, tarjetas de PILARES, FAQs como `Pressable` que togglean `abierta`, botón "Acceder al sistema" → `router.replace('/login')`.

- [ ] **Step 7: Verificación manual (bloque auth) en Android (5-10 min)**

```bash
npm run dev -w @comite/mobile
# En Expo Go / emulador Android, contra la API real:
#  - Login con credenciales de un solicitante -> redirige a /(app)
#  - Registro con correo @uch.pe -> pantalla de éxito
#  - Recuperar: paso 1 envía código (revisar que el back responde 200)
#  - Acerca: navega y vuelve
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/app/index.tsx apps/mobile/app/login.tsx apps/mobile/app/registro.tsx apps/mobile/app/registro-exito.tsx apps/mobile/app/recuperar.tsx apps/mobile/app/acerca.tsx
git commit -m "feat(mobile): pantallas de autenticación (login, registro, recuperar, acerca)"
```

---

### Task 6: expedientes.service + grupo protegido `(app)/` con guard y tab bar + Dashboard

**Files:**
- Create: `apps/mobile/src/services/expedientes.service.ts`
- Modify: `apps/mobile/src/services/index.ts` (agregar `expedientesService`)
- Create: `apps/mobile/app/(app)/_layout.tsx` (guard de sesión + Tabs)
- Create: `apps/mobile/app/(app)/index.tsx` (Dashboard)
- Create: `apps/mobile/src/components/TopBar.tsx`

**Interfaces:**
- Consumes: `request`, `uploadDocumento`, `RNFile`, `ApiError` de `../lib/http`; DTOs de `../types/api`; `useApp`; `toDomainProyecto`; `expo-router` `Tabs`, `Redirect`.
- Produces:
  - `expedientesService`: `list`, `getCatalogos`, `getElegiblesCambioTitulo`, `getRequisitos`, `getBitacora`, `getHistorial`, `getDocumentos`, `getById`, `getDetalle`, `create(payload)`, `createCambioTitulo(payload)`, `update`, `remove`, `enviar`, `subsanar`, `registrarDocumento(id, file: RNFile, opts)` (firma lista, sin picker), y tipos `CreateExpedientePayload`, `CambioTituloPayload`, `UpdateExpedientePayload`. NO portar `descargarDocumento` (usa Blob del DOM; fuera de alcance de este corte).
  - `(app)/_layout.tsx`: guard que redirige a `/login` si no hay sesión; Tabs con 5 pestañas (Inicio, Proyectos, Nuevo, Consultas, Perfil).
  - `(app)/index.tsx`: Dashboard.

- [ ] **Step 1: `src/services/expedientes.service.ts` — portado; `registrarDocumento` usa `uploadDocumento` con `RNFile` (2-5 min)**

```typescript
// src/services/expedientes.service.ts
import { request, uploadDocumento, type RNFile } from '../lib/http'
import type {
  AutorExpedienteDto, BitacoraDto, CatalogosDto, DocumentoDto, ElegibleCambioTituloDto,
  ExpedienteDto, HistorialDto, RequisitosDto,
} from '../types/api'

export function list(skip = 0, limit = 100): Promise<ExpedienteDto[]> {
  return request<ExpedienteDto[]>('/expedientes', { query: { skip, limit } })
}
export function getCatalogos(): Promise<CatalogosDto> {
  return request<CatalogosDto>('/expedientes/catalogos')
}
export function getElegiblesCambioTitulo(): Promise<ElegibleCambioTituloDto[]> {
  return request<ElegibleCambioTituloDto[]>('/expedientes/elegibles-cambio-titulo')
}
export function getRequisitos(id: number): Promise<RequisitosDto> {
  return request<RequisitosDto>(`/expedientes/${id}/requisitos`)
}
export function getBitacora(id: number): Promise<BitacoraDto[]> {
  return request<BitacoraDto[]>(`/expedientes/${id}/bitacora`)
}
export function getHistorial(id: number): Promise<HistorialDto[]> {
  return request<HistorialDto[]>(`/expedientes/${id}/historial`)
}
export function getDocumentos(id: number): Promise<DocumentoDto[]> {
  return request<DocumentoDto[]>(`/expedientes/${id}/documentos`)
}
export function getById(id: number): Promise<ExpedienteDto> {
  return request<ExpedienteDto>(`/expedientes/${id}`)
}
export async function getDetalle(id: number) {
  const [expediente, bitacora, historial, documentos] = await Promise.all([
    getById(id),
    getBitacora(id).catch(() => []),
    getHistorial(id).catch(() => []),
    getDocumentos(id).catch(() => []),
  ])
  return { expediente, bitacora, historial, documentos }
}

export interface CreateExpedientePayload {
  tituloProtocolo: string; tipoTramite?: string; facultad?: string
  programaEstudios?: string; ciclo?: string; nivelPosgrado?: string; autores?: AutorExpedienteDto[]
}
export function create(payload: CreateExpedientePayload): Promise<ExpedienteDto> {
  return request<ExpedienteDto>('/expedientes', { method: 'POST', body: payload })
}

export interface CambioTituloPayload {
  proyectoOrigenId: number; programaEstudios: string; ciclo: string; tituloNuevo: string; autores?: AutorExpedienteDto[]
}
export function createCambioTitulo(payload: CambioTituloPayload): Promise<ExpedienteDto> {
  return request<ExpedienteDto>('/expedientes/cambio-titulo', { method: 'POST', body: payload })
}

export interface UpdateExpedientePayload { tituloProtocolo?: string; tipoTramite?: string; facultad?: string; estado?: string }
export function update(id: number, payload: UpdateExpedientePayload): Promise<ExpedienteDto> {
  return request<ExpedienteDto>(`/expedientes/${id}`, { method: 'PUT', body: payload })
}
export function remove(id: number): Promise<void> {
  return request(`/expedientes/${id}`, { method: 'DELETE' })
}
export function enviar(id: number): Promise<{ message: string; codigo?: string }> {
  return request(`/expedientes/${id}/enviar`, { method: 'POST' })
}
export function subsanar(id: number, observaciones: string): Promise<{ message: string; estado: string }> {
  return request(`/expedientes/${id}/subsanacion`, { method: 'POST', body: { observaciones } })
}

// Subida real de archivo queda para una fase posterior (expo-document-picker).
// La firma ya acepta el shape RNFile del picker: {uri,name,type}.
export function registrarDocumento(
  id: number,
  file: RNFile,
  opts: { tipoDocumento?: string; esObligatorio?: boolean } = {},
): Promise<DocumentoDto> {
  const fields: Record<string, string> = {}
  if (opts.tipoDocumento !== undefined) fields.tipoDocumento = opts.tipoDocumento
  if (opts.esObligatorio !== undefined) fields.esObligatorio = String(opts.esObligatorio)
  return uploadDocumento<DocumentoDto>(`/expedientes/${id}/documentos`, file, fields)
}
```

Actualizar `services/index.ts`:
```typescript
export * as expedientesService from './expedientes.service'
```

- [ ] **Step 2: `src/components/TopBar.tsx` — cabecera con botón atrás (equivalente a shared `TopBar`) (2-5 min)**

```tsx
// src/components/TopBar.tsx
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View, type ReactNode } from 'react-native'
import { colors } from '../lib/theme'

export default function TopBar({ titulo, atras = true, right }: { titulo: string; atras?: boolean; right?: ReactNode }) {
  const router = useRouter()
  return (
    <View style={s.bar}>
      {atras && (
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.back}>
          <Text style={s.backText}>‹</Text>
        </Pressable>
      )}
      <Text style={s.title} numberOfLines={1}>{titulo}</Text>
      {right}
    </View>
  )
}
const s = StyleSheet.create({
  bar: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: colors.slate500, lineHeight: 30 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink },
})
```

- [ ] **Step 3: `app/(app)/_layout.tsx` — guard de sesión + Tabs (5 pestañas del bottom nav móvil solicitante) (2-5 min)**

```tsx
// app/(app)/_layout.tsx
import { Redirect, Tabs } from 'expo-router'
import { Text, View } from 'react-native'
import { useApp } from '../../src/state/AppContext'
import { Loading } from '../../src/components/ui'
import { colors } from '../../src/lib/theme'

// Icono textual simple (sin librería de iconos); se puede sustituir por @expo/vector-icons luego.
function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ color, fontSize: 18 }}>{label}</Text>
}

export default function AppLayout() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Cargando…" /></View>
  if (!usuario) return <Redirect href="/login" />

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.slate400 }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color }) => <TabIcon label="⌂" color={color} /> }} />
      <Tabs.Screen name="proyectos/index" options={{ title: 'Proyectos', tabBarIcon: ({ color }) => <TabIcon label="▤" color={color} /> }} />
      <Tabs.Screen name="nuevo/index" options={{ title: 'Nuevo', tabBarIcon: ({ color }) => <TabIcon label="＋" color={color} /> }} />
      <Tabs.Screen name="consultas" options={{ title: 'Consultas', tabBarIcon: ({ color }) => <TabIcon label="💬" color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <TabIcon label="◔" color={color} /> }} />
      {/* Rutas sin pestaña propia (se ocultan del tab bar) */}
      <Tabs.Screen name="proyectos/[id]" options={{ href: null }} />
      <Tabs.Screen name="nuevo/exito" options={{ href: null }} />
      <Tabs.Screen name="cambiar-titulo" options={{ href: null }} />
    </Tabs>
  )
}
```

- [ ] **Step 4: `app/(app)/index.tsx` — Dashboard portado (stats desde `expedientesService.list`, cuenta regresiva, recientes) (2-5 min)**

Portar `apps/web/src/pages/Dashboard.tsx` versión móvil: header con saludo + avatar (Link a `/perfil` que dentro de Tabs es `/(app)/perfil`), banner de cuenta regresiva (`useCuentaRegresiva` idéntico), fila de 4 stats, "Mis proyectos recientes" (primeros 3, cada uno `Pressable` → `/(app)/proyectos/[id]`), estados cargando/error/vacío. Usar `expedientesService.list()` + `toDomainProyecto` + orden por `createdAt` desc.

```tsx
// app/(app)/index.tsx (núcleo de la lógica de datos — idéntica al web)
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Card, Loading, ErrorText, StatusBadge, Screen } from '../../src/components/ui'
import Avatar from '../../src/components/Avatar'
import { colors } from '../../src/lib/theme'
import type { Proyecto } from '../../src/data/types'
import { ApiError } from '../../src/lib/http'
import { toDomainProyecto } from '../../src/lib/mappers'
import { expedientesService } from '../../src/services'
import { useApp } from '../../src/state/AppContext'

const CIERRE = new Date('2026-07-08T23:59:59')
function useCuentaRegresiva() {
  const [restante, setRestante] = useState(CIERRE.getTime() - Date.now())
  useEffect(() => {
    const t = setInterval(() => setRestante(CIERRE.getTime() - Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const s = Math.max(0, Math.floor(restante / 1000))
  return { dias: Math.floor(s / 86400), horas: Math.floor((s % 86400) / 3600), min: Math.floor((s % 3600) / 60), seg: s % 60 }
}

export default function Dashboard() {
  const { usuario } = useApp()
  const router = useRouter()
  const cr = useCuentaRegresiva()
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    ;(async () => {
      setCargando(true); setError('')
      try {
        const dtos = await expedientesService.list()
        const ordenados = [...dtos].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        if (activo) setProyectos(ordenados.map(d => toDomainProyecto(d)))
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus proyectos.')
      } finally { if (activo) setCargando(false) }
    })()
    return () => { activo = false }
  }, [])

  const stats = [
    { n: proyectos.filter(p => p.estado === 'enviado' || p.estado === 'en_revision').length, label: 'Revisión', color: colors.primary },
    { n: proyectos.filter(p => p.estado === 'aprobado' || p.estado === 'aprobado_observaciones').length, label: 'Aprobado', color: colors.success },
    { n: proyectos.filter(p => p.estado === 'subsanacion').length, label: 'Subsanación', color: colors.warn },
    { n: proyectos.filter(p => p.estado === 'borrador').length, label: 'Borrador', color: colors.slate500 },
  ]
  const recientes = proyectos.slice(0, 3)
  // ... render con header (Avatar -> router.push('/(app)/perfil')), banner countdown, stats, recientes.
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.header}>
        <View>
          <Text style={{ fontSize: 13, color: colors.slate500 }}>Buen día,</Text>
          <Text style={{ fontSize: 17, fontWeight: '700' }}>{usuario?.nombres} {usuario?.apellidos}</Text>
        </View>
        <Pressable onPress={() => router.push('/(app)/perfil')}><Avatar nombres={usuario?.nombres} apellidos={usuario?.apellidos} /></Pressable>
      </View>
      <Screen>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Cierre de envíos de proyectos</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[[cr.dias,'DÍAS'],[cr.horas,'HRS'],[cr.min,'MIN'],[cr.seg,'SEG']].map(([n,l]) => (
              <View key={l as string} style={s.bannerBox}>
                <Text style={s.bannerNum}>{String(n).padStart(2,'0')}</Text>
                <Text style={s.bannerLabel}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          {stats.map(st => (
            <Card key={st.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 11 }}>
              <Text style={{ fontSize: 21, fontWeight: '700', color: st.color }}>{st.n}</Text>
              <Text style={{ fontSize: 11, color: colors.slate500 }}>{st.label}</Text>
            </Card>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '700' }}>Mis proyectos recientes</Text>
          <Pressable onPress={() => router.push('/(app)/proyectos')}><Text style={{ color: colors.primary }}>Ver todos</Text></Pressable>
        </View>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {cargando && <Loading label="Cargando proyectos…" />}
          {!cargando && !!error && <View style={{ padding: 14 }}><ErrorText>{error}</ErrorText></View>}
          {!cargando && !error && recientes.map(p => (
            <Pressable key={p.id} style={s.row} onPress={() => router.push(`/(app)/proyectos/${p.id}`)}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600' }}>{p.titulo}</Text>
                <Text style={{ fontSize: 12, color: colors.slate400 }}>{p.codigo ?? 'Sin enviar'}</Text>
              </View>
              <StatusBadge estado={p.estado} />
            </Pressable>
          ))}
          {!cargando && !error && recientes.length === 0 && <Text style={{ padding: 14, color: colors.slate500 }}>Aún no tienes proyectos.</Text>}
        </Card>
      </Screen>
    </View>
  )
}
const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  banner: { backgroundColor: colors.navy, borderRadius: 18, padding: 16 },
  bannerTitle: { color: '#fff', opacity: 0.85, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  bannerBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  bannerNum: { color: '#fff', fontSize: 22, fontWeight: '700' },
  bannerLabel: { color: '#fff', opacity: 0.8, fontSize: 9, fontWeight: '600', letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.row_line ?? colors.lineSoft },
})
```

(Nota: usar `colors.lineSoft` para separadores; no existe `row_line` en el theme — corregir a `colors.lineSoft`.)

- [ ] **Step 5: Verificación manual (Dashboard) + typecheck (5 min)**

```bash
npm run typecheck -w @comite/mobile
# Emulador Android: login -> Dashboard carga stats reales, tab bar visible, countdown corre.
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/services/expedientes.service.ts apps/mobile/src/services/index.ts apps/mobile/src/components/TopBar.tsx "apps/mobile/app/(app)/_layout.tsx" "apps/mobile/app/(app)/index.tsx"
git commit -m "feat(mobile): expedientes.service, grupo protegido con tabs y Dashboard"
```

---

### Task 7: Proyectos (lista) + DetalleProyecto

**Files:**
- Create: `apps/mobile/app/(app)/proyectos/index.tsx`
- Create: `apps/mobile/app/(app)/proyectos/[id].tsx`

**Interfaces:**
- Consumes: `expedientesService` (`list`, `getDetalle`, `getRequisitos`, `remove`, `enviar`), `toDomainProyecto`, `ESTADO_LABEL`, `useConfirm`, `formatearFecha`, `formatearFechaHora`, `fechaLocalISO`, `useRouter`, `useLocalSearchParams`.
- Produces: rutas `/(app)/proyectos` (lista con búsqueda + filtros de fecha) y `/(app)/proyectos/[id]` (detalle con checklist, historial, acciones).

- [ ] **Step 1: `proyectos/index.tsx` — lista con búsqueda, filtros desde/hasta, eliminar borrador (2-5 min)**

Portar `apps/web/src/pages/Proyectos.tsx` (versión móvil, sin tabla desktop): carga `expedientesService.list()` → `toDomainProyecto`; `filtrados` con `useMemo` (búsqueda por título/código + rango de fechas usando `fechaLocalISO`, orden reciente primero); tarjetas por proyecto con `StatusBadge` y acción según estado (`subsanacion` → futuro subsanar, no en alcance → mostrar "Ver detalle"; `borrador` → botón "Eliminar" con `useConfirm`; resto → "Ver detalle ›" → `/(app)/proyectos/[id]`). Link "Cambiar título de un proyecto aprobado ›" → `/(app)/cambiar-titulo`. Filtros de fecha: como no hay `<input type=date>` nativo uniforme, usar dos `Input` con placeholder `AAAA-MM-DD` (validación suave) — mantiene la lógica de filtrado idéntica.

Nota de alcance: la ruta `/proyectos/:id/subsanar` (Subsanacion.tsx) NO está en la lista de pantallas del spec; para estado `subsanacion`, la acción navega al detalle (`/(app)/proyectos/[id]`) donde se informa el estado. No crear pantalla de subsanación.

- [ ] **Step 2: `proyectos/[id].tsx` — detalle con checklist documental (lectura), historial y acciones (2-5 min)**

Portar `apps/web/src/pages/DetalleProyecto.tsx` (móvil): `useLocalSearchParams` para `id`; `getDetalle` + `getRequisitos().catch(()=>null)`; `toDomainProyecto`; `filasChecklist` idéntico. Diferencias por alcance:
- Subir documento: la fila muestra "Subir" deshabilitado con nota `// TODO Fase posterior: expo-document-picker` (no abre picker). Documentos ya cargados muestran su nombre (sin "Ver/Descargar" porque `descargarDocumento` con Blob está fuera de alcance — mostrar solo el nombre y badge "Cargado").
- `handleEnviar` (POST `/expedientes/:id/enviar`) SÍ se implementa (es solo request JSON). Botón "Enviar proyecto" visible en borrador.
- Acción "Solicitar cambio de título ›" si estado ∈ {aprobado, aprobado_observaciones} → `/(app)/cambiar-titulo?id=<id>`.
- Historial: portar `HistorialPanel` con `formatearFechaHora` y `ESTADO_LABEL`.
- Si `id` inválido / no encontrado → `router.replace('/(app)/proyectos')`.

```tsx
// proyectos/[id].tsx (núcleo de carga — idéntico en lógica al web)
const { id } = useLocalSearchParams<{ id: string }>()
const expedienteId = Number(id)
// useEffect: if (!Number.isFinite(expedienteId)) router.replace('/(app)/proyectos')
// const [detalle, req] = await Promise.all([getDetalle(expedienteId), getRequisitos(expedienteId).catch(()=>null)])
// filasChecklist = requisitos ? requisitos.documentosRequeridos.map(...) : documentos.map(...)
// esBorrador = expediente.estado === 'borrador'
// handleEnviar -> await expedientesService.enviar(expedienteId); await cargar()
```

- [ ] **Step 3: Verificación manual + typecheck (5 min)**

```bash
npm run typecheck -w @comite/mobile
# Android: lista carga, búsqueda filtra, abrir un detalle muestra checklist/historial;
# enviar un borrador (si hay requisitos completos) responde OK; eliminar borrador pide confirmación.
```

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(app)/proyectos"
git commit -m "feat(mobile): lista Mis proyectos y detalle de proyecto"
```

---

### Task 8: NuevoProyecto (wizard) + NuevoProyectoExito

**Files:**
- Create: `apps/mobile/app/(app)/nuevo/index.tsx`
- Create: `apps/mobile/app/(app)/nuevo/exito.tsx`
- Create: `apps/mobile/src/components/DocumentoCard.tsx`

**Interfaces:**
- Consumes: `expedientesService` (`getCatalogos`, `create`, `registrarDocumento`, `enviar`), `validarDocumento`, `formatoDocumento`, `MAX_SIZE_MB`, `plantillaUrl`, `useApp`, `Stepper`, `useRouter`, `useLocalSearchParams`, `Linking` de RN (para abrir plantillas/guías en navegador).
- Produces: ruta `/(app)/nuevo` (wizard 3 pasos: Datos, Docs, Enviar) y `/(app)/nuevo/exito`.

- [ ] **Step 1: `src/components/DocumentoCard.tsx` + `GuiaNombresAlerta` — RN, sin picker (2-5 min)**

Portar `apps/web/src/components/DocumentoCard.tsx`: muestra label, formato (`formatoDocumento(doc.tipo)` + `MAX_SIZE_MB`), indicaciones colapsables (`Pressable` toggle), plantilla/guía → `Linking.openURL(plantillaUrl(...))`. Control de archivo: como la subida real está fuera de alcance, el botón "Subir archivo" está presente pero deshabilitado con nota `// TODO Fase posterior`. Si `estado.cargado`, muestra `nombreArchivo` + badge "Cargado". Recibe `estado: DocEstado | undefined`, `onFile` (se deja en la interfaz, no se dispara). Definir `export interface DocEstado { cargado: boolean; nombreArchivo?: string; subiendo: boolean; error?: string }`.

- [ ] **Step 2: `nuevo/index.tsx` — wizard portado (crear borrador → docs → enviar) (2-5 min)**

Portar la lógica de `apps/web/src/pages/NuevoProyecto.tsx` (móvil, 3 pasos):
- Carga `getCatalogos()`; `modalidad`, `esPregrado/esPostgrado/esInterno`, `docsRequeridos`, `autorTermCap/autorPrincipalLabel/agregarAutorLabel`.
- Paso 0 (Datos): título (`TextArea`, min 10 chars), programa (selector), ciclo/nivel según modalidad, autores dinámicos (agregar/quitar), validaciones idénticas. `crearBorrador()` → `expedientesService.create({...})` con `autoresPayload` idéntico (orden, esPrincipal, etc.), setea `expedienteId`, inicializa `docsEstado`, avanza a paso 1.
- Paso 1 (Docs): `GuiaNombresAlerta` + `DocumentoCard` por cada `docsRequeridos`. Subida real fuera de alcance: `todosCargados` se evalúa igual pero, dado que no se puede subir aún, permitir avanzar mostrando aviso "La carga de archivos estará disponible próximamente" (no bloquear el flujo del wizard para poder probar el resto). Documentar con `// TODO Fase posterior`.
- Paso 2 (Enviar): resumen (título, programa/ciclo/nivel), checklist de docs (listo/pendiente), `enviarFinal()` → `expedientesService.enviar(expedienteId)` → `router.replace({ pathname: '/(app)/nuevo/exito', params: { codigo: res.codigo ?? '', id: String(expedienteId) } })`.

- [ ] **Step 3: `nuevo/exito.tsx` — portado con `useLocalSearchParams` (codigo, id) (2-5 min)**

Portar `NuevoProyectoExito.tsx` (móvil): check azul, "¡Proyecto enviado!", tarjeta navy con `CÓDIGO ASIGNADO` = `codigo`, botón "Ver detalle del proyecto" → `/(app)/proyectos/[id]` (si hay id) y "Ir al inicio" → `/(app)`.

- [ ] **Step 4: Verificación manual + typecheck (5 min)**

```bash
npm run typecheck -w @comite/mobile
# Android: crear un borrador (paso 0 -> se crea expediente real), avanzar pasos, ver pantalla de éxito con código.
```

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(app)/nuevo" apps/mobile/src/components/DocumentoCard.tsx
git commit -m "feat(mobile): wizard Nuevo proyecto y pantalla de éxito"
```

---

### Task 9: CambiarTitulo

**Files:**
- Create: `apps/mobile/app/(app)/cambiar-titulo.tsx`

**Interfaces:**
- Consumes: `expedientesService` (`getElegiblesCambioTitulo`, `getCatalogos`, `createCambioTitulo`, `registrarDocumento`, `enviar`), `validarDocumento`, `DocumentoCard`, `Stepper`, `useConfirm`, `useLocalSearchParams` (`id` preseleccionado opcional), `useRouter`.
- Produces: ruta `/(app)/cambiar-titulo` (wizard 3 pasos: datos e integrantes, documento, revisar y enviar).

- [ ] **Step 1: `cambiar-titulo.tsx` — portado (2-5 min)**

Portar `apps/web/src/pages/CambiarTitulo.tsx` (móvil): carga en paralelo `getElegiblesCambioTitulo` + `getCatalogos`; `aplicarOrigen` idéntico; selector de proyecto de origen (los `elegibles`); campos programa/ciclo/nuevo título; autores dinámicos con validaciones idénticas (`siguienteDatos`). Paso documento: `DocumentoCard` con `documentoInfo` (subida fuera de alcance → mismo tratamiento que Task 8: se permite continuar con aviso). Paso revisar: resumen (título anterior/nuevo, nº autores, documento) + `confirmarEnvio()` con `useConfirm` → `createCambioTitulo(...)` → (si hay file y en fase posterior) `registrarDocumento` → `enviar(expId)` → `router.replace('/(app)/proyectos/${expId}')`. Manejar estados: cargando, error de carga, sin elegibles (mensaje + volver a proyectos). `id` preseleccionado via `useLocalSearchParams`.

- [ ] **Step 2: Verificación manual + typecheck (5 min)**

```bash
npm run typecheck -w @comite/mobile
# Android: si hay un proyecto aprobado, seleccionar origen, completar y enviar cambio de título;
# si no hay aprobados, ver el mensaje de "No tienes proyectos aprobados".
```

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/cambiar-titulo.tsx"
git commit -m "feat(mobile): solicitud de cambio de título"
```

---

### Task 10: chat.service + Consultas

**Files:**
- Create: `apps/mobile/src/services/chat.service.ts`
- Modify: `apps/mobile/src/services/index.ts` (agregar `chatService`)
- Create: `apps/mobile/app/(app)/consultas.tsx`

**Interfaces:**
- Consumes: `request`, `MensajeChatDto`, `useApp`, `ApiError`.
- Produces: `chatService` (`getMiHilo`, `enviarComoSolicitante`, `misNoLeidos` — solo lado solicitante en alcance) y ruta `/(app)/consultas` (chat con secretaría, polling 4s).

- [ ] **Step 1: `src/services/chat.service.ts` — solo lado solicitante (2-5 min)**

```typescript
// src/services/chat.service.ts
import { request } from '../lib/http'
import type { MensajeChatDto } from '../types/api'

// Lado solicitante (investigador / estudiante_*)
export function getMiHilo(): Promise<MensajeChatDto[]> {
  return request<MensajeChatDto[]>('/chat/mios')
}
export function enviarComoSolicitante(texto: string): Promise<MensajeChatDto> {
  return request<MensajeChatDto>('/chat/mios', { method: 'POST', body: { texto } })
}
export function misNoLeidos(): Promise<{ noLeidos: number }> {
  return request('/chat/mios/no-leidos')
}
```

Actualizar `services/index.ts`: `export * as chatService from './chat.service'`.

- [ ] **Step 2: `consultas.tsx` — chat portado con polling y `FlatList`/`ScrollView` (2-5 min)**

Portar `apps/web/src/pages/Consultas.tsx` (móvil): estado `mensajes`, `texto`, `enviando`, `error`; `useEffect` con polling cada 4000ms (`chatService.getMiHilo`); `onSubmit` → `chatService.enviarComoSolicitante(contenido)` optimista; `esMio(m)` idéntico (usa `usuario?.id`); `hora(iso)` con `toLocaleTimeString('es-PE',...)`. Header propio "Secretaría técnica / En línea". Burbujas: `View` con estilo `me` (alineada derecha, fondo primary) / `them` (izquierda, fondo blanco). Input redondeado + botón enviar. Auto-scroll al final con `ref` de `ScrollView` (`scrollToEnd`) en cambio de `mensajes.length`. Usar `KeyboardAvoidingView`.

- [ ] **Step 3: Verificación manual + typecheck (5 min)**

```bash
npm run typecheck -w @comite/mobile
# Android: enviar un mensaje a secretaría, ver que aparece; el polling refresca el hilo.
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/services/chat.service.ts apps/mobile/src/services/index.ts "apps/mobile/app/(app)/consultas.tsx"
git commit -m "feat(mobile): chat.service (solicitante) y pantalla Consultas"
```

---

### Task 11: users.service + config.service + Perfil

**Files:**
- Create: `apps/mobile/src/services/users.service.ts`
- Create: `apps/mobile/src/services/config.service.ts`
- Modify: `apps/mobile/src/services/index.ts` (agregar `usersService`, `configService`)
- Create: `apps/mobile/app/(app)/perfil.tsx`

**Interfaces:**
- Consumes: `request`, DTOs, `useApp` (usuario, logout), `ROL_LABEL`, `ROLES_SOLICITANTE`, `expedientesService.list`, `useRouter`.
- Produces: `usersService` (`list`, `getById`, `create`, `update`, `deactivate`, `eliminarPermanente`, `evaluadoresDisponibles`), `configService` (`getFechaLimite`, `setFechaLimite`), y ruta `/(app)/perfil`.

- [ ] **Step 1: `src/services/users.service.ts` y `src/services/config.service.ts` — portados idénticos (2-5 min)**

Copiar textual de `apps/web/src/services/users.service.ts` y `config.service.ts` (solo cambian imports relativos). Actualizar `services/index.ts` con ambos.

- [ ] **Step 2: `perfil.tsx` — Perfil del solicitante portado (2-5 min)**

Portar `apps/web/src/pages/Perfil.tsx` (móvil, rama solicitante): `esSolicitante = ROLES_SOLICITANTE.includes(usuario.rol)` (siempre true en este corte); cargar `expedientesService.list()` → `totalRegistros` + `stats` (En revisión / Aprobados / Subsanación). NO portar la rama `evaluador` (usa `evaluacionService`, fuera de alcance) — simplificar a solo la rama solicitante. Filas de info (correo, código/laboratorio/especialidad si existen, proyectos registrados). Avatar grande con iniciales. Botón "Cerrar sesión" → `await logout()` → `router.replace('/login')`.

```tsx
// perfil.tsx (núcleo)
const { usuario, logout } = useApp()
const router = useRouter()
// useEffect: const proyectos = await expedientesService.list(); setTotalRegistros(proyectos.length); setStats([...])
async function cerrarSesion() { await logout(); router.replace('/login') }
```

- [ ] **Step 3: Verificación manual + typecheck (5 min)**

```bash
npm run typecheck -w @comite/mobile
# Android: Perfil muestra datos del usuario y stats; cerrar sesión regresa a Login y limpia el token.
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/services/users.service.ts apps/mobile/src/services/config.service.ts apps/mobile/src/services/index.ts "apps/mobile/app/(app)/perfil.tsx"
git commit -m "feat(mobile): users/config services y pantalla Perfil"
```

---

### Task 12: Verificación E2E final contra la API real (Android)

**Files:**
- Create: `apps/mobile/README.md` (instrucciones de arranque y variable `EXPO_PUBLIC_API_URL`)
- Create: `apps/mobile/.env.example` (`EXPO_PUBLIC_API_URL=http://10.0.2.2:8002`)

**Interfaces:**
- Consumes: toda la app.
- Produces: verificación de que los flujos del solicitante funcionan end-to-end en un dispositivo/emulador Android real contra la API (Supabase).

- [ ] **Step 1: `apps/mobile/.env.example` y README con nota de red Android (2-5 min)**

`EXPO_PUBLIC_API_URL`: en emulador Android, `localhost` del host es `10.0.2.2`; en dispositivo físico, la IP LAN de la máquina que corre `apps/api`. Documentarlo. Recordar que `.env`/`.env.*` ya están en `.gitignore` (solo se commitea `.env.example`).

```
# apps/mobile/.env.example
# Emulador Android: 10.0.2.2 apunta al localhost del host.
# Dispositivo físico: usar la IP LAN de la máquina que corre apps/api (ej. http://192.168.1.20:8002).
EXPO_PUBLIC_API_URL=http://10.0.2.2:8002
```

- [ ] **Step 2: Arrancar API + Expo y recorrer el checklist E2E (10-15 min)**

```bash
# Terminal 1: API real
npm run build -w @comite/shared
npm run dev -w @comite/api
# Terminal 2: Expo (Android)
npm run dev -w @comite/mobile   # abrir con 'a' (emulador) o escanear QR (Expo Go)
```

Checklist E2E (marcar cada uno):
- Registro de un nuevo solicitante → pantalla de éxito.
- Login → Dashboard con stats reales y countdown.
- Nuevo proyecto: crear borrador (se persiste en backend), avanzar wizard, enviar → código asignado real.
- Mis proyectos: aparece el nuevo, búsqueda y filtros funcionan; abrir detalle muestra checklist/historial reales.
- Enviar un borrador desde el detalle (si requisitos completos) responde correctamente.
- Cambiar título (si hay aprobado) crea y envía la solicitud.
- Consultas: enviar mensaje a secretaría, polling refresca.
- Perfil: datos correctos; cerrar sesión limpia SecureStore y vuelve a Login; reabrir la app queda en Login (token borrado).
- Sesión persistente: login, cerrar la app, reabrir → entra directo al Dashboard (token en SecureStore).
- 401: forzar token inválido → la app redirige a Login (handler `onUnauthorized`).

- [ ] **Step 3: `npm run typecheck` y `npm test` globales del monorepo (2-5 min)**

```bash
npm run typecheck   # turbo: no debe romper @comite/mobile ni el resto
npm test            # turbo: tests de mobile (mappers, documentFormats, ui) en verde
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/README.md apps/mobile/.env.example
git commit -m "docs(mobile): README, .env.example y verificación E2E Android"
```

---

## Self-review (autor del plan)

**Cobertura del spec (13 pantallas requeridas):** Login (T5), Registro (T5), RegistroExito (T5), Recuperar (T5), Dashboard (T6), NuevoProyecto (T8), NuevoProyectoExito (T8), Proyectos (T7), DetalleProyecto (T7), CambiarTitulo (T9), Consultas (T10), Perfil (T11), Acerca (T5). 13/13 cubiertas. Los 6 servicios del spec están: auth (T4/T5), notificaciones (T4), expedientes (T6), chat (T10), users + config (T11). `lib` (http, dates, mappers, documentFormats) en T2; `state` (AppContext, ConfirmContext) en T4. Scaffold + integración workspace/turbo en T1. Verificación E2E Android en T12.

**Escaneo de placeholders:** No hay "TBD"/"implementar después" sin código. Los `// TODO Fase posterior` son deliberados y acotados al único punto fuera de alcance declarado en el spec (subida real de archivos con cámara/galería), con la firma de servicio ya lista (`registrarDocumento(id, file: RNFile, opts)` + `uploadDocumento`). Coincide con "dejar la interfaz de servicios lista pero sin integrar expo-image-picker todavía".

**Consistencia de tipos/firmas:** Endpoints y payloads calcan `apps/web/src/services/*` verificados contra los archivos reales (`/auth/login` con `{username,password}`, `/users/me`, `/expedientes`, `/expedientes/:id/enviar`, `/chat/mios`, `/notificaciones/marcar-todas-leidas`, `/config/fecha-limite`, etc.). Los DTO se importan de `@comite/shared` vía `src/types/api.ts` (sin duplicar). Único cambio de firma intencional y propagado: token asíncrono (`getToken/setToken/clearToken → Promise`), reflejado en `http.request` (await), `auth.service.login/logout` (await), `AppContext.hidratar/logout` (await) y `Perfil.cerrarSesion` (await). `validarDocumento` cambia el parámetro de `File` (DOM) a `ArchivoValidable` (`{name,type?,size?}`) para RN, y `DocumentoCard`/wizards usan ese shape.

**Riesgos anotados para el ejecutor:** (1) Versiones exactas de Expo SDK: usar `npx create-expo-app`/`expo install` para fijar versiones compatibles si las del `package.json` divergen del SDK instalado. (2) `metro.config.js` monorepo: si `@comite/shared` no resuelve, verificar que su `dist` está compilado (`npm run build -w @comite/shared`) porque su `package.json` apunta a `./dist/cjs`. (3) Rutas de expo-router con grupo `(app)`: `router.push('/(app)/...')` — validar con `typedRoutes` activado.

## Critical Files for Implementation
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\lib\http.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\services\expedientes.service.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\state\AppContext.tsx
- C:\Users\montu\Desktop\proyectos-uch\comite\apps\web\src\lib\mappers.ts
- C:\Users\montu\Desktop\proyectos-uch\comite\package.json