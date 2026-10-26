## 1. Prerrequisitos

- [x] 1.1 Confirmar que el equipo respondió las preguntas abiertas 1, 3 y 5 de `design.md`
      (elegir mesa, límite de solicitudes, editor de admin) y anotar la respuesta en el PR. No
      empezar el Grupo 3 sin la 3.
      Resultado (26/10/2026): el equipo confirmó las propuestas del diseño: 1) elegir mesa queda
      fuera de alcance, para un change futuro; 3) 120 solicitudes por 60 s; 5) alcanza con el
      layout del seed, sin editor de admin antes de la entrega.
- [x] 1.2 Crear `feature/plano-mesas` desde `main` actualizado y verificar con `git log` que
      existen `backend/src/disponibilidad/contexto/cargar-contexto.ts`,
      `backend/src/reservas/elegir-mesa-best-fit.ts` y `frontend/src/lib/api/schema.d.ts`.
- [x] 1.3 Anotar en la descripción del PR cualquier diferencia entre lo asumido en `design.md`
      (firmas de `cargarContexto`, `evaluarReglas`, `calcularLugaresRestantes`) y el código real.
      Resultado: las firmas coinciden. Diferencias: `contexto.zona` no trae `planoColumnas` ni
      `planoFilas` (el service las lee aparte en la misma transacción, paso 4 de D2), y
      `DisponibilidadService` usa `new Date()` sin reloj inyectado.

## 2. Modelo de datos y seed (tests primero)

- [x] 2.1 Escribir `backend/test/plano-mesas-modelo.integration-spec.ts` (rojo): una mesa nueva
      tiene `posX/posY` nulos, `ancho/alto` 1 y `forma` `RECTANGULAR`; una zona nueva tiene
      `planoColumnas/planoFilas` 12 y 8; `posX` sin `posY`, `posX` o `posY` negativos, `ancho` o
      `alto` 0 y `planoColumnas` o `planoFilas` 0 son rechazados por la base. Verificar que falla.
- [x] 2.2 Agregar a `backend/prisma/schema.prisma` el enum `FormaMesa` y las columnas de `Mesa`
      (`posX`, `posY`, `ancho`, `alto`, `forma`) y de `Zona` (`planoColumnas`, `planoFilas`), con
      comentarios en español.
- [x] 2.3 Generar la migración con `prisma migrate dev --create-only --name plano_mesas` (sin
      aplicarla). **Revisar el SQL**: quitar cualquier intento de reescribir el índice único parcial de `Reserva`, y agregar a
      mano los `CHECK` (`posX >= 0`, `posY >= 0`, ambos nulos o ambos no nulos, `ancho >= 1`,
      `alto >= 1`, `planoColumnas >= 1`, `planoFilas >= 1`). Recién entonces aplicarla con
      `prisma migrate dev`. Nunca `db push`. Verificar que 2.1 pasa y que `indices-partial.integration-spec.ts` sigue en verde.
      Nota: `prisma migrate dev` no corre en una terminal no interactiva; el SQL se generó con
      `prisma migrate diff` contra la base de desarrollo al día (mismo resultado) y se aplicó con
      `prisma migrate deploy`. Se quitó el `CREATE UNIQUE INDEX` no parcial de `Reserva`.
      `migrate deploy` no hace el chequeo de drift de `migrate dev`; lo cubren `migrate diff`
      (que compara contra la base real al día) y el test de 2.4, que aplica todas las
      migraciones desde cero sobre una base descartable.
- [x] 2.4 Escribir el test de migración sobre datos previos (rojo→verde): con mesas y reservas
      cargadas antes de aplicar la migración, después conservan `id`, `zonaId`, `capacidad`, `etiqueta`
      y `mesaId`.
      Verificado en rojo quitando la migración (`column "posX" does not exist`) y en verde con
      ella (`plano-mesas-migracion.integration-spec.ts`).
