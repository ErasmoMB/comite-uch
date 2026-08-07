# Datos técnicos extraídos del sistema — Comité de Ética UCH

Fuente: código del repo `C:\Users\montu\Desktop\proyectos-uch\comite` (monorepo `apps/api` NestJS+Prisma, `apps/web` React+Vite) y consulta en vivo a la base de datos de producción, realizada el 2026-07-18 (entonces Supabase Postgres; desde el 2026-08-06 la base es Neon Postgres 17 y el almacenamiento Cloudflare R2). Todo lo que sigue viene de código/BD real, sin encuestar a nadie.

---

## 1. Roles del sistema y sus permisos

### 1.1 Los roles reales (fuente de verdad: `packages/shared/src/types.ts:1-9`)

El campo `rol` en BD es `VARCHAR(50)` libre (no un enum de Postgres); el tipo TS `RolBackend` admite 8 valores:

```
'administrador' | 'coordinador' | 'secretaria' | 'evaluador' |
'estudiante_pregrado' | 'estudiante_postgrado' | 'investigador' | 'estudiante'
```

**Se confirman 4 roles internos "del comité"** (no 5):
- `administrador`
- `coordinador`
- `secretaria`
- `evaluador`

**Más 3 roles auto-registrables** (`ROLES_AUTO_REGISTRO`, `apps/api/src/auth/constants.ts:5-9`) que comparten la misma vista funcional de "solicitante": `estudiante_pregrado`, `estudiante_postgrado`, `investigador`.

**Más 1 valor legado:** `estudiante` — aparece en `ROLES_SOLICITANTE` (`packages/shared/src/constants.ts:13-18`) y en las rutas protegidas del frontend, pero ya **no** está en `ROLES_AUTO_REGISTRO`, es decir, no se puede crear un usuario nuevo con ese rol; solo queda por datos preexistentes de la migración desde el backend Python anterior.

### 1.2 Mecanismo de autorización

- `apps/api/src/auth/roles.decorator.ts` — decorador `@Roles(...roles)`.
- `apps/api/src/auth/roles.guard.ts` — `RolesGuard`: si el endpoint tiene `@Roles`, exige que `user.rol` esté en la lista; si no tiene metadata, deja pasar (la autorización queda delegada al service).
- `apps/api/src/auth/jwt.strategy.ts:16-20` — el JWT solo contiene el `id` del usuario; el `rol` se relee de la BD en cada request, así que un cambio de rol hecho por un administrador aplica de inmediato, sin esperar a que expire el token.

### 1.3 Matriz de permisos por módulo

| Módulo | Endpoint | Quién puede |
|---|---|---|
| Auth | `POST /auth/register` | Público, pero rechaza (403) cualquier rol fuera de los 3 auto-registrables |
| Auth | `POST /auth/login`, recuperar contraseña | Público |
| Users | `GET /users`, `/users/me`, `/users/:id` | Cualquier autenticado |
| Users | `POST /users` (crear, incl. roles internos) | Solo `administrador` |
| Users | `PUT /users/:id` | El propio usuario o `administrador`; solo el admin puede cambiar `rol`/`activo` de otro |
| Users | `DELETE /users/:id` (soft) / `.../permanente` | Solo `administrador`; el borrado permanente exige que el usuario objetivo tenga un rol interno |
| Expedientes | `GET /expedientes` (listar) | `administrador`, `coordinador`, `secretaria` ven todos; el resto solo lo propio |
| Expedientes | Editar / subir documentos / enviar | Solo el dueño (investigador del expediente) |
| Expedientes | Descargar documento | Dueño, o `evaluador` con evaluación asignada a ese expediente |
| Evaluación | `POST /evaluacion`, `.../asignar` | Solo `administrador`, `coordinador` (regla dura: 1 solo evaluador por expediente) |
| Evaluación | `PUT /evaluacion/:id` (calificar) | Solo el evaluador asignado, o `administrador` |
| Evaluación | `GET /evaluacion/mis-evaluaciones` | Solo `evaluador` |
| Chat | `/chat/mios*` (lado solicitante) | `estudiante_pregrado`, `estudiante_postgrado`, `investigador` (el legado `estudiante` queda fuera de este decorador — inconsistencia menor detectada) |
| Chat | `/chat/conversaciones`, `/chat/:solicitanteId`, etc. | `secretaria`, `administrador` |
| Reportes | `expedientes-por-estado`, `tiempos-atencion`, `carga-evaluadores`, `resultados-emitidos` | Cualquier autenticado |
| Reportes | `/reportes/resumen`, `/exportar*` | Solo `administrador`, `coordinador`, `secretaria` |
| Config | `GET /config/fecha-limite` | Cualquier autenticado |
| Config | `PUT /config/fecha-limite` | Solo `administrador` |
| Plantillas | `GET /plantillas/*` | Público (sin autenticación) |

