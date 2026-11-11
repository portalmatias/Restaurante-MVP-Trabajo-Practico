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
- [ ] 2.2 `CrearReservaDto`: `notaCliente` con `@IsOptional()`, el `@Transform` de design.md D2,
      `@IsString()` y el validador `@MaxPuntosDeCodigo(500)` (cuenta con `Array.from`). Tests
      nuevos en `backend/src/reservas/dto/crear-reserva.dto.spec.ts`: sin `notaCliente` y con
      `null` válidos, espacios de los bordes, vacía a `undefined`, 500 y 501 caracteres, 500 con
      espacios en los bordes, 499 letras más "🎂" aceptadas, 499 letras más "❤️" rechazadas y
      `42` rechazado.
- [ ] 2.3 Guardar la nota al crear y devolverla en `ReservaCreadaRespuestaDto` (`string | null`,
      siempre presente). Tests en `backend/test/reservas-crear.e2e-spec.ts`, uno por escenario de
      `specs/reservas-crear/spec.md` que nombra la nota: sin nota, `null`
      explícito (201), nota recortada en la respuesta, "❤️" en el límite rechazada sin
      persistir, nota vacía a `null`, 500 aceptada, 501 rechazada sin persistir, `42` rechazada
      sin persistir, y el rechazo por falta de lugar igual con nota. Verificar que los tests
      actuales de creación siguen en verde.
- [ ] 2.4 La consulta pública NO devuelve la nota (design.md D3). Tests:
      `reserva-consultada.mapper.spec.ts` y `backend/test/reserva-consultar.e2e-spec.ts` ("La
      consulta no devuelve la nota": sin `notaCliente` ni el texto). No se toca
      `ReservaConsultadaRespuestaDto`.
- [ ] 2.5 Sumar `notaCliente` al listado del admin (`ReservaAdminRespuestaDto` y su mapper).
      Tests: `reserva-admin.mapper.spec.ts` y `backend/test/reserva-consultar-listado.e2e-spec.ts`
      ("El listado trae la nota de cada Reserva").
- [ ] 2.6 Incorporar el fragmento de design.md D4 (con `nullable: true` en la nota del
      request) a `openapi/openapi.yaml`, regenerar los tipos
      del frontend y verificar que `npm run openapi:check` pasa.

## 3. Frontend (tests primero)

- [ ] 3.1 Campo «Nota para el restaurante (opcional)» en `formulario-datos-contacto.tsx`, con la
      ayuda, el contador y el error de largo (design.md D5). Tests en
      `frontend/test/components/reservas/formulario-datos-contacto.test.tsx`: reservar sin nota
      (el pedido no la incluye), reservar con nota, el contador con "Celíaco 🎂" en «9 de 500
      caracteres», una nota de 500 con espacios en los bordes que se envía recortada y la nota
      de 501 que no se envía. El contador y el pedido usan `texto.trim()` y `Array.from`.
- [ ] 3.2 Apartado «Tu nota» en la confirmación (design.md D5): el formulario guarda en
      `sessionStorage` la `notaCliente` de la respuesta (clave por código) antes de navegar a
      `/reservas/nueva/exito`, y un componente cliente de esa página la muestra con
      `whitespace-pre-line`. Tests: en `formulario-datos-contacto.test.tsx`, la nota guardada
      tras crear (y nada si no hay nota); en
      `frontend/test/app/reservas/nueva/exito/page.test.tsx`, la navegación real (guardar, ir
      a la URL de éxito y ver «Tu nota» con la nota recortada y un salto de línea; sin nota no
      hay apartado; la URL no contiene la nota). El detalle de `consulta-reserva.tsx` no
      cambia: test de que no muestra «Tu nota».
- [ ] 3.3 La nota en `listado-reservas.tsx`, debajo del teléfono, con el rótulo «Nota». Tests en
      `frontend/test/components/admin/listado-reservas.test.tsx`: reserva con nota, reserva con
      la nota "Uno es celíaco.\nLlegamos 20:15." (dos líneas separadas), reserva sin nota y la búsqueda «cochecito» que no mira las notas.

## 4. Cierre

- [ ] 4.1 Correr `npm run lint`, `npm run typecheck -w frontend`, los tests del backend
      (unitarios, de integración y e2e) y del frontend, `npm run openapi:check` y
      `openspec validate reserva-nota-cliente --strict`, y anotar los resultados en el PR.
- [ ] 4.2 Revisión en el navegador con el backend local: crear una reserva con la nota "Es un
      cumpleaños" y un salto de línea, verla en la confirmación, consultarla con código y email (el detalle no trae la nota),
      y verla en `/admin/reservas`; crear otra sin nota y verificar que no aparece el apartado.
      Anotar el resultado en el PR.
- [ ] 4.3 Pedir la aprobación de un compañero y, una vez integrado, archivar el change.
