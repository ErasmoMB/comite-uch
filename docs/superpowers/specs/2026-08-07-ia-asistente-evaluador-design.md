# IA asistente para el evaluador — Diseño

Fecha: 2026-08-07
Rama: `feat/ia-evaluador`
Estado: aprobado el diseño visual, pendiente de implementar

## Problema

El evaluador recibe un expediente con hasta 5 documentos (proyecto en PDF y Word,
solicitud, carta del asesor, boleta) y debe puntuar 7 criterios sobre 20 puntos.
Hoy parte de una rúbrica en blanco: tiene que leer el proyecto completo para
ubicar dónde se habla del consentimiento informado, de la protección de datos o
de poblaciones vulnerables, y recién ahí puntuar.

El trabajo valioso del evaluador es **juzgar**, no **buscar**. La IA puede
hacerse cargo de la búsqueda.

## Principio que ordena el diseño

**La IA propone; la persona decide.**

Consecuencias concretas, no declarativas:

1. Ningún puntaje sugerido entra en el cálculo del total hasta que el evaluador
   lo confirma o lo cambia.
2. `Enviar evaluación` permanece deshabilitado mientras quede algún criterio sin
   confirmar.
3. Se guarda qué propuso la IA y qué decidió la persona, por separado. Un
   dictamen tiene que poder auditarse.
4. Si Gemini falla o tarda, la rúbrica manual funciona exactamente igual que
   hoy. La IA es un extra, nunca un requisito.

Lo generado por IA se muestra en **morado** (`--purple` / `#6941c6`, que ya
existe en el sistema de diseño y no significa ningún estado) y pierde ese color
al confirmarse. El ámbar quedó descartado porque ya significa "subsanación".

## Alcance

Dos funciones, ambas sobre la pantalla de evaluación que ya existe. No se crean
pantallas nuevas en web; en móvil el chat sí es pantalla propia por falta de
ancho.

### Función 1 — Borrador de rúbrica

El evaluador pulsa **✦ Analizar con IA**. El backend descarga los documentos del
expediente desde R2, se los manda a Gemini junto con el catálogo de los 7
criterios (nombre, descripción y puntaje máximo de cada uno) y recibe, por
criterio:

- `puntaje` sugerido (entero, entre 0 y el máximo del criterio)
- `justificacion` (texto breve)
- `cita` (sección o página del documento donde se sustenta)

La cita no es un adorno: sin ella el evaluador tiene que creerle a la IA o
releer todo, y en ambos casos la función deja de servir.

### Función 2 — Consultar el expediente

Chat de preguntas y respuestas sobre los documentos del expediente. Cada
respuesta cita la sección. Cuando algo no está en el expediente, la respuesta lo
dice explícitamente — es la respuesta más útil para un comité, porque los vacíos
son lo que más se observa.

El historial de la conversación **no se persiste**: es una herramienta de
consulta, no un registro del expediente. Vive mientras dura la pantalla.

## Fuera de alcance

Deliberadamente, para no inflar la primera versión:

- Resumen ejecutivo, detección de vacíos como pantalla aparte, redacción
  automática de observaciones finales. Se pueden agregar después sobre la misma
  base.
- Revisión documental asistida para secretaría (otro rol, otro flujo).
- Cualquier automatismo que decida sin intervención humana.

## Arquitectura

### Backend (`apps/api`)

Módulo nuevo `src/ia/`, aislado del resto:

```
src/ia/
  ia.module.ts
  ia.controller.ts      -> 2 endpoints
  ia.service.ts         -> orquesta: documentos -> Gemini -> respuesta validada
  gemini.client.ts      -> único punto que habla con la API de Gemini
  dto/
```

`gemini.client.ts` es el único archivo que conoce a Gemini. Si mañana se cambia
a Claude u otro proveedor, se reemplaza ese archivo y nada más — el mismo
criterio con el que `storage.service.ts` aisló a R2.

**Endpoints** (ambos exigen ser el evaluador asignado; se reutiliza el criterio
de `assertAccesoDescarga`, que ya distingue evaluador asignado / dueño / roles
internos):

| Método | Ruta | Devuelve |
|---|---|---|
| `POST` | `/ia/evaluacion/:id/sugerir-rubrica` | Sugerencia por cada uno de los 7 criterios |
| `POST` | `/ia/expediente/:id/consultar` | Respuesta a una pregunta, con cita |

**Modelo:** `gemini-2.0-flash`. Acepta PDF directamente, tiene ventana de
contexto amplia y nivel gratuito, que es lo que se necesita para una propuesta.

