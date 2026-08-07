# Datos para Paper 2 — Usabilidad móvil del Sistema del Comité de Ética UCH

Fuente de los datos cuantitativos de usabilidad: `sus_respuestas.csv` y `sesiones_tarea.csv` (aportados por el usuario, originalmente en `Downloads/`), procesados el 2026-07-19 con la fórmula estándar de SUS y agregaciones directas sobre los registros de tarea. n=120 participantes, 480 intentos de tarea (120 × 4 tareas).

---

## 1. Nombre del sistema y stack técnico

**Nombre:** Sistema del Comité de Ética — UCH (plataforma para gestionar la evaluación ética de proyectos de investigación de la Universidad de Ciencias y Humanidades, desde el envío del proyecto hasta el dictamen final del Comité).

**Stack:**
- **Frontend:** React 18 + Vite + TypeScript, React Router, CSS plano (sin framework UI), con **layout dual**: vista compacta para celular/tablet y vista de escritorio con sidebar (breakpoint 1024px). Gráficos hechos a mano en SVG/CSS.
- **Backend:** NestJS + TypeScript, Prisma ORM sobre PostgreSQL, autenticación JWT (`@nestjs/jwt`) + bcrypt, PDFKit para generar PDF de rúbrica y dictamen.
- **Base de datos:** PostgreSQL 17 en **Neon**.
- **Almacenamiento:** Cloudflare R2 (compatible S3) para los documentos subidos por los investigadores.
- **Email transaccional:** **Resend** (resultado de evaluación, recuperación de contraseña).
- **Hosting/deploy:** single web service (el mismo proceso Nest sirve la API y el build estático del frontend).

> ⚠️ **A confirmar antes de redactar el paper:** el repo tiene una vista web responsive (`apps/web`, la descrita arriba) **y además** una app nativa aparte hecha con Expo/React Native (`apps/mobile`, construida para los 7 roles). Los CSV de usabilidad no indican cuál de las dos interfaces se probó. Para IJIM esto importa: si fue la web responsive vista desde el navegador del celular, es "mobile web" (igual válido para su scope); si fue la app nativa instalada, es "mobile app". Hay que aclarar cuál se usó en el método del paper.

---

## 2. Los roles evaluados y las tareas por rol

Los datos entregados usan **5 etiquetas de rol** (no necesariamente idénticas a los 4 roles internos + 3 auto-registrables del sistema real — ver nota al final de esta sección):

| Rol (como viene en los datos) | n participantes | Tareas evaluadas (T1–T4) |
|---|---|---|
| **Estudiante** | 85 | T1: Crear un nuevo expediente de investigación · T2: Subir el consentimiento informado al expediente · T3: Consultar el estado del expediente · T4: Responder un mensaje del chat con el asesor |
| **Investigador** | 24 | T1: Subir un documento nuevo al expediente · T2: Consultar el estado de mi expediente · T3: Responder un mensaje del chat con la secretaría · T4: Descargar un documento aprobado |
| **Evaluador** | 6 | T1: Calificar la rúbrica de un expediente · T2: Responder un mensaje del chat con un investigador · T3: Revisar los comentarios de otro evaluador · T4: Enviar la evaluación final |
| **Miembro del Comité** | 4 | T1: Revisar un expediente asignado para evaluación · T2: Responder un mensaje del chat con la secretaría · T3: Consultar el historial de un expediente · T4: Descargar un documento adjunto |
| **Coordinador** | 1 | T1: Revisar y aprobar un expediente enviado · T2: Responder un mensaje del chat · T3: Actualizar el estado de un expediente · T4: Buscar un expediente usando filtros |

> ⚠️ **"Miembro del Comité" no es una etiqueta que exista en el sistema real** (los roles internos reales son `administrador`, `coordinador`, `secretaria`, `evaluador`). Sus tareas (revisar expediente asignado, historial, documentos adjuntos, chat con secretaría) se parecen a las de **secretaría**, pero el CSV no lo dice explícitamente — hay que confirmar con quien diseñó/aplicó las pruebas a qué rol real corresponde antes de nombrarlo así en el paper.
>
> ⚠️ **Tamaños de muestra muy desiguales.** Estudiante (85) e Investigador (24) tienen una n razonable; **Evaluador (6), Miembro del Comité (4) y sobre todo Coordinador (n=1) son muestras exploratorias**, no estadísticamente representativas — un solo participante no permite calcular variabilidad ni generalizar. Para el paper, considerar reportar estos 3 grupos como hallazgos cualitativos/preliminares, no como comparación estadística formal con los otros dos.

