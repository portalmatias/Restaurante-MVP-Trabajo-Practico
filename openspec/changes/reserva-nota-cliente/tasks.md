## 1. Prerrequisitos

- [ ] 1.1 Confirmar en el PR de esta propuesta qué integrante implementa el change (Lusso
      Facundo o Werkmeister Federico) y anotarlo acá. Crear `feature/reserva-nota-cliente` desde
      `main` actualizado, después de integrada la propuesta.

## 2. Base y backend (tests primero)

Cada tarea va con tests primero: escribir el test, verlo fallar (rojo), implementar y verlo pasar
(verde). Anotar el rojo y el verde en esta lista.

- [ ] 2.1 Agregar `notaCliente String? @db.VarChar(500)` a `Reserva` y generar la migración con
      `npm run db:migrate` (nunca `db push`). Verificar que el SQL generado solo hace `ADD COLUMN`
      y que `npx prisma migrate status` queda al día (design.md D1; spec `modelo-dominio`,
      "Reservas anteriores sin nota").
- [ ] 2.2 `CrearReservaDto`: `notaCliente` opcional con el `@Transform` de design.md D2,
      `@IsString()` y `@MaxLength(500)`. Tests nuevos en
      `backend/src/reservas/dto/crear-reserva.dto.spec.ts`: espacios de los bordes, vacía a
      `undefined`, 500 y 501 caracteres, 500 con espacios en los bordes, 499 letras más "🎂" y
      `42` rechazado.
- [ ] 2.3 Guardar la nota al crear y devolverla en `ReservaCreadaRespuestaDto` (`string | null`,
      siempre presente). Tests en `backend/test/reservas-crear.e2e-spec.ts`, uno por escenario de
      `specs/reservas-crear/spec.md` que nombra la nota: sin nota, nota recortada en la
      respuesta, nota vacía a `null`, 500 aceptada, 501 rechazada sin persistir, `42` rechazada
      sin persistir, y el rechazo por falta de lugar igual con nota. Verificar que los tests
      actuales de creación siguen en verde.
- [ ] 2.4 Sumar `notaCliente` a la consulta pública (`ReservaConsultadaRespuestaDto` y su
      mapper). Tests: `reserva-consultada.mapper.spec.ts` y
      `backend/test/reserva-consultar.e2e-spec.ts` ("La consulta devuelve la nota" y "La
      consulta fallida no revela la nota").
- [ ] 2.5 Sumar `notaCliente` al listado del admin (`ReservaAdminRespuestaDto` y su mapper).
      Tests: `reserva-admin.mapper.spec.ts` y `backend/test/reserva-consultar-listado.e2e-spec.ts`
      ("El listado trae la nota de cada Reserva").
- [ ] 2.6 Incorporar el fragmento de design.md D4 a `openapi/openapi.yaml`, regenerar los tipos
      del frontend y verificar que `npm run openapi:check` pasa.

## 3. Frontend (tests primero)

- [ ] 3.1 Campo «Nota para el restaurante (opcional)» en `formulario-datos-contacto.tsx`, con la
      ayuda, el contador y el error de largo (design.md D5). Tests en
      `frontend/test/components/reservas/formulario-datos-contacto.test.tsx`: reservar sin nota
      (el pedido no la incluye), reservar con nota, el contador con "Celíaco 🎂" en «9 de 500
      caracteres» y la nota de 501 que no se envía.
- [ ] 3.2 Apartado «Tu nota» en la confirmación (dentro de `formulario-datos-contacto.tsx`) y en
      el detalle de `consulta-reserva.tsx`, con `whitespace-pre-line`. Tests: confirmación con
      nota, detalle sin nota (sin el apartado) y la nota con un salto de línea, en
      `formulario-datos-contacto.test.tsx` y `consulta-reserva.test.tsx`.
- [ ] 3.3 La nota en `listado-reservas.tsx`, debajo del teléfono, con el rótulo «Nota». Tests en
      `frontend/test/components/admin/listado-reservas.test.tsx`: reserva con nota, reserva sin
      nota y la búsqueda «cochecito» que no mira las notas.

## 4. Cierre

- [ ] 4.1 Correr `npm run lint`, `npm run typecheck -w frontend`, los tests del backend
      (unitarios, de integración y e2e) y del frontend, `npm run openapi:check` y
      `openspec validate reserva-nota-cliente --strict`, y anotar los resultados en el PR.
- [ ] 4.2 Revisión en el navegador con el backend local: crear una reserva con la nota "Es un
      cumpleaños" y un salto de línea, verla en la confirmación, consultarla con código y email,
      y verla en `/admin/reservas`; crear otra sin nota y verificar que no aparece el apartado.
      Anotar el resultado en el PR.
- [ ] 4.3 Pedir la aprobación de un compañero y, una vez integrado, archivar el change.
