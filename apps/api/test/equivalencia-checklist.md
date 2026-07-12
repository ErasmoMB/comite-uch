# Equivalencia pytest (Python) -> Jest (Node) -- Task 12

Fuente Python: `comite/backend/tests/*.py` (14 archivos, 40 escenarios contando los
casos parametrizados de `test_rubrica.py::test_umbrales` como 6 escenarios
individuales: 1+4+10+5+2+1+2+1+2+1+7+2+2 = 40).

Fuente Node: `apps/backend/test/*.e2e-spec.ts`.

Convención: FOUND = ya existía un test Jest equivalente (misma regla, mismo
status code). GAP -> FIXED = se encontró un hueco real y se escribió el test
faltante en esta tarea. N/A (arquitectura) = el artefacto Python no tiene
equivalente de código en Node (no es un hueco funcional, no aplica escribir
un test).

## test_asignacion_un_evaluador.py

- [x] 1. `test_solo_un_evaluador_por_expediente` -> `test/evaluacion.e2e-spec.ts`,
      describe `'1 solo evaluador por expediente -- POST /evaluacion/expediente/{id}/asignar'`,
      it `'rechaza un segundo evaluador para el mismo expediente'`. 1er asignar 201,
      2do asignar 400 con mensaje "ya tiene un evaluador asignado". FOUND.

## test_cambio_titulo_regla.py

- [x] 2. `test_elegibles_solo_aprobados` -> `test/expedientes.e2e-spec.ts`, it
      `'elegibles-cambio-titulo excluye estados enviado/no_aprobado; cambio-titulo
      sobre un origen no aprobado da 400'` (nueva, agregada en esta tarea).
      GAP -> FIXED: el test previo (`'flujo cambio de título: ...'`) solo probaba
      la inclusión positiva de un origen "aprobado"; no probaba la exclusión de
      "enviado"/"no_aprobado". Ahora se crean expedientes en ambos estados y se
      confirma que NO aparecen en `/expedientes/elegibles-cambio-titulo`.
- [x] 3. `test_cambio_titulo_rechaza_no_aprobado` -> mismo test nuevo de arriba:
      `POST /expedientes/cambio-titulo` sobre un origen en estado "enviado" -> 400.
      GAP -> FIXED (no existía ningún test de este caso).
- [x] 4. `test_cambio_titulo_ok_autollena_titulo_y_deriva_acta` ->
      `test/expedientes.e2e-spec.ts`, it `'flujo cambio de título: solo sobre un
      proyecto propio ya aprobado, con numero_acta derivado del código de origen'`.
      `numeroActa==='7'` derivado de `codigoUnico: '7-2025'`, `tituloAnterior`/
      `tituloNuevo` correctos. FOUND.
- [x] 5. `test_cambio_titulo_rechaza_proyecto_ajeno` -> mismo it de arriba:
      usuario no dueño del origen -> 404 (no 403). FOUND.

## test_chat.py

- [x] 6. `test_solicitante_envia_y_lee_su_hilo` -> `test/chat.e2e-spec.ts`, it
      `'el solicitante envía un mensaje y lee su propio hilo'`. FOUND.
- [x] 7. `test_rol_interno_no_usa_endpoints_de_solicitante` -> `test/chat.e2e-spec.ts`,
      it `'un rol interno (evaluador) no puede usar los endpoints de solicitante'`. FOUND.
- [x] 8. `test_texto_vacio_o_muy_largo_da_400` -> `test/chat.e2e-spec.ts`, it
      `'rechaza con 400 un texto vacío o mayor a 2000 caracteres'`. FOUND.
- [x] 9. `test_no_leidos_del_solicitante` -> `test/chat.e2e-spec.ts`, it
      `'cuenta los no-leídos del solicitante y los marca leídos al abrir el hilo'`. FOUND.
- [x] 10. `test_solicitante_no_usa_endpoints_de_secretaria` -> `test/chat.e2e-spec.ts`,
      it `'un solicitante no puede usar los endpoints de secretaría'`. FOUND.
- [x] 11. `test_bandeja_agrupada_con_datos_y_no_leidos` -> `test/chat.e2e-spec.ts`,
      it `'la bandeja agrupada muestra una conversación por solicitante, ordenada
      por actividad y con no-leídos'`. Cubre orden, `codigoEstudiante`,
      `ultimoMensaje`, `noLeidos` por solicitante y total. FOUND.
- [x] 12. `test_secretaria_lee_hilo_y_marca_leidos` -> `test/chat.e2e-spec.ts`, it
      `'la secretaría lee el hilo de un solicitante y marca sus mensajes como
      leídos'`. FOUND.