---

## 3. Datos reales de usabilidad

### 3.1 Puntajes SUS por rol (escala 0–100, fórmula estándar de Brooke 1986)

| Rol | n | SUS medio | Desv. estándar |
|---|---|---|---|
| Estudiante | 85 | 49.0 | 22.1 |
| Investigador | 24 | 48.6 | 23.8 |
| Evaluador | 6 | 47.9 | 21.0 |
| Miembro del Comité | 4 | 60.6 | 4.1 |
| Coordinador | 1 | 97.5 | — (n=1) |
| **General** | **120** | **49.7** | **22.5** |

### 3.2 Puntajes SUS por dispositivo

| Dispositivo | n | SUS medio | Desv. estándar |
|---|---|---|---|
| Teléfono celular | 94 | 51.0 | 23.4 |
| Tablet | 26 | 44.8 | 18.1 |

### 3.3 Puntajes SUS por rol × dispositivo

| Rol | Dispositivo | n | SUS medio |
|---|---|---|---|
| Estudiante | Teléfono celular | 63 | 50.7 |
| Estudiante | Tablet | 22 | 44.2 |
| Investigador | Teléfono celular | 22 | 48.1 |
| Investigador | Tablet | 2 | 55.0 |
| Evaluador | Teléfono celular | 5 | 53.0 |
| Evaluador | Tablet | 1 | 22.5 |
| Miembro del Comité | Teléfono celular | 3 | 60.8 |
| Miembro del Comité | Tablet | 1 | 60.0 |
| Coordinador | Teléfono celular | 1 | 97.5 |

> **Referencia de interpretación (Bangor et al. 2009):** el promedio de la industria para SUS ronda **68**. El promedio general obtenido aquí (**49.7**) queda por debajo de ese umbral, en el rango que la literatura suele calificar como "usabilidad pobre/marginal" — es un hallazgo real a discutir en el paper (posible oportunidad de mejora en la experiencia móvil), no solo un dato de relleno.

### 3.4 Tiempos de tarea (segundos) por rol y por dispositivo

Tiempo promedio de las tareas **completadas** (`avgTime completado`) vs. promedio incluyendo también intentos abandonados (`avgTime todos los intentos`):

| Agrupación | n intentos | Tiempo medio (completadas) | Tiempo medio (todos) |
|---|---|---|---|
| **Por rol** | | | |
| Estudiante | 340 | 118.9 s | 117.2 s |
| Investigador | 96 | 77.9 s | 76.3 s |
| Evaluador | 24 | 124.0 s | 118.0 s |
| Miembro del Comité | 16 | 96.8 s | 94.1 s |
| Coordinador | 4 | 86.3 s | 86.3 s |
| **Por dispositivo** | | | |
| Teléfono celular | 376 | 111.9 s | 109.2 s |
| Tablet | 104 | 102.1 s | 103.8 s |
| **Por rol × dispositivo** | | | |
| Estudiante / Celular | 252 | 123.8 s | 120.5 s |
| Estudiante / Tablet | 88 | 105.8 s | 107.6 s |
| Investigador / Celular | 88 | 79.7 s | 77.8 s |
| Investigador / Tablet | 8 | 59.9 s | 59.9 s |
| Evaluador / Celular | 20 | 124.0 s | 116.8 s |
| Evaluador / Tablet | 4 | 124.0 s | 124.0 s |
| Miembro del Comité / Celular | 12 | 100.2 s | 96.3 s |
| Miembro del Comité / Tablet | 4 | 87.5 s | 87.5 s |
| Coordinador / Celular | 4 | 86.3 s | 86.3 s |

**Detalle por tarea específica (T1–T4), agregado en todos los roles:**

| Tarea | n | % completado | % abandono | Tiempo medio (completadas) | Errores medios |
|---|---|---|---|---|---|
| T1 (tarea de creación/revisión inicial) | 120 | 94.2% | 2.5% | 204.9 s | 1.08 |
| T2 (subir doc. / responder chat) | 120 | 90.0% | 7.5% | 101.4 s | 1.01 |
| T3 (consultar estado / historial) | 120 | 95.0% | 4.2% | 71.1 s | 0.97 |
| T4 (responder / descargar / enviar) | 120 | 90.8% | 5.0% | 59.7 s | 0.97 |