El frontend (`apps/web/src/App.tsx`) replica esta segmentación por rol a nivel de rutas (`RutaProtegida roles={[...]}`) como defensa en profundidad, redirigiendo tras login a un home distinto por rol (`homePathForRole()`).

---

## 2. Arquitectura técnica

### 2.1 Stack (versiones exactas de `package.json`)

**Backend** (`apps/api`, NestJS):
- NestJS `^11.0.1`, Prisma ORM `^6.19.3` sobre PostgreSQL
- Autenticación: `@nestjs/jwt` + Passport (estrategia JWT Bearer) + `bcrypt ^6.0.0` (costo 12)
- Almacenamiento: `@aws-sdk/client-s3` contra el endpoint S3-compatible de **Cloudflare R2**
- Email transaccional: **Resend** (`resend ^6.17.1`)
- Generación de PDF: `pdfkit ^0.19.1`
- Validación: `class-validator` / `class-transformer`
- Tests: Jest (unit + e2e)

**Frontend** (`apps/web`, descrito en su propio `package.json` como *"App móvil del solicitante"*):
- React `^18.3.1` + React Router DOM `^6.30.0`
- Vite `^5.4.11` (sin Next.js, sin CSS framework)
- Estado global con Context API propio (sin Redux/Zustand)

**Compartido:** `packages/shared` — tipos TS y constantes de negocio (roles, catálogos, criterios de rúbrica, umbrales) usadas por ambos, evitando duplicar reglas entre frontend y backend.

Monorepo con **Turborepo** + npm workspaces.

### 2.2 Capas

- **Backend:** organización por módulo de dominio de Nest (`auth`, `users`, `expedientes`, `evaluacion`, `chat`, `notificaciones`, `reportes`, `config`, `plantillas`, `email`, `storage`, `pdf`, `prisma`). Cada módulo trae `controller` (rutas HTTP) + `service` (lógica de negocio y autorización fina) + `dto`. Sin capa de repositorio explícita: los services llaman directo a Prisma Client.
- **Frontend:** SPA por páginas agrupadas por rol (`pages/admin`, `pages/coordinador`, `pages/evaluador`, `pages/secretaria`, raíz = solicitante), una capa de `services/` por dominio que envuelve las llamadas HTTP, y un cliente HTTP central (`lib/http.ts`) con manejo de token y logout automático en 401.

### 2.3 Base de datos

PostgreSQL 17 en **Neon** (el schema de Prisma se generó por introspección real de la base que usaba un backend Python/FastAPI previo, no al revés). 12 tablas — ver sección 3.

### 2.4 Almacenamiento, email y autenticación

- **Storage:** Cloudflare R2 vía API S3-compatible (bucket `comite-etica-documentos`, región lógica `auto`, `forcePathStyle` porque R2 exige direccionamiento por path).
- **Email:** Resend; si no hay `RESEND_API_KEY` configurada, cae a un modo simulado por log (no rompe el flujo).
- **Auth:** login por email+password (bcrypt), recuperación de contraseña con OTP de 6 dígitos hasheado, expira en 15 min, un solo uso.

### 2.5 Deploy

Single web service (confirmado en comentario de `apps/api/src/main.ts`): el mismo proceso Nest sirve la API y el build estático de `apps/web/dist`, con un filtro (`SpaFallbackFilter`) que distingue un 404 de negocio real de una ruta de la SPA que debe caer a `index.html`. Diseñado explícitamente para desplegarse como un único servicio (en la práctica, Render).

### 2.6 Flujo de datos típico

