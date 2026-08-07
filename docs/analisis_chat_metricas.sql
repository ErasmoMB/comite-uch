-- Métricas agregadas del chat investigador/solicitante <-> secretaría
-- Sistema Comité de Ética UCH. Todo de solo lectura (SELECT), no modifica nada.
--
-- Cómo usarlo: pega cada bloque en el SQL Editor de Neon
-- (Project > SQL Editor > New query) y ejecútalo. Cada bloque es
-- independiente. El texto de los mensajes y los nombres NO se
-- muestran en ningún resultado -- solo cantidades, fechas y roles.
--
-- Contexto del modelo de datos (apps/api/prisma/schema.prisma):
--   - mensajes_chat: un hilo por solicitante (solicitante_id). Cada fila es
--     un mensaje con autor_id, texto, leido, created_at.
--   - El chat es 1-a-1 entre un solicitante (investigador / estudiante
--     pregrado / estudiante posgrado) y la bandeja compartida de
--     secretaría (secretaria + administrador). No existe canal de chat
--     para coordinador ni evaluador -- por diseño, esos roles no van a
--     aparecer en estas métricas.
--   - NO existe ningún campo que marque si una observación se resolvió
--     "solo por chat" o si requirió reunión/llamada (punto 3 del pedido
--     del investigador), ni tiempos de respuesta de email (punto 4).
--     Esos dos puntos no se pueden sacar de la base de datos tal como
--     está hoy; quedarían como [DATO PENDIENTE] en el paper, o habría
--     que instrumentarlos primero (ver notas al final).


-- ============================================================
-- 1) Volumen general: mensajes totales y rango de fechas
-- ============================================================
SELECT
  count(*)                    AS mensajes_totales,
  count(DISTINCT solicitante_id) AS conversaciones_totales,
  min(created_at)             AS primer_mensaje,
  max(created_at)             AS ultimo_mensaje
FROM mensajes_chat;


-- ============================================================
-- 2) Mensajes por conversación (distribución)
--    "conversación" = todos los mensajes de un mismo solicitante_id
-- ============================================================
WITH por_hilo AS (
  SELECT solicitante_id, count(*) AS n_mensajes
  FROM mensajes_chat
  GROUP BY solicitante_id
)
SELECT
  count(*)                                              AS n_conversaciones,
  round(avg(n_mensajes)::numeric, 1)                    AS mensajes_prom_por_conversacion,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY n_mensajes) AS mensajes_mediana_por_conversacion,
  min(n_mensajes)                                       AS min_mensajes,
  max(n_mensajes)                                       AS max_mensajes
FROM por_hilo;


-- ============================================================
-- 3) Tiempos de respuesta (en horas), separados por quién responde
--    "lado" = 'solicitante' si autor_id = solicitante_id, si no
--    'secretaria_o_admin'. El tiempo de respuesta se mide como el
--    tiempo entre un mensaje y el siguiente mensaje DEL OTRO lado
--    dentro del mismo hilo (primera respuesta, no todo el intercambio).
-- ============================================================
WITH msgs AS (
  SELECT
    m.id,
    m.solicitante_id,
    m.created_at,
    CASE WHEN m.autor_id = m.solicitante_id THEN 'solicitante' ELSE 'secretaria_o_admin' END AS lado
  FROM mensajes_chat m
),
con_anterior AS (
  SELECT
    *,
    lag(lado) OVER (PARTITION BY solicitante_id ORDER BY created_at, id)       AS lado_anterior,
    lag(created_at) OVER (PARTITION BY solicitante_id ORDER BY created_at, id) AS created_at_anterior
  FROM msgs
),
respuestas AS (
  SELECT
    lado AS quien_responde,
    extract(epoch FROM (created_at - created_at_anterior)) / 3600.0 AS horas_respuesta
  FROM con_anterior
  WHERE lado_anterior IS NOT NULL
    AND lado <> lado_anterior
)
SELECT
  quien_responde,
  count(*)                                                     AS n_respuestas,
  round(avg(horas_respuesta)::numeric, 2)                      AS horas_promedio,
  round((percentile_cont(0.5) WITHIN GROUP (ORDER BY horas_respuesta))::numeric, 2) AS horas_mediana
FROM respuestas
GROUP BY quien_responde
ORDER BY quien_responde;


-- ============================================================
-- 4) Lo mismo que (3) pero desglosado por el ROL de quien responde
--    (ej. separar secretaria de administrador, o distinguir el rol
--    del solicitante: investigador / estudiante_pregrado / etc.)
-- ============================================================
WITH msgs AS (
  SELECT
    m.id,
    m.solicitante_id,
    m.created_at,
    u.rol AS autor_rol,
    CASE WHEN m.autor_id = m.solicitante_id THEN 'solicitante' ELSE 'secretaria_o_admin' END AS lado
  FROM mensajes_chat m
  JOIN users u ON u.id = m.autor_id
),
con_anterior AS (
  SELECT
    *,
    lag(lado) OVER (PARTITION BY solicitante_id ORDER BY created_at, id)       AS lado_anterior,
    lag(created_at) OVER (PARTITION BY solicitante_id ORDER BY created_at, id) AS created_at_anterior
  FROM msgs
),
respuestas AS (
  SELECT
    autor_rol AS rol_de_quien_responde,
    extract(epoch FROM (created_at - created_at_anterior)) / 3600.0 AS horas_respuesta
  FROM con_anterior
  WHERE lado_anterior IS NOT NULL
    AND lado <> lado_anterior
)
SELECT
  rol_de_quien_responde,
  count(*)                                                     AS n_respuestas,
  round(avg(horas_respuesta)::numeric, 2)                      AS horas_promedio,
  round((percentile_cont(0.5) WITHIN GROUP (ORDER BY horas_respuesta))::numeric, 2) AS horas_mediana
FROM respuestas
GROUP BY rol_de_quien_responde
ORDER BY rol_de_quien_responde;


-- ============================================================
-- 5) Volumen: solicitantes que usaron el chat, por rol, y expedientes
--    asociados a esos solicitantes (aprox. -- el hilo es por usuario,
--    no por expediente individual; si un investigador tiene varios
--    expedientes, todos cuentan aquí aunque el chat sea uno solo).
-- ============================================================
SELECT
  u.rol,
  count(DISTINCT m.solicitante_id)  AS solicitantes_con_chat,
  count(DISTINCT e.id)              AS expedientes_de_esos_solicitantes
FROM mensajes_chat m
JOIN users u ON u.id = m.solicitante_id
LEFT JOIN expedientes e ON e.investigador_id = m.solicitante_id
GROUP BY u.rol
ORDER BY u.rol;


-- ============================================================
-- NOTA sobre puntos 3 y 4 del pedido original (no cubiertos aquí):
--
-- - "Tasa de resolución sin reunión presencial": no existe hoy un
--   campo que vincule un hilo de chat (o un mensaje) con que una
--   observación quedó resuelta sin reunión. Si quieres este dato,
--   la única forma real es levantarlo manualmente (ej. revisando
--   caso por caso en bitácora/expedientes cuáles llevaron reunión) o
--   agregando un campo nuevo al modelo antes de seguir recolectando
--   datos.
--
-- - "Comparación chat vs. email": el sistema envía correos (Resend)
--   pero no registra cuándo el destinatario respondió por ese canal,
--   así que no hay tiempos de respuesta de email que comparar.
-- ============================================================
