# Credenciales de prueba — Comité de Ética UCH

> Datos de la base **demo** (Neon). El proyecto es una propuesta, no hay datos reales:
> se puede crear, editar y borrar sin cuidado.

## Cuentas

**La contraseña de todas es `password`.**

| Rol | Correo | Nombre | Qué ve / puede hacer |
|---|---|---|---|
| Estudiante de pregrado | `pregrado@uch.edu.pe` | Pamela Pregrado | Envía proyectos, sube documentos, subsana, chatea con secretaría, descarga su dictamen |
| Estudiante de postgrado | `postgrado@uch.edu.pe` | Pablo Postgrado | Igual que pregrado, con campos de nivel de posgrado |
| Investigador (docente) | `investigador@uch.edu.pe` | Ivan Investigador | Igual que los anteriores, modalidad interna (solo 1 documento requerido) |
| Secretaría técnica | `secretaria@uch.edu.pe` | Sofia Secretaria | Bandeja de expedientes, revisión documental, pide subsanación, mensajería |
| Coordinador | `coordinador@uch.edu.pe` | Carlos Coordinador | Panel del comité y asignación de evaluador |
| Evaluador | `evaluador@uch.edu.pe` | Elena Evaluadora | Bandeja de evaluaciones, rúbrica de 7 criterios y **asistente de IA** |
| Administrador | `admin@uch.edu.pe` | Andrea Admin | Usuarios, reportes con gráficos y configuración del sistema |

El código de estudiante de Pamela es `25115013` (los códigos UCH son numéricos de 8 dígitos).

## Expedientes sembrados

Cubren todos los estados del flujo, para no tener que armarlos a mano:

| Código | Estado | Modalidad | Solicitante |
|---|---|---|---|
| — | Borrador | Pregrado | Pamela Pregrado |
| — | Borrador | Interno | Ivan Investigador |
| 1-2026 | Enviado | Pregrado | Pamela Pregrado |
| 2-2026 | En revisión | Postgrado | Pablo Postgrado |
| 3-2026 | Subsanación | Pregrado | Pamela Pregrado |
| 4-2026 | Aprobado | Interno | Ivan Investigador |
| 5-2026 | Aprobado con observaciones | Pregrado | Pamela Pregrado |
| 6-2026 | No aprobado | Postgrado | Pablo Postgrado |

**El 2-2026 es el bueno para probar el asistente de IA**: es la única evaluación
pendiente de Elena, así que la rúbrica está vacía y el botón "Analizar con IA" sirve.
Los demás ya están completados.

Qué PDF existe según el resultado: aprobado → solo dictamen; aprobado con
observaciones → rúbrica y dictamen; no aprobado → solo rúbrica.

## Cómo levantar

```bash
npm run build -w @comite/shared     # solo si tocaste packages/shared
npm run dev -w @comite/api          # API en http://localhost:8002
npm run dev -w @comite/web          # Web en http://localhost:5173
```

App móvil (con el emulador ya abierto, o con Expo Go en el celular en la misma red):

```bash
cd apps/mobile && npx expo start --android
```

El móvil apunta a la API por `EXPO_PUBLIC_API_URL` en `apps/mobile/.env`. Hoy es
`http://192.168.100.221:8002` — **si cambia la IP del PC hay que actualizarla ahí**,
porque el celular no puede usar `localhost`.

Emulador: hay un solo AVD, `Pixel_6_Pro`. Arranca en GMT, así que las fechas salen un
día adelantadas; se corrige con `adb root` y luego
`adb shell setprop persist.sys.timezone America/Lima`.

## Umbrales de la rúbrica

Total 20 puntos, 7 criterios. **0–12** No aprobado · **13–16** Aprobado con
observaciones · **17–20** Aprobado.
