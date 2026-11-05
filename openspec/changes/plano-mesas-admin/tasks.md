## 1. Prerrequisitos

- [x] 1.1 Confirmar con el equipo que se hace este change antes de la entrega: en `plano-mesas`
      (tarea 1.1, pregunta abierta 5) se había decidido que alcanzaba con el layout del seed, sin
      editor de admin. Anotar la respuesta en el PR de esta propuesta. No empezar el Grupo 2 sin
      ella.
      Resultado (05/11/2026): confirmado por portalmatias, se hace antes de la entrega. El PR de
      la propuesta (#96) ya estaba mergeado sin esta respuesta; queda anotada aquí y en el PR de
      la implementación.
- [x] 1.2 Esperar a que se integre el PR #89 y se archive `plano-mesas`. Crear
      `feature/plano-mesas-admin` desde `main` actualizado y verificar que existen
      `openspec/specs/plano-mesas/spec.md`, `backend/src/plano-mesas/layout-plano.ts` y
      `frontend/src/components/reservas/plano-mesas.tsx`.
      Resultado (05/11/2026): #89 mergeado, `plano-mesas` archivado (#104). Rama creada desde
      `main` en `4b24d1f` y los tres archivos existen.

## 2. Regla de ubicación en el backend (tests primero)

- [x] 2.1 Sumar a `backend/src/plano-mesas/layout-plano.spec.ts` los casos de `problemasDeUbicacion`
      (rojo): con el layout del seed, S4 en (8,5) no tiene problemas; S1 en (1,0) toca a S2 sin
      superponerse; S1 en (5,1) se superpone con S3; S4 con ancho 6 se superpone con S5; S5 en
      (10,3) queda fuera de la grilla de 12 por 8; una mesa superpuesta con dos devuelve las dos
      etiquetas ordenadas; las mesas sin ubicar se ignoran. Verificar que falla.
      Resultado (05/11/2026): 7 casos nuevos en el bloque `problemasDeUbicacion`. Rojo
      observado: 7 fallidos, 9 pasan (`problemasDeUbicacion is not a function`).
- [x] 2.2 Implementar `problemasDeUbicacion` en `layout-plano.ts` con `mesa: MesaUbicada`,
      exportando `MesaUbicada` y `estaUbicada`, y reutilizando `seSuperponen` y
      `ordenarMesasPorEtiqueta` (design.md D2), sin cambiar `validarLayout`. Verificar que 2.1
      pasa y que los tests del seed siguen en verde.
      Resultado (05/11/2026): verde, `src/plano-mesas` 25 de 25 y
      `plano-mesas-seed.integration-spec.ts` 5 de 5. La condición de grilla pasó a una función
      interna `quedaFueraDeGrilla` que usan `validarLayout` y `problemasDeUbicacion`; los
      mensajes y el resultado de `validarLayout` no cambian.

## 3. API de administración

Los tests de 3.1 a 3.5 van en `backend/test/gestion-salon-admin.integration-spec.ts`, uno por
escenario de "Ubicación de Mesa en el plano" de `specs/gestion-salon/spec.md`. Cada rechazo verifica
además que la mesa no cambió en la base. Cada tarea va con tests primero (rojo, luego verde).

- [x] 3.1 Agregar `posX`, `posY`, `ancho`, `alto` y `forma` a `ActualizarMesaDto` con las
      validaciones de design.md D1 (`null` distinto de ausente). Tests: valores fuera de rango
      `400` (incluido `null` en `ancho`, `alto` o `forma`) y pedido sin campos del plano.
      Resultado (05/11/2026): bloque nuevo "Ubicación de Mesa en el plano (integration)" en
      `gestion-salon-admin.integration-spec.ts`, con schema de Postgres propio y el layout del seed
      recargado antes de cada caso. 10 tests: 9 valores fuera de rango (cada uno exige que el `400`
      venga de la validación del campo y no de `forbidNonWhitelisted`, y que la mesa no cambie) y el
      pedido sin campos del plano. Rojo observado: 9 fallidos, 1 pasa (el pedido sin campos del plano
      ya se comportaba así). Verde: el archivo completo 26 de 26.
- [x] 3.2 En `MesasService.ejecutarActualizacion`, dentro de la transacción `Serializable`
      existente, calcular el lugar final, validar que las coordenadas van juntas (paso 0 de D2) y
      saltear la validación cuando el lugar no cambia (paso 2). Tests: coordenada a medias `400`
      (también con el valor guardado, y con una `null` junto a otra con valor), forma, forma y
      reenvío de la ubicación de una mesa con un problema previo (cargado directo en la base),
      quitar del plano, y las validaciones existentes antes que las de ubicación.
      Resultado (05/11/2026): 8 tests en el bloque "coordenadas juntas y lugar final": las tres
      coordenadas a medias (también con el valor guardado y con una `null` junto a otra con valor),
      forma, forma y reenvío de la ubicación de S2 cargada a mano en (5,0), quitar del plano (que
      además consulta `PlanoMesasService` y encuentra S2 sin ubicar en STANDARD) y la reserva activa
      de S4 que gana sobre la ubicación. Rojo observado: 3 fallidos (dos respondían `200` y uno `500`),
      5 pasan (sin validación de ubicación todavía no había nada que saltear). Verde: 34 de 34. El
      lugar final y el atajo del paso 2 se implementaron junto con 3.3, que es la validación que
      saltean; los tests de problema previo siguen en verde después de 3.3. Mismo commit que 3.3.
- [x] 3.3 Validar la grilla y la superposición con `problemasDeUbicacion` (pasos 3 y 4 de D2).
      Tests: mover, tocarse, superposición `409` con una y con varias mesas, cambio de tamaño
      `409`, fuera de grilla `400`, tamaño mayor que la grilla en una mesa sin ubicar `400`, y el
      orden de los rechazos (coordenada a medias sobre tamaño, tamaño sobre fuera de grilla, fuera
      de grilla sobre superposición).
      Resultado (05/11/2026): 10 tests en el bloque "grilla y superposición": mover, tocarse, las
      tres superposiciones (S3; S2 y S3; S5), fuera de grilla, tamaño mayor que la grilla con S2 sin
      ubicar y los tres órdenes de rechazo (S6 cargada en la base en (10,7)). Rojo observado: 7
      fallidos (respondían `200`), 3 pasan (mover, tocarse y la coordenada a medias, que ya cubría
      3.2). Verde: el archivo completo 44 de 44 y los unitarios del backend 247 de 247. Las mesas y
      zonas de prueba de `mesas.service.spec.ts` suman las columnas del plano que trae toda fila de
      Prisma (sin ellas, el cambio de zona leía `posX` como `undefined` y validaba una mesa ubicada).
- [x] 3.4 Cambio de zona. Tests: reenviar la misma zona, cambio de zona sin ubicación, con
      ubicación y con ubicación fuera de la grilla nueva (S6, cargada directo en la base), y mesa
      que no entra en la grilla nueva (S8, cargada directo en la base).
      Resultado (05/11/2026): 5 tests en el bloque "cambio de zona": la misma zona, S6 a VIP sin
      ubicación, con ubicación (7,0) y fuera de la grilla nueva (10,0), y S8 de 11 por 1 que no entra
      en VIP. Rojo observado: 1 fallido (S6 a VIP sin ubicación respondía `400` fuera de la grilla
      porque conservaba (10,7)), 4 pasan (la grilla y el tamaño ya se validaban contra la zona final
      desde 3.3). Verde: el archivo completo 49 de 49 y los unitarios 247 de 247. En
      `mesas.service.spec.ts`, "permite el cambio de zona sin reservas activas" ahora espera
      `posX: null` y `posY: null` en el `update`, el cambio de comportamiento que fija el spec.
- [x] 3.5 Concurrencia (design.md D3). Tests: dos `PATCH` simultáneos con `Promise.all` hacia una
      celda libre, de los que exactamente uno responde `200`, y en `mesas.service.spec.ts` el
      reintento en el que el primer intento falla con `P2034` y el segundo responde el `409` de
      superposición. Verificar que los tests actuales de `mesas.service.spec.ts`,
      `mesas.integration-spec.ts` y `gestion-salon-admin.integration-spec.ts` siguen en verde.
      Resultado (05/11/2026): 1 test de integración con `Promise.all` (S1 y S2 hacia (9,6): uno
      `200` y queda en (9,6), el otro `409` y no cambia) y 1 unitario del reintento (`P2034` en el
      primer intento; el segundo lee S2 en la celda y responde "La mesa se superpone con S2."). Sin
      rojo: los dos pasan en la primera corrida, porque el comportamiento ya lo da la transacción
      `Serializable` existente con la lectura de 3.3 (D3). Verde: `gestion-salon-admin` y
      `mesas.integration-spec.ts` 60 de 60, unitarios 248 de 248. En Windows hubo que correr las
      suites con `DATABASE_URL_TEST` en `127.0.0.1`: con `localhost`, cada conexión nueva prueba
      primero `::1` (Docker publica solo en `127.0.0.1`), tarda unos 2 s y las transacciones
      simultáneas fallan con `P2028`; el test de concurrencia de `mesas.integration-spec.ts` ya
      fallaba así con el service de `main`.
- [x] 3.6 Sumar los campos del plano a `MesaRespuestaDto`, `planoColumnas`/`planoFilas` a
      `ZonaRespuestaDto`, y las mismas columnas a `SELECT_MESA_ADMIN` (`mesas.service.ts` y su
      copia en `mesas.service.spec.ts`) y `SELECT_ZONA_ADMIN` (`zonas.service.ts` y su copia en
      `zonas.service.spec.ts`), que hoy las excluyen (design.md D4). Tests: los escenarios de los
      listados (ubicación en `GET /admin/mesas`, grilla en `GET /admin/zonas`, mesa recién creada
      sin ubicar, S7) y `plano-mesas-salidas-admin.integration-spec.ts` cambiado para que exija
      las claves nuevas en `GET`, `POST` y `PATCH` de mesas y `GET` y `PATCH` de zonas. Verificar
      que `mesas.service.spec.ts` y `zonas.service.spec.ts` siguen en verde.
      Resultado (05/11/2026): 3 tests nuevos en el bloque "listados" (S3 en `GET /admin/mesas`, la
      grilla de STANDARD y VIP en `GET /admin/zonas`, S7 sin ubicar en el alta y en el listado), la
      respuesta de "mueve S4 a un lugar libre" ahora exige (8,5) con `ancho` 3 y `alto` 2, y
      `plano-mesas-salidas-admin.integration-spec.ts` exige las claves nuevas. Rojo observado: 7
      fallidos en integración (49 pasan) y 7 en `mesas.service.spec.ts` y `zonas.service.spec.ts` (41
      pasan), por las copias de los `select`. Verde: unitarios 248 de 248; `gestion-salon-admin`,
      `plano-mesas-salidas-admin`, `mesas` y `zonas` de integración 68 de 68.
- [x] 3.7 Incorporar el fragmento OpenAPI de design.md a `openapi/openapi.yaml` y regenerar los
      tipos del frontend. Verificar con `npm run openapi:check` y `npm run typecheck -w frontend`.
      Resultado (05/11/2026): antes del cambio, `openapi:check` marcaba la desviación (rojo).
      Después: `openapi:check` sin desviación, tipos regenerados con `npm run api:types -w
      frontend` y `npm run typecheck -w frontend` en verde. `forma` va como `description` +
      `allOf: [$ref FormaMesa]`: con un `$ref` solo, Nest pierde la descripción de `FormaMesa`
      y `openapi:check` falla; el contrato es el mismo. Los fixtures `ZONA_STD` y `ZONA_VIP` de
      `frontend/test/components/admin/salon.test.tsx` suman `planoColumnas` y `planoFilas`,
      que ahora son obligatorios (22 de 22 tests del archivo en verde).

## 4. Pantalla del admin

Los tests de 4.3 a 4.8 van en el bloque `MesasPanel` de
`frontend/test/components/admin/salon.test.tsx`, uno por escenario de "Ubicación de la Mesa en el
plano" de `specs/frontend-admin/spec.md`. Cada tarea va con tests primero (rojo, luego verde).

- [ ] 4.1 Extraer `CELDA`, `MARGEN` y `Silueta` de `plano-mesas.tsx` a
      `frontend/src/components/reservas/plano-geometria.tsx` (design.md D5) sin cambiar el plano
      del cliente. Verificar que los tests actuales de `plano-mesas.test.tsx` pasan sin
      modificarlos.
- [ ] 4.2 Sumar a `frontend/test/lib/plano-mesas.test.ts` los casos de `frontend/src/lib/plano-mesas.ts` (rojo) y luego implementar: los
      valores válidos de columna y fila según ancho, alto y grilla; la corrección al último valor
      válido; el texto de la ubicación ("las columnas 6 y 7", "la columna 6", "las columnas 6 a
      8") y la lista de superposiciones, con los casos del seed. Verificar que pasan.
- [ ] 4.3 Campos de la sección "Ubicación en el plano". Tests: la columna limitada por el ancho,
      el ancho mayor que corrige la columna, la mesa sin ubicar, la mesa guardada fuera de la
      grilla (campos vacíos y aviso), y que el alta no muestra la sección.
- [ ] 4.4 Vista previa y su texto. Tests: la vista previa que sigue los valores (sin avisar
      superposición con la propia posición guardada), el aviso de superposición con el botón
      habilitado, la falla al cargar las mesas de la zona, y la alternativa textual.
- [ ] 4.5 Armado del pedido. Tests: mover, ubicar una mesa sin ubicar, guardar sin ubicación sin
      error, ubicación a medias que no se envía, quitar del plano, las coordenadas juntas con
      `ancho`, `alto` y `forma` solo si cambiaron, y reubicar la mesa guardada fuera de la grilla.
- [ ] 4.6 Errores y listado. Tests: la superposición, el tamaño y la ubicación fuera de la
      grilla rechazados por la API junto a la sección, y la columna "Plano" del listado
      ("Columna 9, fila 6", "Sin ubicar" y "Fuera de la grilla"). Implementar la regla `ubicacion` de `errores-campo.ts`.
- [ ] 4.7 Cambio de zona. Tests: cambio de zona, cambio a una zona más chica que ajusta el
      tamaño, cambio de zona sin elegir ubicación, con la misma columna y fila (envía las dos
      coordenadas aunque coincidan con las de la zona vieja), y volver a la zona original que
      restaura la ubicación (también con una mesa fuera de la grilla).
- [ ] 4.8 Cambios de zona rápidos con la respuesta vieja llegando última (design.md D5, "Datos").
      Verificar que pasa y que los tests actuales del panel siguen en verde.

## 5. Cierre

- [ ] 5.1 Correr `npm run lint`, `npm run typecheck -w frontend`, los tests del backend (unitarios
      y e2e) y del frontend, `npm run openapi:check` y `openspec validate plano-mesas-admin
      --strict`, y anotar los resultados en el PR.
- [ ] 5.2 Revisión visual en `/admin/salon` con el backend local: mover S4, intentar superponerla
      con S5, quitar S2 del plano y verificar en `/reservas/nueva/resultado` que el plano del
      cliente refleja los cambios. Anotar el resultado en el PR.
- [ ] 5.3 Pedir la aprobación de un compañero y, una vez integrado, archivar el change.