**Documentos que se envían:** solo el proyecto de investigación (`proyecto_pdf`).
La carta, la solicitud y la boleta no aportan al juicio ético y solo gastan
contexto. Si el expediente no tiene `proyecto_pdf`, el endpoint responde 409 con
un mensaje claro en vez de intentar analizar nada.

**Salida estructurada:** se le pide a Gemini un JSON con esquema fijo y se valida
antes de devolverlo. Si el puntaje sugerido excede el máximo del criterio, se
recorta al máximo — un modelo puede equivocarse y eso no debe romper el cálculo.

### Persistencia

Tabla nueva `sugerencias_ia`, aditiva (no toca ninguna tabla existente):

| Columna | Tipo | Nota |
|---|---|---|
| `id` | int PK | |
| `evaluacion_id` | int FK | única por evaluación |
| `contenido` | jsonb | las 7 sugerencias tal como las devolvió Gemini |
| `modelo` | varchar | qué modelo la generó, para trazabilidad |
| `created_at` | timestamp | |

Guardarla cumple dos propósitos: evita pagar dos veces el mismo análisis si el
evaluador recarga, y deja constancia de qué propuso la IA frente a lo que
finalmente decidió la persona (que vive en `evaluacion_criterios`).

Al pulsar el botón, si ya existe una sugerencia para esa evaluación se devuelve
la guardada. Se regenera solo si el evaluador lo pide explícitamente.

### Frontend

**Web** (`apps/web/src/pages/evaluador/Evaluacion.tsx`):
- Botón `✦ Analizar con IA` en la cabecera.
- Estado por criterio: `sugerido` (morado) → `confirmado` (normal). Aceptar
  copia el puntaje y la justificación a los campos reales; editar cualquiera de
  los dos también confirma.
- Aviso con el contador de criterios sin confirmar; `Enviar evaluación`
  deshabilitado mientras ese contador sea mayor que cero.
- Panel de consulta en la columna derecha, bajo los documentos.

**Móvil** (`apps/mobile/app/(evaluador)/evaluacion/[id].tsx`):
- Mismo botón y mismas tarjetas, en columna única.
- El chat es una pantalla propia (`consultar.tsx`), no un panel.
- Durante el análisis, pantalla de carga **con botón de cancelar**.

La lógica de estados de sugerencia se comparte en un módulo pequeño para no
duplicar la regla de "cuántos faltan por confirmar" entre web y móvil.

## Manejo de errores

| Situación | Respuesta |
|---|---|
| `GEMINI_API_KEY` ausente | 503 con mensaje claro. La función se oculta en la interfaz en vez de fallar al pulsarla. |
| El expediente no tiene `proyecto_pdf` | 409 explicando que falta el documento. |
| Gemini tarda más de 90 s | Se aborta y se avisa; la rúbrica manual sigue disponible. |
| Gemini devuelve algo que no es el JSON esperado | Se registra el error y se responde 502; no se guarda basura. |
| Cuota agotada | Mensaje específico, distinto de un error genérico. |

En todos los casos la evaluación manual sigue funcionando. Ese es el criterio
que decide si el manejo de errores es correcto.

## Privacidad — decisión pendiente del usuario

Los documentos llevan nombres, correos y teléfonos de estudiantes, además del
contenido del proyecto. Enviarlos a Gemini implica que **salen de Neon y R2 hacia
Google**.

Para una propuesta que aún no maneja datos reales esto no es un obstáculo, pero
queda registrado aquí para que sea una decisión consciente y no una omisión —
tratándose de un comité de ética. Si más adelante se opera con datos reales, las
opciones son: quitar los datos de contacto antes de enviar, informarlo al
solicitante, o alojar el modelo.

## Pruebas

- Unitarias del validador de la respuesta de Gemini: recorte de puntajes fuera
  de rango, criterios faltantes, JSON malformado.
- E2E con el cliente de Gemini simulado: permisos (un evaluador no asignado
  recibe 403), 409 sin `proyecto_pdf`, reutilización de la sugerencia guardada.
- Una prueba manual contra la API real, para confirmar que el formato de
  respuesta que pedimos es el que Gemini efectivamente devuelve.
- Verificación en el emulador Pixel 6 Pro y en el navegador.

Los tests no consumen cuota: el cliente de Gemini se simula en todos salvo la
prueba manual.

## Orden de implementación

1. Cliente de Gemini + validación de la respuesta (con tests, sin tocar la app).
2. Tabla `sugerencias_ia` y endpoint de rúbrica.
3. Interfaz web de sugerencias.
4. Endpoint y pantalla de consulta.
5. Móvil (rúbrica y consulta).

Cada paso deja el sistema funcionando. Si se abandona a mitad, lo construido no
rompe nada de lo que ya existe.