- [x] 13. `test_secretaria_inicia_conversacion` -> `test/chat.e2e-spec.ts`, it
      `'la secretaría puede iniciar una conversación con un solicitante'`. FOUND.
- [x] 14. `test_hilo_de_no_solicitante_da_404` -> `test/chat.e2e-spec.ts`, it
      `'devuelve 404 al leer o escribir el hilo de un usuario que no es
      solicitante'`. FOUND.
- [x] 15. `test_lista_de_solicitantes` -> `test/chat.e2e-spec.ts`, it `'lista solo
      los solicitantes activos, ordenados, para que secretaría inicie una
      conversación'`. FOUND.

## test_completar_evaluacion.py

- [x] 16. `test_completar_aprobado_setea_estado` -> `test/evaluacion.e2e-spec.ts`,
      it `'aprobado (puntaje 19): genera SOLO el dictamen'` (banda 17-20;
      el valor exacto 20 lo cubre además el test paramétrico de
      `resultadoPorPuntaje`). FOUND.
- [x] 17. `test_completar_con_observaciones` -> `test/evaluacion.e2e-spec.ts`, it
      `'aprobado_observaciones (puntaje 14): genera rubrica Y dictamen'` (banda
      13-16; el valor exacto 13 lo cubre el test paramétrico de
      `resultadoPorPuntaje`). FOUND.
- [x] 18. `test_completar_no_aprobado` -> `test/evaluacion.e2e-spec.ts`, it
      `'no_aprobado (puntaje 10): genera SOLO el PDF de rubrica'`. Mismo puntaje
      (10) que Python. FOUND.
- [x] 19. `test_puntaje_fuera_de_rango` -> `test/evaluacion.e2e-spec.ts`, describe
      `'PUT /evaluacion/{id} -- validaciones de la rubrica'`, it `'rechaza un
      puntaje fuera de rango para un criterio'`. FOUND.
- [x] 20. `test_faltan_criterios` -> mismo describe, it `'rechaza completar sin
      los 7 criterios'`. FOUND.

## test_descarga_pdf_url_s3.py

- [x] 21. `test_descargar_rubrica_redirige_si_es_url_s3` -> `test/descarga-pdf-url.e2e-spec.ts`,
      it `'descargar-rubrica redirige (302) si rubricaPdfPath ya es una URL S3'`. FOUND.
- [x] 22. `test_descargar_evaluacion_expediente_redirige_si_es_url_s3` ->
      `test/descarga-pdf-url.e2e-spec.ts`, it `'descargar-dictamen redirige (302)
      si dictamenPdfPath ya es una URL S3'`. Nota: en Python este caso vive bajo
      `/expedientes/{id}/descargar-evaluacion/dictamen`; en Node el endpoint
      equivalente vive enteramente bajo `/evaluacion/{id}/descargar-dictamen`
      (reubicación de módulo documentada explícitamente en el archivo). Misma
      regla de negocio (redirect 302 con Location = URL guardada). FOUND.

## test_endpoint_rubrica.py

- [x] 23. `test_get_rubrica` -> `test/evaluacion.e2e-spec.ts`, it `'GET
      /evaluacion/rubrica devuelve el catalogo de 7 criterios y el puntaje
      maximo'`. FOUND.

## test_enums.py