- [x] 2.5 Escribir `backend/src/plano-mesas/layout-plano.spec.ts` (rojo): la función pura
      `validarLayout(zona, mesas)` detecta mesa fuera de grilla y solapamiento, y acepta el
      layout de `design.md` D1. Implementarla en `backend/src/plano-mesas/layout-plano.ts` hasta
      que pase (el jest unitario solo recolecta `backend/src/**/*.spec.ts`; el seed la importa
      desde ahí).
- [x] 2.6 Actualizar `backend/prisma/seed.ts` con el layout de D1 (STANDARD 12×8, VIP 10×6) en
      el `create` y el `update` del `upsert` por `etiqueta`, y con las dimensiones de las zonas.
      Llamar a `validarLayout` antes de escribir. Verificar con un test de integración del seed
      que entra en la grilla, no se solapa y es idempotente (dos corridas, mismas posiciones).
      Desvío acordado con el equipo (26/10/2026): el layout vive en `prisma/plano-desarrollo.ts`
      y lo aplica solo `seed.ts` con `update` por clave natural, después del catálogo, y no en el
      `upsert` de `prisma/catalogo.ts`. El catálogo también lo usa el seed de producción, que se
      compila con `tsconfig.seed.json` (solo admite `prisma/`, y `validarLayout` vive en `src/`)
      y no modifica mesas existentes. Cargar el plano en producción queda para un change propio.
      Test: `plano-mesas-seed.integration-spec.ts`.
- [x] 2.7 Confirmar a mano que `POST/PATCH /admin/mesas` siguen funcionando sin enviar las
      columnas nuevas (suite `gestion-salon-admin` y `mesas.integration-spec.ts` en verde).
      Resultado: `gestion-salon-admin` y `mesas.integration-spec.ts`, 26 de 26.

- [x] 2.8 Escribir (rojo) un test de integración que fije las claves exactas (`Object.keys`
      iguales a las actuales, sin `posX`, `posY`, `ancho`, `alto`, `forma`, `planoColumnas` ni
      `planoFilas`) de las **cinco salidas** de admin que hoy devuelven la fila de Prisma:
      `GET /admin/zonas`, `PATCH /admin/zonas/:id`, `GET /admin/mesas`, `POST /admin/mesas` y
      `PATCH /admin/mesas/:id`. Agregar un `select` explícito con los campos actuales en
      `ZonasService` (`listar` y `ejecutarActualizacion`, el `tx.zona.update`) y en
      `MesasService` (`listar`, `crear` y `actualizar`, el `mesa.create` y el `tx.mesa.update`), y
      actualizar sus `*.spec.ts` unitarios (hoy fijan `findMany({ where })`, `create` y `update`
      sin `select`). Confirmar con `git grep` que no queda otra salida de `zona` o `mesa`
      que devuelva la fila completa (`eliminar` no devuelve cuerpo y los mappers de reservas ya
      eligen los campos). Verificar que pasa.
      Test: `plano-mesas-salidas-admin.integration-spec.ts`. El resto de las lecturas de `zona` y
      `mesa` sin `select` son internas (validaciones) y no se devuelven.

## 3. Backend: servicio y reglas del plano (tests primero)

- [x] 3.1 Escribir `backend/src/plano-mesas/estado-mesa.spec.ts` (rojo) para la función pura
      `calcularEstadoMesa(mesa, mesasLibresIds, comensales)`: libre, ocupada, no alcanza,
      ocupada y chica ⇒ ocupada, capacidad exacta ⇒ libre. Incluir en
      `backend/src/plano-mesas/orden-mesas.spec.ts` la función pura `ordenarMesasPorEtiqueta`
      (orden natural: S1, S2, S10 y no S1, S10, S2).
- [x] 3.2 Implementar `backend/src/plano-mesas/estado-mesa.ts` y `orden-mesas.ts`. Verificar que
      3.1 pasa.