1. Solicitante crea expediente y sube documentos → van a Cloudflare R2.
2. Envío formal (`POST /expedientes/:id/enviar`): valida dueño, fecha límite, completitud de documentos requeridos; asigna código único anual y cambia estado a `enviado`.
3. Coordinador/administrador asigna 1 evaluador (regla dura, no admite un segundo).
4. Evaluador califica con rúbrica de 7 criterios → se calcula puntaje total y resultado (umbrales: 0-12 no aprobado, 13-16 aprobado con observaciones, 17-20 aprobado) → cambia el estado del expediente.
5. Se generan automáticamente los PDF correspondientes (rúbrica y/o dictamen según el resultado) con `pdfkit` y se suben a Storage.
6. Se envía email con Resend a los autores del expediente con los PDF adjuntos.
7. Todo queda auditado en `bitacora` (log de acciones) e `historial_expediente` (transiciones de estado); el solicitante ve además una notificación in-app.

---

## 3. Modelos de la base de datos (`apps/api/prisma/schema.prisma`, 11 tablas)

| Tabla | Para qué sirve |
|---|---|
| `Configuracion` | Config clave-valor genérica (hoy: fecha límite global de envíos) |
| `User` | Usuarios de todos los roles, con campos específicos por rol (especialidad/carga de trabajo del evaluador, código de estudiante, laboratorio del investigador, flag de cuenta activa) |
| `PasswordResetCode` | Códigos OTP de recuperación de contraseña |
| `Expediente` | El protocolo/proyecto de investigación sometido a evaluación ética — núcleo del dominio (tipo de trámite, modalidad, estado del ciclo de vida) |
| `AutorExpediente` | Autores/coautores de un expediente |
| `Documento` | Archivos adjuntos de un expediente (proyecto, solicitud, carta de aprobación, boleta de pago, etc.) |
| `Evaluacion` | La evaluación ética de un expediente por el evaluador asignado (recomendación, puntaje, resultado, rutas de los PDF generados) |
| `EvaluacionCriterio` | Desglose por criterio de la rúbrica (7 criterios) |
| `Notificacion` | Notificaciones in-app por usuario |
| `MensajeChat` | Chat de soporte solicitante ↔ secretaría |
| `Bitacora` | Log de auditoría de acciones sobre un expediente |
| `HistorialExpediente` | Historial de transiciones de estado de un expediente |

---

## 4. Datos cuantitativos reales (consulta en vivo a producción, 2026-07-18)

> Extraídos directamente de la base de datos de producción vía Prisma, no de una encuesta.

- **Usuarios:** 8 en total (uno por cada uno de los 7 roles del comité/demo + 1 registro adicional real).
  - 7 cuentas fueron creadas el mismo día (2026-06-27), consistente con la siembra inicial (demo/pruebas) de una por rol.
  - **1 registro adicional real**, de rol `estudiante_pregrado`, creado el **2026-07-14** — es decir, hay evidencia de al menos un usuario que se auto-registró usando el sistema en producción, más allá de las cuentas demo.
- **Expedientes gestionados:** 6 en total.
  - Por modalidad: 4 `interno`, 2 `pregrado`.
  - Por estado: 3 `aprobado`, 2 `en_revision`, 1 `enviado`.
  - Rango de fechas de creación: **2026-07-05 a 2026-07-14**.
- **Evaluaciones completadas:** 3, todas con resultado `aprobado`.
- **Documentos subidos:** 14 (6 `proyecto_pdf`, 2 `proyecto_word`, 2 `boleta_pago`, 2 `carta_aprobacion`, 2 `solicitud_evaluacion`).
- **Entradas de bitácora (auditoría):** 48, con actividad entre **2026-07-05 y 2026-07-16**.
- **Mensajes de chat (solicitante↔secretaría):** 10.
- **Notificaciones in-app generadas:** 3.
- **Configuración activa:** fecha límite de envíos = `2026-12-25`.

**Nota de interpretación:** el volumen es bajo porque el sistema recién se desplegó a producción (single web service en Render) el 2026-07-13, según el historial de trabajo del proyecto — estos números reflejan un sistema recién lanzado, no un uso consolidado de meses. Sirve como evidencia de que el flujo funciona de punta a punta en producción real (no solo en pruebas), pero no como muestra estadísticamente robusta de uso.

---

## 5. Lo que NO se pudo extraer del código/BD (limitaciones)

- **Logs de acceso, tiempos de respuesta del servidor, uptime:** no están disponibles porque el hosting es Render (plan free) y no hay una integración de logging/métricas persistida en este repo ni acceso directo a los logs del servidor desde esta sesión. Si se necesitan para el paper, hay que sacarlos del dashboard de Render (Logs/Metrics) directamente.
- **User-agent / tipo de dispositivo en accesos:** no se loggea en el código actual (ni backend ni frontend registran esta información) — no aplica a este paper según lo indicado.