- [x] 24. `test_estados_nuevos` (enum `EstadoExpediente` con valores
      aprobado/aprobado_observaciones/no_aprobado) -> N/A (arquitectura): el
      schema Prisma (`estado String? @db.VarChar(50)`) usa strings planos, no
      un enum a nivel de columna/tipo -- no existe artefacto de código
      equivalente que testear de forma aislada. Cobertura funcional real: los
      e2e de evaluación (#16-18) ejercitan las 3 transiciones de estado.
- [x] 25. `test_tipos_dictamen` (enum `TipoDictamen` == exactamente esos 3
      valores) -> N/A (arquitectura), misma razón que #24 (`resultado String?
      @db.VarChar(50)` en `Evaluacion`, sin enum). Cubierto funcionalmente por
      los mismos e2e de evaluación.

## test_modelo_criterios.py

- [x] 26. `test_crear_evaluacion_con_criterios` (persistencia ORM de
      `EvaluacionCriterio` con `criterio_key`/`puntaje`) -> GAP -> FIXED: se
      agregó en `test/evaluacion.e2e-spec.ts`, dentro de it `'no_aprobado
      (puntaje 10): genera SOLO el PDF de rubrica'`, una lectura directa vía
      `prisma.evaluacionCriterio.findMany({ where: { evaluacionId } })` que
      confirma las 7 filas persistidas con `criterioKey`/`puntaje` exactos
      (antes solo se probaba indirectamente vía `puntajeTotal` agregado).

## test_reportes_carga_evaluadores.py

- [x] 27. `test_carga_evaluadores_incluye_nombre_real` -> `test/reportes.e2e-spec.ts`,
      it `'GET /reportes/carga-evaluadores incluye el nombre real del evaluador
      (nombre, no nombres)'`. FOUND.
- [x] 28. `test_resumen_incluye_carga_evaluadores_no_vacia` -> `test/reportes.e2e-spec.ts`,
      it `'incluye carga_evaluadores no vacia y resultados sobre
      Evaluacion.resultado'`. FOUND.

## test_reportes_resultados.py

- [x] 29. `test_resultados_incluye_no_aprobado` -> `test/reportes.e2e-spec.ts`,
      it `'GET /reportes/resultados-emitidos cuenta solo evaluaciones completas,
      agrupadas por resultado'`. FOUND.

## test_rubrica.py

- [x] 30. `test_catalogo_suma_20_y_tiene_7_criterios` -> `test/evaluacion.e2e-spec.ts`,
      describe `'CRITERIOS_RUBRICA (catálogo)'`, it `'tiene 7 criterios que
      suman 20 puntos'`. FOUND.
- [x] 31. `test_umbrales[0-no_aprobado]` -> `test/evaluacion.e2e-spec.ts`, describe
      `'resultadoPorPuntaje'`, `it.each` caso `[0, 'no_aprobado']`. FOUND.
- [x] 32. `test_umbrales[12-no_aprobado]` -> mismo `it.each`, caso `[12, 'no_aprobado']`. FOUND.
- [x] 33. `test_umbrales[13-aprobado_observaciones]` -> mismo `it.each`, caso
      `[13, 'aprobado_observaciones']`. FOUND.
- [x] 34. `test_umbrales[16-aprobado_observaciones]` -> mismo `it.each`, caso
      `[16, 'aprobado_observaciones']`. FOUND.
- [x] 35. `test_umbrales[17-aprobado]` -> mismo `it.each`, caso `[17, 'aprobado']`. FOUND.
- [x] 36. `test_umbrales[20-aprobado]` -> mismo `it.each`, caso `[20, 'aprobado']`. FOUND.

## test_schemas_rubrica.py

- [x] 37. `test_input_criterios_en_evaluacion_update` -> cubierto
      funcionalmente por todos los `PUT /evaluacion/{id}` de
      `test/evaluacion.e2e-spec.ts` que envían `{criterios:[{key,puntaje,
      observacion}], completa}` y son aceptados/rechazados correctamente. No
      hay (ni existía en el plan de Tasks 3-11) un test unitario aislado de
      DTO -- la validación de forma se prueba end-to-end, equivalente
      funcional aceptado.
- [x] 38. `test_rubrica_response` -> mismo test que #23 (`'GET /evaluacion/rubrica
      devuelve el catalogo de 7 criterios y el puntaje maximo'`), que verifica
      la forma completa de la respuesta (`criterios`, `puntajeTotalMax`,
      `umbrales`). FOUND.

## test_subsanacion_cambia_estado.py

- [x] 39. `test_subsanacion_reingresa_a_enviado` -> `test/subsanacion.e2e-spec.ts`,
      it `'subsanacion reingresa el expediente a estado enviado y deja
      registro en el historial'`. (Nota: Node responde 201 vs 200 en Python --
      diferencia de status code documentada e intencional, no afecta la regla
      de negocio verificada: estado, historial). FOUND.
- [x] 40. `test_subsanacion_rechaza_si_no_esta_en_subsanacion` -> `test/subsanacion.e2e-spec.ts`,
      it `'rechaza subsanacion si el expediente no esta en estado
      subsanacion'`. FOUND.

---

## Resumen

- 40/40 escenarios confirmados con equivalencia funcional (o marcados N/A
  arquitectural con justificación).
- 3 huecos genuinos encontrados y corregidos en esta tarea:
  - #2/#3 (`elegibles-cambio-titulo` exclusión de estados + rechazo de
    cambio-titulo sobre origen no aprobado) -> nuevo test en
    `test/expedientes.e2e-spec.ts`.
  - #26 (persistencia de `EvaluacionCriterio` fila por fila) -> nueva
    aserción en un test ya existente de `test/evaluacion.e2e-spec.ts`.
- 2 escenarios (#24, #25) son verificaciones de un enum de Python que no
  tiene artefacto de código equivalente en Node (Prisma usa `String` plano
  para `estado`/`resultado`); no son huecos funcionales, están marcados N/A
  con la justificación arquitectónica.
- Suite Jest completa (`npx jest --config ./test/jest-e2e.json`, contra el
  schema Postgres `test` aislado): **118/118 tests pasando**, 14 suites, sin
  warnings, ~196s.
