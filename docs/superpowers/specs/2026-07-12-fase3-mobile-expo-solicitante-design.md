# Fase 3 — App móvil Expo, rol Solicitante

**Fecha:** 2026-07-12
**Estado:** Diseño aprobado, pendiente de plan de implementación

## Contexto

El monorepo `comite/` (Turborepo + npm workspaces) tiene hoy `apps/api`
(NestJS + Prisma, contra Supabase) y `apps/web` (React + Vite, los 5 roles:
Solicitante, Secretaría, Coordinador, Evaluador, Admin), ambos verificados
funcionando end-to-end contra datos reales (2026-07-12: login, dashboard,
nuevo proyecto y mis proyectos probados en navegador sin errores).

El plan original de fases contemplaba una Fase 3 de "app móvil Expo,
portando todas las pantallas". Se decidió acotar el alcance real de este
primer corte tras discutir trade-offs (ver más abajo).

## Decisión de arquitectura: apps separadas, no Expo universal

Se evaluó si convenía que Expo sirviera también la versión web (reemplazando
`apps/web`, un solo código para Web+Android+iOS vía `react-native-web`).
**Se descartó para este proyecto**: los roles internos (Secretaría,
Coordinador, Evaluador, Admin) usan tablas densas, columnas redimensionables
y reportes con gráficos — un uso de escritorio que no se beneficia de un
paradigma mobile-first, y forzarlo a `react-native-web` habría significado
rehacer trabajo que ya funciona hoy, con riesgo de regresión y sin beneficio
real para el usuario.

**Decisión:** `apps/web` se queda exactamente como está (no se toca).
`apps/mobile` es una app Expo nueva y separada, que comparte `@comite/shared`
y consume la misma API (`apps/api`), pero con su propia UI construida desde
cero para consumo por celular.

(Nota: esta discusión general — cuándo conviene Expo universal desde el día
1 vs. apps separadas — quedó documentada como guía aparte en
`C:\Users\montu\Documents\monorepo-node-fullstack.md`, sección 3.5, para
referencia en proyectos futuros. No aplica 1:1 aquí porque este proyecto ya
tiene un `apps/web` funcionando, no es un proyecto nuevo desde cero.)

## Alcance de este primer corte

**Solo rol Solicitante/Investigador** (incluye los 3 sub-roles auto-registrables:
`estudiante_pregrado`, `estudiante_postgrado`, `investigador` — comparten la
misma vista, igual que en `apps/web`). Es el rol con más sentido para
celular: subir fotos/documentos, revisar el estado de un trámite desde
cualquier lado.

**Pantallas a portar** (equivalentes 1:1 a `apps/web/src/pages/*.tsx`):
Login, Registro, RegistroExito, Recuperar (contraseña), Dashboard,
NuevoProyecto (wizard), NuevoProyectoExito, Proyectos (mis proyectos),
DetalleProyecto, CambiarTitulo, Consultas (chat con secretaría), Perfil,
Acerca.

**Explícitamente fuera de alcance de este corte:**
- Los otros 4 roles (Secretaría, Coordinador, Evaluador, Admin) — quedan
  para fases posteriores sobre la base que deje armada este corte.
- iOS (se apunta solo a Android por ahora; Expo deja la puerta abierta a
  agregarlo después sin rehacer nada).
- Subida de documentos con cámara/galería nativa — se deja la interfaz de
  servicios lista para conectarla, pero la integración real de
  `expo-image-picker`/`expo-document-picker` se implementa en un paso
  posterior.
- Notificaciones push.

## Decisiones técnicas

| Decisión | Elección | Razón |
|---|---|---|
| Navegación | **Expo Router** (file-based) | Estándar actual de Expo; conceptualmente similar a `react-router-dom` ya usado en `apps/web` (rutas = archivos) |
| Sesión / token | **`expo-secure-store`** | Equivalente cifrado de `localStorage` (`TOKEN_KEY` en `apps/web/src/lib/http.ts`), pero seguro en el dispositivo |
| UI | **Componentes propios con `StyleSheet`**, sin librería de UI | `apps/web` tampoco usa framework de UI (CSS plano) — se mantiene la misma filosofía minimalista, cero dependencias nuevas grandes |
| Networking | Fetch wrapper propio, mismo patrón que `apps/web/src/lib/http.ts` (adaptado a RN) | Mismo modelo mental, sin introducir axios/react-query |
| `@comite/shared` | Se reutiliza **tal cual**, sin cambios | Verificado: `types.ts`/`constants.ts` son TS puro; `utils.ts` solo usa `Date`/`toLocaleTimeString` (soportado en Hermes) — 100% portable a RN |

## Estructura de `apps/mobile/`

Ver estructura completa y aprobada en el plan de exploración
(`C:\Users\montu\.claude\plans\quirky-marinating-bunny.md`), resumen:

```
apps/mobile/
├── app/                    ← rutas Expo Router
│   ├── _layout.tsx
│   ├── login.tsx, registro.tsx, registro-exito.tsx, recuperar.tsx, acerca.tsx
│   └── (app)/              ← grupo protegido (requiere sesión)
│       ├── _layout.tsx     ← guarda de sesión + tab bar
│       ├── index.tsx       ← Dashboard
│       ├── proyectos/{index,[id]}.tsx
│       ├── nuevo/{index,exito}.tsx
│       ├── cambiar-titulo.tsx, consultas.tsx, perfil.tsx
├── src/
│   ├── components/         ← UI propia (RN + StyleSheet)
│   ├── services/           ← mapeo 1:1 de apps/web/src/services (auth, expedientes, chat, notificaciones, config, users)
│   ├── lib/                ← http.ts, dates.ts, documentFormats.ts, mappers.ts
│   └── state/              ← AppContext.tsx, ConfirmContext.tsx
├── assets/
├── app.json, eas.json, package.json, tsconfig.json
```

`services/`, `lib/`, `state/` calcan la organización de `apps/web/src` —
mismo nombre de archivo, misma responsabilidad, solo cambia la
implementación interna (RN en vez de DOM/browser fetch).

## Testing

Seguir el mismo criterio que el resto del monorepo: verificación E2E real
(no solo tipos/build) antes de dar por completo cada bloque de pantallas —
usando un emulador/dispositivo Android real contra la API real (Supabase),
igual que se hizo hoy con `apps/web` vía Playwright.

## Pendiente antes de implementar

Este spec cubre el diseño de alto nivel. El detalle de tareas concretas
(orden de implementación, un plan por pantalla o por bloque funcional) se
define en el plan de implementación (`writing-plans`), próximo paso.