- [x] 3.3 Escribir `backend/test/plano-mesas.integration-spec.ts` (rojo) contra PostgreSQL real
      con los escenarios de la spec `plano-mesas`, **con fechas relativas a hoy o con el reloj
      inyectado** (las fechas literales de la spec son ilustrativas; ver `design.md`, D8): ocupada por `CONFIRMADA` y por `PENDIENTE`,
      liberada por `CANCELADA` y `NO_SHOW`, otra fecha/turno/zona no ocupa, no alcanza, mesa sin
      ubicar, veredicto igual al de `DisponibilidadService.consultar`, e invariante
      `existe mesa LIBRE ⇔ SIN_MESA_DISPONIBLE ∉ motivos` recorriendo una grilla de
      combinaciones.
      Nota: corre en un schema de Postgres propio con el seed de desarrollo cargado, porque los
      escenarios afirman la lista exacta de mesas; las fechas son el próximo sábado y el próximo
      lunes a 3 días o más, y el reloj del plano se reemplaza por `() => new Date()`, leído en
      cada consulta, el mismo que usa `DisponibilidadService`.
- [x] 3.4 Agregar en el mismo archivo el test de **no fuga de datos**: con una reserva de nombre,
      email, teléfono y código reconocibles, el cuerpo serializado no los contiene ni contiene
      el id de la reserva ni de la mesa; cada mesa tiene exactamente las ocho propiedades (`Object.keys` iguales a la lista del
      esquema, no solo "contiene").
      Verificado que muerde: exponer el `id` de la mesa hace fallar 2 casos.
- [x] 3.5 Crear `backend/src/plano-mesas/dto/` (`PlanoMesasRespuesta`, `MesaPlano`, enums con
      `enumName` `EstadoMesaPlano` y `FormaMesa`) con `@ApiProperty` y textos en español,
      reutilizando `ConsultarDisponibilidadDto`, `MotivoNoDisponible` y `ErrorRespuesta`.
      Nota: `zona` usa el enum en línea (como las demás respuestas), sin `enumName`; el contrato no
      tiene un schema `NombreZona`.
- [x] 3.6 Implementar `PlanoMesasService.consultar` según D2, con el reloj inyectado: una
      transacción `RepeatableRead` de solo lectura que ejecuta `cargarContexto(tx, …)` y la
      lectura de mesas con `select` explícito, y después `evaluarReglas`,
      `calcularLugaresRestantes`, el estado vía `calcularEstadoMesa` sobre
      `contexto.mesasLibres` y el orden con `ordenarMesasPorEtiqueta`. Verificar que 3.3 y 3.4
      pasan y que el service no toma locks ni escribe.
      Nota: además del aislamiento `RepeatableRead`, la transacción declara `SET TRANSACTION READ
      ONLY`. El reloj es el provider `RELOJ` del módulo.
- [x] 3.7 Escribir el test de consistencia con la creación (rojo→verde): plano, creación de
      reserva con los mismos datos, y la mesa asignada estaba `LIBRE`; luego el plano la muestra
      `OCUPADA`. Reutilizar los helpers de `reservas-crear`.
      Nota: el plano ya existía al escribirlo, así que se vio directamente en verde.
- [x] 3.8 Escribir el test de concurrencia (patrón de `reservas-concurrencia.integration-spec.ts`):
      dos creaciones sobre la última mesa que alcanza, una gana, y el plano posterior la muestra
      `OCUPADA`. Confirmar que el plano no toma locks ni escribe (inspección del service).
      Inspección: el service no llama a `bloquearTurnoFecha` y su transacción es de solo lectura.

## 4. Backend: controller, límite y contrato

- [x] 4.1 Escribir `backend/test/plano-mesas.e2e-spec.ts` (rojo): `200` sin token, `400` con
      `comensales=0`, `404` con turno o zona inexistentes, header `Cache-Control: no-store`,
      y `429` en la solicitud 121 tras enviar las 120 permitidas, todas reales (patrón de
      `throttle-rutas-admin.e2e-spec.ts`, que envía las 60 de admin sin bajar el límite: no se
      agrega ninguna variable de entorno); la solicitud rechazada no ejecuta consultas.
      La solicitud 121 no ejecuta consultas: el spy de `PlanoMesasService.consultar` queda en 120.
