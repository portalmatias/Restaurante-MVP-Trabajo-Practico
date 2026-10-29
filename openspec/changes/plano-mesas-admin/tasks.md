## 1. Prerrequisitos

- [ ] 1.1 Confirmar con el equipo que se hace este change antes de la entrega: en `plano-mesas`
      (tarea 1.1, pregunta abierta 5) se había decidido que alcanzaba con el layout del seed, sin
      editor de admin. Anotar la respuesta en el PR de esta propuesta. No empezar el Grupo 2 sin
      ella.
- [ ] 1.2 Esperar a que se integre el PR #89 y se archive `plano-mesas`. Crear
      `feature/plano-mesas-admin` desde `main` actualizado y verificar que existen
      `openspec/specs/plano-mesas/spec.md`, `backend/src/plano-mesas/layout-plano.ts` y
      `frontend/src/components/reservas/plano-mesas.tsx`.

## 2. Regla de ubicación en el backend (tests primero)

- [ ] 2.1 Sumar a `backend/src/plano-mesas/layout-plano.spec.ts` los casos de `problemasDeUbicacion`
      (rojo): con el layout del seed, S4 en (8,5) no tiene problemas; S1 en (1,0) toca a S2 sin
      superponerse; S1 en (5,1) se superpone con S3; S4 con ancho 6 se superpone con S5; S5 en
      (10,3) queda fuera de la grilla de 12 por 8; una mesa superpuesta con dos devuelve las dos
      etiquetas ordenadas; las mesas sin ubicar se ignoran. Verificar que falla.
- [ ] 2.2 Implementar `problemasDeUbicacion` en `layout-plano.ts` con `mesa: MesaUbicada`,
      exportando `MesaUbicada` y `estaUbicada`, y reutilizando `seSuperponen` y
      `ordenarMesasPorEtiqueta` (design.md D2), sin cambiar `validarLayout`. Verificar que 2.1
      pasa y que los tests del seed siguen en verde.

## 3. API de administración

Los tests de 3.1 a 3.3 van en `backend/test/gestion-salon-admin.integration-spec.ts`, uno por
escenario de "Ubicación de Mesa en el plano" de `specs/gestion-salon/spec.md`. Cada rechazo verifica
además que la mesa no cambió en la base.

- [ ] 3.1 Agregar `posX`, `posY`, `ancho`, `alto` y `forma` a `ActualizarMesaDto` con las
      validaciones de design.md D1 (`null` distinto de ausente). Tests primero (rojo, luego
      verde): valores fuera de rango `400` (incluido `null` en `ancho`, `alto` o `forma`) y pedido
      sin campos del plano.
- [ ] 3.2 Extender `MesasService.ejecutarActualizacion` con el lugar final, la comparación contra
      lo guardado y la validación de design.md D2, dentro de la transacción `Serializable`
      existente. Tests primero (rojo, luego verde): mover, tocarse, superposición `409` con su
      mensaje, cambio de tamaño `409`, fuera de grilla `400` con su mensaje, fuera de grilla gana
      sobre la superposición, coordenada a medias `400` (también con el valor guardado), tamaño mayor que la grilla en una mesa
      sin ubicar `400`, forma, forma y reenvío de la ubicación de una mesa con un problema previo
      (cargado directo en la base), quitar del plano, y las validaciones existentes antes que las
      de ubicación.
- [ ] 3.3 Cubrir el cambio de zona y la concurrencia sobre la lógica de 3.2. Tests primero (rojo,
      luego verde): cambio de zona sin ubicación, con ubicación y con ubicación fuera de la grilla
      nueva (usando la mesa S6 que define el spec, cargada directo en la base), mesa que no entra
      en la grilla nueva (S8, cargada directo en la base), y dos `PATCH`
      simultáneos con `Promise.all` hacia una celda libre, de los que exactamente uno responde
      `200`. Verificar que los tests actuales de `mesas.service.spec.ts`,
      `mesas.integration-spec.ts` y `gestion-salon-admin.integration-spec.ts` siguen en verde.
