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
- [ ] 2.2 Implementar `problemasDeUbicacion` en `layout-plano.ts` reutilizando `seSuperponen` y
      `ordenarMesasPorEtiqueta` (design.md D2), sin cambiar `validarLayout`. Verificar que 2.1
      pasa y que los tests del seed siguen en verde.

## 3. API de administración

- [ ] 3.1 Escribir los tests en `backend/test/gestion-salon-admin.integration-spec.ts` (rojo), uno por escenario de
      "Ubicación de Mesa en el plano" de `specs/gestion-salon/spec.md`: mover, tocarse, superposición
      `409` con su mensaje, cambio de tamaño `409`, fuera de grilla `400` con su mensaje, coordenada
      a medias `400`, valores fuera de rango `400` (incluido `null` en `ancho`, `alto` o `forma`),
      tamaño mayor que la grilla en una mesa sin ubicar `400`, forma, forma de una mesa con un problema previo
      (cargado directo en la base), quitar del plano, cambio de zona sin ubicación, con ubicación y
      con ubicación fuera de la grilla nueva (usando la mesa S6 que define el spec, cargada directo en la base), pedido sin
      campos del plano, y dos `PATCH` simultáneos con `Promise.all` hacia una celda libre, de los
      que exactamente uno responde `200`. Cada rechazo verifica además que la mesa no cambió en la base.
      Sumar los escenarios de los listados (ubicación en `GET /admin/mesas`, grilla en
      `GET /admin/zonas`, mesa recién creada sin ubicar, S7). Verificar que fallan.
- [ ] 3.2 Agregar `posX`, `posY`, `ancho`, `alto` y `forma` a `ActualizarMesaDto` con las
      validaciones de design.md D1 (`null` distinto de ausente). Verificar con los casos de
      valores fuera de rango de 3.1.
- [ ] 3.3 Extender `MesasService.ejecutarActualizacion` con el lugar final y la validación de
      design.md D2, dentro de la transacción `Serializable` existente. Verificar que pasan los
      escenarios de edición de 3.1, incluido el de pedidos simultáneos, y que los tests actuales
      de `mesas.service.spec.ts`, `mesas.integration-spec.ts` y `gestion-salon-admin.integration-spec.ts` siguen en verde.
- [ ] 3.4 Sumar los campos del plano a `MesaRespuestaDto`, `planoColumnas`/`planoFilas` a
      `ZonaRespuestaDto`, y las mismas columnas a `SELECT_MESA_ADMIN` (`mesas.service.ts`) y
      `SELECT_ZONA_ADMIN` (`zonas.service.ts` y su copia en `zonas.service.spec.ts`), que hoy las
      excluyen (design.md D4). Cambiar `plano-mesas-salidas-admin.integration-spec.ts` para que
      exija las claves nuevas en `GET`, `POST` y `PATCH` de mesas y `GET` y `PATCH` de zonas.
      Verificar que pasan ese test y los escenarios de listado de 3.1.
- [ ] 3.5 Incorporar el fragmento OpenAPI de design.md a `openapi/openapi.yaml` y regenerar los
      tipos del frontend. Verificar con `npm run openapi:check` y `npm run typecheck -w frontend`.

## 4. Pantalla del admin

- [ ] 4.1 Extraer `CELDA`, `MARGEN` y `Silueta` de `plano-mesas.tsx` a
      `frontend/src/components/reservas/plano-geometria.tsx` (design.md D5) sin cambiar el plano
      del cliente. Verificar que los tests actuales de `plano-mesas.test.tsx` pasan sin
      modificarlos.
- [ ] 4.2 Sumar a `frontend/test/lib/plano-mesas.test.ts` los casos de `frontend/src/lib/plano-mesas.ts` (rojo) y luego implementar: los
      valores válidos de columna y fila según ancho, alto y grilla; la corrección al último valor
      válido; el texto de la ubicación ("las columnas 6 y 7", "la columna 6", "las columnas 6 a
      8") y la lista de superposiciones, con los casos del seed. Verificar que pasan.
- [ ] 4.3 Sumar al bloque `MesasPanel` de `frontend/test/components/admin/salon.test.tsx` un test por escenario
      de "Ubicación de la Mesa en el plano" de `specs/frontend-admin/spec.md` (rojo), incluido que
      que el pedido lleva `ancho`, `alto` y `forma` solo si cambiaron, las coordenadas siempre
      juntas y, tras un cambio de zona, las dos aunque coincidan con las de la zona vieja, y que el
      alta no muestra la sección. Verificar que fallan.
- [ ] 4.4 Implementar la sección "Ubicación en el plano", la vista previa y su texto, la regla
      `ubicacion` de `errores-campo.ts` y la columna "Plano" del listado. Verificar que pasa 4.3 y
      que los tests actuales del panel siguen en verde.

## 5. Cierre

- [ ] 5.1 Correr `npm run lint`, `npm run typecheck -w frontend`, los tests del backend (unitarios
      y e2e) y del frontend, `npm run openapi:check` y `openspec validate plano-mesas-admin
      --strict`, y anotar los resultados en el PR.
- [ ] 5.2 Revisión visual en `/admin/salon` con el backend local: mover S4, intentar superponerla
      con S5, quitar S2 del plano y verificar en `/reservas/nueva/resultado` que el plano del
      cliente refleja los cambios. Anotar el resultado en el PR.
- [ ] 5.3 Pedir la aprobación de un compañero y, una vez integrado, archivar el change.
