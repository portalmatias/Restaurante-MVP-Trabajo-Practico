## 1. Prerrequisitos

- [x] 1.1 Confirmar en el PR de esta propuesta qué integrante implementa el change (Lusso
      Facundo o Werkmeister Federico) y anotarlo acá. Crear `feature/reserva-nota-cliente` desde
      `main` actualizado, después de integrada la propuesta.
      Lo implementa lussofacundo-iresm (respuesta en #115, 2026-11-11). Rama creada desde `main`
      en `3bbd7fb`.

## 2. Base y backend (tests primero)

Cada tarea va con tests primero: escribir el test, verlo fallar (rojo), implementar y verlo pasar
(verde). Anotar el rojo y el verde en esta lista.

- [x] 2.1 Agregar `notaCliente String? @db.VarChar(500)` a `Reserva` y generar la migración con
      `npm run db:migrate` (nunca `db push`). Verificar que el SQL generado solo hace `ADD COLUMN`
      y que `npx prisma migrate status` queda al día (design.md D1; spec `modelo-dominio`,
      "Reservas anteriores sin nota").
      Rojo: `reserva-nota-cliente-migracion.integration-spec.ts` (nuevo, mismo patrón que el de
      `plano-mesas`) fallaba con `column "notaCliente" does not exist`. Verde: 1/1, junto con
      `indices-partial` y `plano-mesas-migracion`. `npm run db:migrate` (`prisma migrate dev`)
      no corre en una terminal no interactiva, así que el SQL salió de `prisma migrate diff` y
      se aplicó con `migrate deploy`, como en `plano-mesas`. Se quitó el `CREATE UNIQUE INDEX`
      no parcial que Prisma agregaba sobre `Reserva`: el SQL queda en un solo `ADD COLUMN`.
      `npx prisma migrate status`: al día.
- [x] 2.2 `CrearReservaDto`: `notaCliente` con `@IsOptional()`, el `@Transform` de design.md D2,
      `@IsString()` y el validador `@MaxPuntosDeCodigo(500)` (cuenta con `Array.from`). Tests
      nuevos en `backend/src/reservas/dto/crear-reserva.dto.spec.ts`: sin `notaCliente` y con
      `null` válidos, espacios de los bordes, vacía a `undefined`, 500 y 501 caracteres, 500 con
      espacios en los bordes, 499 letras más "🎂" aceptadas, 499 letras más "❤️" rechazadas y
      `42` rechazado.
      Rojo: 11 de 12 en rojo (el `ValidationPipe` rechazaba `notaCliente` por desconocido; solo
      pasaba «sin nota»). Verde: 12/12. El mensaje de largo es «notaCliente puede tener hasta
      500 caracteres» y el de tipo, «notaCliente debe ser un texto»: empiezan con el nombre del
      campo, que es lo que usa el frontend para llevarlos al campo (3.1).
- [x] 2.3 Guardar la nota al crear y devolverla en `ReservaCreadaRespuestaDto` (`string | null`,
      siempre presente). Tests en `backend/test/reservas-crear.e2e-spec.ts`, uno por escenario de
      `specs/reservas-crear/spec.md` que nombra la nota: sin nota, `null`
      explícito (201), nota recortada en la respuesta, "❤️" en el límite rechazada sin
      persistir, nota vacía a `null`, 500 aceptada, 501 rechazada sin persistir, `42` rechazada
      sin persistir, y el rechazo por falta de lugar igual con nota. Verificar que los tests
      actuales de creación siguen en verde.
      Rojo: 7 de 30 en rojo (la respuesta no traía `notaCliente` y la nota no se guardaba; los
      `400` ya pasaban por el DTO de 2.2). Verde: 30/30, incluidos los actuales de creación. El
      test que fija la forma exacta del `201` suma `notaCliente` a la lista de campos. El input
      del service la toma opcional (`?? null`), así los tests de integración que llaman a
      `crearReserva` directo siguen igual (46/46 en `reservas-concurrencia`,
      `reservas-invariantes` y `plano-mesas`).
- [x] 2.4 La consulta pública NO devuelve la nota (design.md D3). Tests:
      `reserva-consultada.mapper.spec.ts` y `backend/test/reserva-consultar.e2e-spec.ts` ("La
      consulta no devuelve la nota": sin `notaCliente` ni el texto). No se toca
      `ReservaConsultadaRespuestaDto`.
      Sin rojo posible: el mapper arma la vista mínima campo por campo, así que la nota ya no
      salía. Los dos tests nuevos (mapper 11/11, e2e 13/13) son una protección: con una mutación
      que agrega `notaCliente` al mapper, fallan 2 tests (el nuevo y el de la forma exacta).
- [x] 2.5 Sumar `notaCliente` al listado del admin (`ReservaAdminRespuestaDto` y su mapper).
      Tests: `reserva-admin.mapper.spec.ts` y `backend/test/reserva-consultar-listado.e2e-spec.ts`
      ("El listado trae la nota de cada Reserva").
      Rojo: 2 de 4 en el mapper y 1 de 16 en el e2e. Verde: 4/4 y 16/16. El e2e suma una segunda
      Reserva sin nota (cancelada, para no chocar con el índice único parcial de la mesa). El
      fixture de `reservas-cancelar.service.spec.ts` suma `notaCliente: null` porque el tipo de
      la Reserva ahora lo exige. Unitarios del backend: 269/269.
- [x] 2.6 Incorporar el fragmento de design.md D4 (con `nullable: true` en la nota del
      request) a `openapi/openapi.yaml`, regenerar los tipos
      del frontend y verificar que `npm run openapi:check` pasa.
      Rojo: `openapi:check` informó `notaCliente` en los tres esquemas y en los dos `required`.
      Verde: `openapi:check` sin deriva y `openapi:lint` sin errores. El linter pidió además
      sumar `notaCliente` a los dos ejemplos del `201` (STANDARD con `null`, VIP con una nota),
      que se actualizaron en el YAML y en el controller; la descripción del `400` también nombra
      la nota. Tipos del frontend regenerados con `npm run api:types -w frontend`.

## 3. Frontend (tests primero)

- [x] 3.1 Campo «Nota para el restaurante (opcional)» en `formulario-datos-contacto.tsx`, con la
      ayuda, el contador y el error de largo (design.md D5). Tests en
      `frontend/test/components/reservas/formulario-datos-contacto.test.tsx`: reservar sin nota
      (el pedido no la incluye), reservar con nota, el contador con "Celíaco 🎂" en «9 de 500
      caracteres», una nota de 500 con espacios en los bordes que se envía recortada y la nota
      de 501 que no se envía. El contador y el pedido usan `texto.trim()` y `Array.from`.
      Rojo: 9 de 10 tests nuevos (solo pasaba «reservar sin nota»). Verde: 42/42. Además de los
      que pide la tarea: una nota de solo espacios no se envía, y un `400` del backend sobre la
      nota se muestra junto al campo (`notaCliente` entra en `CAMPOS_DEL_DTO`; observación de la
      revisión de #115). El `<textarea>` es propio del formulario, con la ayuda, el contador y el
      error enlazados por `aria-describedby`; el conteo vive en `src/lib/nota-cliente.ts`.
- [x] 3.2 Apartado «Tu nota» en la confirmación (design.md D5): el formulario guarda en
      `sessionStorage` la `notaCliente` de la respuesta (clave por código) antes de navegar a
      `/reservas/nueva/exito`, y un componente cliente de esa página la muestra con
      `whitespace-pre-line`. Tests: en `formulario-datos-contacto.test.tsx`, la nota guardada
      tras crear (y nada si no hay nota); en
      `frontend/test/app/reservas/nueva/exito/page.test.tsx`, la navegación real (guardar, ir
      a la URL de éxito y ver «Tu nota» con la nota recortada y un salto de línea; sin nota no
      hay apartado; la URL no contiene la nota). El detalle de `consulta-reserva.tsx` no
      cambia: test de que no muestra «Tu nota».
      Rojo: 2 de los 6 tests nuevos de la página de éxito (mostrar la nota y borrarla al salir);
      los de «no muestra» ya pasaban. Verde: 125/125 entre la página, `consulta-reserva` y el
      formulario. La nota se borra de `sessionStorage` al desmontarse la confirmación, no al
      leerla (design.md D5; observación de la revisión de #115).
- [x] 3.3 La nota en `listado-reservas.tsx`, debajo del teléfono, con el rótulo «Nota». Tests en
      `frontend/test/components/admin/listado-reservas.test.tsx`: reserva con nota, reserva con
      la nota "Uno es celíaco.\nLlegamos 20:15." (dos líneas separadas), reserva sin nota y la búsqueda «cochecito» que no mira las notas.
      Rojo: 2 de 4 (la nota no se mostraba; «sin nota» y la búsqueda ya pasaban). Verde: 26/26.
      El teléfono deja de llevar `whitespace-nowrap` en la celda y lo lleva en su propio `span`,
      para que la nota pueda cortar línea debajo. Tests del frontend: 891/891.

## 4. Cierre

- [x] 4.1 Correr `npm run lint`, `npm run typecheck -w frontend`, los tests del backend
      (unitarios, de integración y e2e) y del frontend, `npm run openapi:check` y
      `openspec validate reserva-nota-cliente --strict`, y anotar los resultados en el PR.
      Resultados (2026-11-11, base de test migrada y seedeada como en CI): `npm run lint` y
      `npm run typecheck -w frontend` en verde; backend unitarios 269/269, integración 196/196,
      e2e 180/180; frontend 892/892; `openapi:check` sin deriva y `openapi:lint` sin errores;
      `openspec validate reserva-nota-cliente --strict` válido. En la primera corrida de
      integración fallaron por timeout 7 tests de `auth.integration-spec.ts` (archivo que este
      change no toca); solo ese archivo dio 12/12, y la suite completa repetida dio 196/196.
- [x] 4.2 Revisión en el navegador con el backend local: crear una reserva con la nota "Es un
      cumpleaños" y un salto de línea, verla en la confirmación, consultarla con código y email (el detalle no trae la nota),
      y verla en `/admin/reservas`; crear otra sin nota y verificar que no aparece el apartado.
      Anotar el resultado en el PR.
      Hecho el 2026-11-11 con Playwright contra la app local (`npm run dev`, base de desarrollo
      seedeada): la reserva con la nota «Es un cumpleaños.» y un salto de línea (con espacios en
      los bordes) muestra «Tu nota» recortada y en dos líneas, también al recargar; la URL no
      la lleva. Consultada con código y email, el detalle no la muestra. En `/admin/reservas` la
      fila muestra «Nota» con las dos líneas. La reserva sin nota no muestra el apartado ni el
      rótulo. Al salir de la confirmación con «Volver al inicio» la nota se borra de
      `sessionStorage`; con una navegación completa queda hasta cerrar la pestaña (design.md D5).
- [ ] 4.3 Pedir la aprobación de un compañero y, una vez integrado, archivar el change.