- [ ] 3.4 Sumar los campos del plano a `MesaRespuestaDto`, `planoColumnas`/`planoFilas` a
      `ZonaRespuestaDto`, y las mismas columnas a `SELECT_MESA_ADMIN` (`mesas.service.ts` y su
      copia en `mesas.service.spec.ts`) y `SELECT_ZONA_ADMIN` (`zonas.service.ts` y su copia en
      `zonas.service.spec.ts`), que hoy las excluyen (design.md D4). Tests primero: los escenarios
      de los listados (ubicación en `GET /admin/mesas`, grilla en `GET /admin/zonas`, mesa recién
      creada sin ubicar, S7) y `plano-mesas-salidas-admin.integration-spec.ts` cambiado para que
      exija las claves nuevas en `GET`, `POST` y `PATCH` de mesas y `GET` y `PATCH` de zonas.
      Verificar que pasan y que `mesas.service.spec.ts` y `zonas.service.spec.ts` siguen en verde.
- [ ] 3.5 Incorporar el fragmento OpenAPI de design.md a `openapi/openapi.yaml` y regenerar los
      tipos del frontend. Verificar con `npm run openapi:check` y `npm run typecheck -w frontend`.

## 4. Pantalla del admin

Los tests de 4.3 a 4.5 van en el bloque `MesasPanel` de
`frontend/test/components/admin/salon.test.tsx`, uno por escenario de "Ubicación de la Mesa en el
plano" de `specs/frontend-admin/spec.md`.

- [ ] 4.1 Extraer `CELDA`, `MARGEN` y `Silueta` de `plano-mesas.tsx` a
      `frontend/src/components/reservas/plano-geometria.tsx` (design.md D5) sin cambiar el plano
      del cliente. Verificar que los tests actuales de `plano-mesas.test.tsx` pasan sin
      modificarlos.
- [ ] 4.2 Sumar a `frontend/test/lib/plano-mesas.test.ts` los casos de `frontend/src/lib/plano-mesas.ts` (rojo) y luego implementar: los
      valores válidos de columna y fila según ancho, alto y grilla; la corrección al último valor
      válido; el texto de la ubicación ("las columnas 6 y 7", "la columna 6", "las columnas 6 a
      8") y la lista de superposiciones, con los casos del seed. Verificar que pasan.
- [ ] 4.3 Campos y vista previa. Tests primero (rojo, luego verde): la columna limitada por el
      ancho, el ancho mayor que corrige la columna, la mesa sin ubicar, la vista previa que sigue
      los valores, el aviso de superposición con el botón habilitado, la alternativa textual, y
      que el alta no muestra la sección. Implementar la sección "Ubicación en el plano", la vista
      previa y su texto.
- [ ] 4.4 Pedido y errores. Tests primero (rojo, luego verde): mover, ubicar una mesa sin ubicar,
      guardar sin ubicación sin error, ubicación a medias que no se envía, quitar del plano, el
      pedido con las coordenadas juntas y `ancho`, `alto` y `forma` solo si cambiaron, y la
      superposición rechazada por la API. Implementar el armado del pedido, la regla `ubicacion`
      de `errores-campo.ts` y la columna "Plano" del listado.
- [ ] 4.5 Cambio de zona en el formulario. Tests primero (rojo, luego verde): cambio de zona,
      cambio a una zona más chica que ajusta el tamaño, cambio de zona sin elegir ubicación, con
      la misma columna y fila (envía las dos coordenadas aunque coincidan con las de la zona
      vieja), volver a la zona original que restaura la ubicación, y cambios de zona rápidos con
      la respuesta vieja llegando última. Verificar que pasan y que los
      tests actuales del panel siguen en verde.

## 5. Cierre

- [ ] 5.1 Correr `npm run lint`, `npm run typecheck -w frontend`, los tests del backend (unitarios
      y e2e) y del frontend, `npm run openapi:check` y `openspec validate plano-mesas-admin
      --strict`, y anotar los resultados en el PR.
- [ ] 5.2 Revisión visual en `/admin/salon` con el backend local: mover S4, intentar superponerla
      con S5, quitar S2 del plano y verificar en `/reservas/nueva/resultado` que el plano del
      cliente refleja los cambios. Anotar el resultado en el PR.
- [ ] 5.3 Pedir la aprobación de un compañero y, una vez integrado, archivar el change.
