# Sistema del Comité de Ética — UCH

Plataforma para gestionar la evaluación ética de proyectos de investigación de la
Universidad de Ciencias y Humanidades: desde que un estudiante o investigador
envía su proyecto, hasta que el Comité emite un dictamen final.

Es una reescritura, en un stack moderno, del sistema original (`comite/backend`
en Python/FastAPI + `comite/frontend` en Next.js), manteniendo la misma lógica
de negocio y conectado a la misma base de datos real.

## Tecnologías usadas

**Frontend** (`client/`)
- React 18 + Vite + TypeScript
- React Router para la navegación
- CSS plano (sin framework de UI), con un layout dual: vista compacta para
  celular/tablet y vista de escritorio con sidebar, a partir de los 1024px
- Gráficos de barras hechos a mano en SVG/CSS (sin librería de charts)

**Backend** (`server/`)
- NestJS + TypeScript
- Prisma como ORM, contra PostgreSQL
- Autenticación con JWT (`@nestjs/jwt`) + contraseñas hasheadas con bcrypt
- PDFKit para generar los PDF de rúbrica y dictamen de cada evaluación

**Infraestructura / servicios externos**
- **Supabase** — base de datos PostgreSQL, y también Supabase Storage
  (compatible con S3) para los documentos que suben los investigadores
- **Resend** — envío real de correos transaccionales (resultado de
  evaluación, recuperación de contraseña)

## Funcionalidad por rol

**Estudiante / Investigador**
- Enviar un nuevo proyecto (datos + documentos requeridos según modalidad:
  pregrado, posgrado o investigador)
- Ver el estado y checklist documental de sus proyectos, con historial de
  cambios de estado
- Subsanar observaciones cuando el Comité lo solicita
- Solicitar cambio de título de un proyecto ya aprobado
- Chat directo con la secretaría técnica
- Recuperar su contraseña por correo (código de verificación de 6 dígitos)

**Secretaría técnica**
- Bandeja de expedientes pendientes de gestión, con búsqueda y filtro por
  fecha
- Revisar un expediente (ver/descargar cada documento) y admitirlo o
  devolverlo para subsanación
- Chat con cada solicitante (ve código de estudiante, tipo y correo)

**Coordinador**
- Panel con expedientes en revisión, listos para asignar evaluador
- Asignación a un evaluador, con indicador en vivo de cuántos casos
  pendientes tiene cada uno (para repartir la carga)

**Evaluador**
- Bandeja de evaluaciones asignadas
- Formulario de evaluación por rúbrica (7 criterios, puntaje 0-20), con
  resultado (Aprobado / Aprobado con observaciones / No aprobado) calculado
  automáticamente en vivo según el puntaje
- Resumen del expediente, datos del investigador y documentos con vista
  previa y descarga
- Declarar conflicto de interés
- Al enviar la evaluación: se generan los PDF de rúbrica y dictamen, y se
  envía un correo automático al investigador con el resultado

**Administrador**
- Gestión de usuarios internos (crear, editar rol/estado, desactivar o
  eliminar de forma permanente si la cuenta no tiene historial), con
  búsqueda y filtros
- Reportes con gráficos (expedientes por estado, carga por evaluador,
  resultados emitidos) y exportación a PDF (listados y reporte con gráficos)
- Configuración general del sistema

## Credenciales de prueba

Todas las cuentas demo usan la misma contraseña: `password`.

| Rol | Correo |
|---|---|
| Investigador | investigador@uch.edu.pe |
| Estudiante de pregrado | pregrado@uch.edu.pe |
| Estudiante de posgrado | postgrado@uch.edu.pe |
| Secretaría técnica | secretaria@uch.edu.pe |
| Coordinador | coordinador@uch.edu.pe |
| Evaluador | evaluador@uch.edu.pe |
| Administrador | admin@uch.edu.pe |

> Son cuentas de prueba en la misma base de datos real (Supabase). No son
> credenciales para producción — antes de que usuarios reales usen el
> sistema, hay que crear cuentas propias y considerar desactivar o eliminar
> estas.

## Cómo correrlo en local

Requiere Node.js y las variables de entorno reales (`server/.env`,
`client/.env` — no se versionan, contienen credenciales de Supabase/Resend).

```bash
# Backend (puerto 8002)
cd server
npm install
npm run start:dev

# Frontend (puerto 5173 o el siguiente libre)
cd client
npm install
npm run dev
```