- [x] 4.2 Implementar `PlanoMesasController` con `@Throttle` (120 por 60 s, constante nombrada),
      `Cache-Control: no-store` y decoradores `@nestjs/swagger` en español, y
      `PlanoMesasModule` (importa `DisponibilidadModule` y `PrismaModule`); registrarlo en
      `AppModule`. Verificar que 4.1 pasa.
- [x] 4.3 Revisar cómo `scripts/openapi-diff.mjs` normaliza los tipos nulables
      (`type: [integer, 'null']` frente a `nullable: true`) leyendo el script y su test
      (`npm run test:scripts`); definir la forma común antes de escribir el YAML: ambos lados deben usar la misma
      representación, porque el script no las equipara.
      Resultado (26/10/2026): `scripts/openapi-diff.mjs` no normaliza nulables y `@nestjs/swagger`
      11 emite `nullable: true`. Forma común: `type: integer` + `nullable: true` en los dos lados.
      Spectral lo acepta en 3.1 sin advertencias y `openapi-typescript` genera `number | null`.
- [x] 4.4 Agregar a `openapi/openapi.yaml` el path `/plano-mesas` y los esquemas
      `PlanoMesasRespuesta`, `MesaPlano`, `EstadoMesaPlano` y `FormaMesa` (D2), con `400`, `404` y
      `429` y ejemplos, **sin** `additionalProperties` (ningún esquema actual lo usa y
      `openapi:check` lo contaría como deriva; la ausencia de claves de más la prueba la tarea
      3.4), y con texto idéntico al de los decoradores.
      Nota: el ejemplo de `fecha` va entre comillas (`'2026-09-15'`): sin ellas el YAML lo lee como
      fecha y `openapi:check` lo cuenta como deriva.
- [x] 4.5 Correr `npm run openapi:check` y `npm run openapi:lint`; resolver cualquier deriva
      corrigiendo el decorador o el YAML, no el script.
      Resultado: `openapi:check` sin deriva (con `backend/dist` recién compilado) y `openapi:lint`
      sin errores ni advertencias.
- [x] 4.6 Regenerar el cliente con `npm run api:types` y verificar `api:types:check` del
      frontend.

## 5. Frontend (estética Kakefuda: tokens de `frontend/app/globals.css`)