*(Nota: T1–T4 significan cosas distintas según el rol — ver la tabla de la sección 2 para el enunciado exacto de cada tarea por rol.)*

### 3.5 Tasa de error y tasa de abandono por rol y dispositivo

| Rol | n intentos | % completado | % abandono | Errores promedio/intento |
|---|---|---|---|---|
| Estudiante | 340 | 91.8% | 5.3% | 1.01 |
| Investigador | 96 | 94.8% | 3.1% | 0.98 |
| Evaluador | 24 | 91.7% | 4.2% | 1.13 |
| Miembro del Comité | 16 | 93.8% | 6.3% | 1.13 |
| Coordinador | 4 | 100.0% | 0.0% | 0.25 |

| Dispositivo | n intentos | % completado | % abandono | Errores promedio/intento |
|---|---|---|---|---|
| Teléfono celular | 376 | 91.5% | 5.3% | 1.06 |
| Tablet | 104 | 96.2% | 2.9% | 0.84 |

**Rol × dispositivo:**

| Rol | Dispositivo | n intentos | % completado | % abandono |
|---|---|---|---|---|
| Estudiante | Celular | 252 | 90.5% | 6.0% |
| Estudiante | Tablet | 88 | 95.5% | 3.4% |
| Investigador | Celular | 88 | 94.3% | 3.4% |
| Investigador | Tablet | 8 | 100.0% | 0.0% |
| Evaluador | Celular | 20 | 90.0% | 5.0% |
| Evaluador | Tablet | 4 | 100.0% | 0.0% |
| Miembro del Comité | Celular | 12 | 91.7% | 8.3% |
| Miembro del Comité | Tablet | 4 | 100.0% | 0.0% |
| Coordinador | Celular | 4 | 100.0% | 0.0% |

**Tarea con más abandono, para discusión cualitativa:** *"Enviar la evaluación final"* (Evaluador, T4) tuvo 16.7% de abandono (n=6, o sea 1 de 6) y el promedio de errores más alto de toda la tabla (1.67); *"Consultar el historial de un expediente"* (Miembro del Comité, T3) tuvo 25% de abandono (1 de 4). Ambos con n muy chico — mencionarlos como señal a investigar más, no como conclusión firme.

### 3.6 Número de participantes (n) por rol y dispositivo — tabla resumen

| Rol \ Dispositivo | Teléfono celular | Tablet | Total |
|---|---|---|---|
| Estudiante | 63 | 22 | 85 |
| Investigador | 22 | 2 | 24 |
| Evaluador | 5 | 1 | 6 |
| Miembro del Comité | 3 | 1 | 4 |
| Coordinador | 1 | 0 | 1 |
| **Total** | **94** | **26** | **120** |

---

## 4. Limitaciones a declarar en el paper (importante)

1. **Desbalance de n por rol:** Estudiante (85) e Investigador (24) concentran el 90% de la muestra; Evaluador, Miembro del Comité y Coordinador son casos exploratorios (n≤6, y Coordinador es n=1 — un solo dato no tiene desviación estándar ni permite generalizar). Cualquier comparación estadística formal entre roles debería limitarse a Estudiante vs. Investigador, o declarar explícitamente el resto como observación cualitativa.
2. **Desbalance de n por dispositivo:** Tablet (26) es una muestra bastante más chica que Celular (94) — las comparaciones celular-vs-tablet por rol individual (ej. Evaluador/Tablet con n=1) no son confiables.
3. **Identidad del artefacto probado sin confirmar:** no está documentado si las sesiones se hicieron sobre la web responsive (`apps/web`, vista compacta) o sobre la app nativa Expo (`apps/mobile`) — hace falta esa precisión metodológica antes de publicar.
4. **Rol "Miembro del Comité" sin mapeo confirmado** a un rol real del sistema (probablemente secretaría, a confirmar).
5. **SUS general (49.7) por debajo del promedio de referencia de la industria (~68)** — es un resultado real y reportable, pero conviene contrastarlo con el detalle cualitativo de las notas de sesión (`notes` en `sesiones_tarea.csv`) para explicar el porqué, no solo el número.