- [x] 5.1 Escribir `frontend/test/lib/plano-mesas.test.ts` (rojo) para los helpers puros de
      `frontend/src/lib/plano-mesas.ts`: texto por estado, resumen ("3 libres, 1 ocupada, 1
      que no alcanza"), orden de la lista y separación de mesas sin ubicar. Implementarlos hasta
      que pasen.
- [x] 5.2 Escribir `frontend/test/components/reservas/plano-mesas.test.tsx` (rojo): lista con
      etiqueta, capacidad y estado en palabras; leyenda con los tres estados; cada estado con
      patrón, marca y texto (no solo color); mesa sin ubicar solo en la lista; SVG con
      `aria-hidden`; resumen con `role="status"`; sin controles de selección de mesa.
- [ ] 5.3 Implementar `frontend/src/components/reservas/plano-mesas.tsx`: SVG con `viewBox` en
      celdas, formas redonda/cuadrada/rectangular como tablillas de madera con los tokens
      existentes (sin hex propios), patrones de relleno y marcas por estado, leyenda y lista.
      Avance (26/10/2026): el componente ya tiene el SVG con `viewBox` en celdas, las tres formas,
      los patrones y las marcas por estado, la leyenda y la lista, con los tokens actuales. Falta
      el estilo de tablillas de madera, que depende de los tokens del rediseño (#78).
- [x] 5.4 Agregar los tests (rojo→verde) del atenuado y el aviso cuando `disponible` es `false`
      (motivos primero, texto "hoy no se puede reservar este turno") y de la aclaración
      "La mesa se asigna automáticamente al confirmar la reserva" / "foto del momento".
- [ ] 5.5 Escribir tests y componente del esqueleto `plano-mesas-cargando.tsx`: `aria-busy`,
      texto accesible, y la regla CSS `@media (prefers-reduced-motion: reduce)` que apaga su
      animación en el componente o en `globals.css` usando solo tokens existentes. El test
      comprueba que la regla existe en la hoja de estilos; **no** se simula `matchMedia` porque
      `jsdom` no evalúa media queries (la prueba real es la manual de 6.1).
- [x] 5.6 Tests y manejo de errores: fallo `5xx`/red ⇒ mensaje + "Reintentar" reutilizando
      `error-con-reintento.tsx` y la reserva sigue disponible; `429` ⇒ mensaje específico sin
      reintento automático.
- [x] 5.7 Integrar en `frontend/app/reservas/nueva/resultado/page.tsx`: el plano es la fuente
      del veredicto (`disponible`, `motivos`) y se pide con `cache: "no-store"` junto al
      catálogo; `/disponibilidad` se pide solo si el plano falla (red, `5xx`, `429`, `404` o `400`), y
      entonces la sección del plano muestra su error (D7). Solo un `404` de
      `/disponibilidad` redirige al paso 1; un `400` muestra la pantalla de selección inválida. El error del plano no tumba la página. La página hoy
      retorna antes cuando `disponible` es `false` (lista los motivos); esa rama también debe
      renderizar el plano atenuado con su aviso, después de los motivos, y se cubre con un test
      propio. Tests: plano `404` o `400` ⇒ sin redirección y veredicto de `/disponibilidad`;
      plano y `/disponibilidad` con `404` ⇒ redirección; los dos con `400` ⇒ selección inválida sin
      redirección. Verificar que los tests existentes de la página siguen en verde.
- [ ] 5.8 Orden en celular: lista antes que dibujo en pantallas angostas, sin scroll horizontal de
      la página a 360 px (test del componente con las clases de orden y revisión visual).

## 6. Verificación final

- [ ] 6.1 Revisión visual real: levantar backend y frontend con el seed, abrir
      `/reservas/nueva/resultado` en escritorio y en 360 px, capturar pantallas de STANDARD y
      VIP con mesas libres, ocupadas y que no alcanzan, y confirmar que se distinguen en
      escala de grises y con el lector de pantalla leyendo la lista. Con "reducir movimiento"
      activado en el sistema operativo, comprobar que el esqueleto no se anima. Adjuntar
      capturas al PR.
- [x] 6.2 Prueba manual de seguridad: con curl y sin token, consultar el plano de un turno con
      una reserva real del seed y confirmar a ojo que no aparece ningún dato personal ni id;
      comprobar el `429` excediendo el límite.
      Resultado (26/10/2026), backend compilado contra la base de desarrollo con el seed: el plano de
      los turnos con las reservas del seed en S3 (CONFIRMADA) y V1 (PENDIENTE) responde `200` con
      `Cache-Control: no-store`, sin nombres, emails, códigos ni ids, y las dos mesas solo como
      `OCUPADA`. Tras 120 consultas, la 121 responde `429`; `/disponibilidad` sigue en `200`.
- [ ] 6.3 Correr `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`,
      `npm run test:e2e`, `npm run test:frontend`, `npm run test:scripts`, `npm run
      openapi:check` y `openspec validate --all --strict`; todo en verde, sin warnings nuevos.
- [x] 6.4 Actualizar el README (o la documentación de seed) con el layout del plano y la
      nota de que el admin todavía no lo edita (D6).
      README: sección «Plano de mesas del seed», con la nota de D6 y la de producción.
- [ ] 6.5 Abrir el PR en español enlazado a este change, pedir la aprobación de un compañero y,
      una vez mergeado, archivar con `openspec archive plano-mesas`.
