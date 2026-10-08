## 1. Prerrequisitos

- [ ] 1.1 Confirmar que el equipo respondió las preguntas abiertas 1, 3 y 5 de `design.md`
      (elegir mesa, límite de solicitudes, editor de admin) y anotar la respuesta en el PR. No
      empezar el Grupo 3 sin la 3.
- [ ] 1.2 Crear `feature/plano-mesas` desde `main` actualizado y verificar con `git log` que
      existen `backend/src/disponibilidad/contexto/cargar-contexto.ts`,
      `backend/src/reservas/elegir-mesa-best-fit.ts` y `frontend/src/lib/api/schema.d.ts`.
- [ ] 1.3 Anotar en la descripción del PR cualquier diferencia entre lo asumido en `design.md`
      (firmas de `cargarContexto`, `evaluarReglas`, `calcularLugaresRestantes`) y el código real.

## 2. Modelo de datos y seed (tests primero)

- [ ] 2.1 Escribir `backend/test/plano-mesas-modelo.integration-spec.ts` (rojo): una mesa nueva
      tiene `posX/posY` nulos, `ancho/alto` 1 y `forma` `RECTANGULAR`; una zona nueva tiene
      `planoColumnas/planoFilas` 12 y 8; `posX` sin `posY`, `posX` o `posY` negativos, `ancho` o
      `alto` 0 y `planoColumnas` o `planoFilas` 0 son rechazados por la base. Verificar que falla.
- [ ] 2.2 Agregar a `backend/prisma/schema.prisma` el enum `FormaMesa` y las columnas de `Mesa`
      (`posX`, `posY`, `ancho`, `alto`, `forma`) y de `Zona` (`planoColumnas`, `planoFilas`), con
      comentarios en español.
- [ ] 2.3 Generar la migración con `prisma migrate dev --create-only --name plano_mesas` (sin
      aplicarla). **Revisar el SQL**: quitar cualquier intento de reescribir el índice único parcial de `Reserva`, y agregar a
      mano los `CHECK` (`posX >= 0`, `posY >= 0`, ambos nulos o ambos no nulos, `ancho >= 1`,
      `alto >= 1`, `planoColumnas >= 1`, `planoFilas >= 1`). Recién entonces aplicarla con
      `prisma migrate dev`. Nunca `db push`. Verificar que 2.1 pasa y que `indices-partial.integration-spec.ts` sigue en verde.
- [ ] 2.4 Escribir el test de migración sobre datos previos (rojo→verde): con mesas y reservas
      cargadas antes de aplicar la migración, después conservan `id`, `zonaId`, `capacidad`, `etiqueta`
      y `mesaId`.
- [ ] 2.5 Escribir `backend/src/plano-mesas/layout-plano.spec.ts` (rojo): la función pura
      `validarLayout(zona, mesas)` detecta mesa fuera de grilla y solapamiento, y acepta el
      layout de `design.md` D1. Implementarla en `backend/src/plano-mesas/layout-plano.ts` hasta
      que pase (el jest unitario solo recolecta `backend/src/**/*.spec.ts`; el seed la importa
      desde ahí).
- [ ] 2.6 Actualizar `backend/prisma/seed.ts` con el layout de D1 (STANDARD 12×8, VIP 10×6) en
      el `create` y el `update` del `upsert` por `etiqueta`, y con las dimensiones de las zonas.
      Llamar a `validarLayout` antes de escribir. Verificar con un test de integración del seed
      que entra en la grilla, no se solapa y es idempotente (dos corridas, mismas posiciones).
- [ ] 2.7 Confirmar a mano que `POST/PATCH /admin/mesas` siguen funcionando sin enviar las
      columnas nuevas (suite `gestion-salon-admin` y `mesas.integration-spec.ts` en verde).

## 3. Backend: servicio y reglas del plano (tests primero)

- [ ] 3.1 Escribir `backend/src/plano-mesas/estado-mesa.spec.ts` (rojo) para la función pura
      `calcularEstadoMesa(mesa, mesasLibresIds, comensales)`: libre, ocupada, no alcanza,
      ocupada y chica ⇒ ocupada, capacidad exacta ⇒ libre.
- [ ] 3.2 Implementar `backend/src/plano-mesas/estado-mesa.ts`. Verificar que 3.1 pasa.
- [ ] 3.3 Escribir `backend/test/plano-mesas.integration-spec.ts` (rojo) contra PostgreSQL real
      con los escenarios de la spec `plano-mesas`: ocupada por `CONFIRMADA` y por `PENDIENTE`,
      liberada por `CANCELADA` y `NO_SHOW`, otra fecha/turno/zona no ocupa, no alcanza, mesa sin
      ubicar, veredicto igual al de `DisponibilidadService.consultar`, e invariante
      `existe mesa LIBRE ⇔ SIN_MESA_DISPONIBLE ∉ motivos` recorriendo una grilla de
      combinaciones.
- [ ] 3.4 Agregar en el mismo archivo el test de **no fuga de datos**: con una reserva de nombre,
      email, teléfono y código reconocibles, el cuerpo serializado no los contiene ni contiene
      el id de la reserva ni de la mesa; cada mesa tiene exactamente las ocho propiedades.
- [ ] 3.5 Crear `backend/src/plano-mesas/dto/` (`PlanoMesasRespuesta`, `MesaPlano`, enums con
      `enumName` `EstadoMesaPlano` y `FormaMesa`) con `@ApiProperty` y textos en español,
      reutilizando `ConsultarDisponibilidadDto`, `MotivoNoDisponible` y `ErrorRespuesta`.
- [ ] 3.6 Implementar `PlanoMesasService.consultar` según D2: `cargarContexto`, `evaluarReglas`,
      `calcularLugaresRestantes`, lectura de mesas con `select` explícito y estado vía
      `calcularEstadoMesa` sobre `contexto.mesasLibres`. Verificar que 3.3 y 3.4 pasan.
- [ ] 3.7 Escribir el test de consistencia con la creación (rojo→verde): plano, creación de
      reserva con los mismos datos, y la mesa asignada estaba `LIBRE`; luego el plano la muestra
      `OCUPADA`. Reutilizar los helpers de `reservas-crear`.
- [ ] 3.8 Escribir el test de concurrencia (patrón de `reservas-concurrencia.integration-spec.ts`):
      dos creaciones sobre la última mesa que alcanza, una gana, y el plano posterior la muestra
      `OCUPADA`. Confirmar que el plano no toma locks ni escribe (inspección del service).

## 4. Backend: controller, límite y contrato

- [ ] 4.1 Escribir `backend/test/plano-mesas.e2e-spec.ts` (rojo): `200` sin token, `400` con
      `comensales=0`, `404` con turno o zona inexistentes, header `Cache-Control: no-store`,
      y `429` en la solicitud siguiente al límite con el límite reducido en el entorno de
      test (patrón de `throttle-rutas-admin.e2e-spec.ts`); la solicitud rechazada no ejecuta
      consultas.
- [ ] 4.2 Implementar `PlanoMesasController` con `@Throttle` (120 por 60 s, constante nombrada),
      `Cache-Control: no-store` y decoradores `@nestjs/swagger` en español, y
      `PlanoMesasModule` (importa `DisponibilidadModule` y `PrismaModule`); registrarlo en
      `AppModule`. Verificar que 4.1 pasa.
- [ ] 4.3 Revisar cómo `scripts/openapi-diff.mjs` normaliza los tipos nulables
      (`type: [integer, 'null']` frente a `nullable: true`) leyendo el script y su test
      (`npm run test:scripts`); definir la forma común antes de escribir el YAML: ambos lados deben usar la misma
      representación, porque el script no las equipara.
- [ ] 4.4 Agregar a `openapi/openapi.yaml` el path `/plano-mesas` y los esquemas
      `PlanoMesasRespuesta`, `MesaPlano`, `EstadoMesaPlano` y `FormaMesa` (D2), con `400`, `404` y
      `429`, ejemplos y `additionalProperties: false`, y con texto idéntico al de los
      decoradores.
- [ ] 4.5 Correr `npm run openapi:check` y `npm run openapi:lint`; resolver cualquier deriva
      corrigiendo el decorador o el YAML, no el script.
- [ ] 4.6 Regenerar el cliente con `npm run api:types` y verificar `api:types:check` del
      frontend.

## 5. Frontend (estética Kakefuda: tokens de `frontend/app/globals.css`)

- [ ] 5.1 Escribir `frontend/test/lib/plano-mesas.test.ts` (rojo) para los helpers puros de
      `frontend/src/lib/plano-mesas.ts`: texto por estado, resumen ("3 libres, 1 ocupada, 1
      que no alcanza"), orden de la lista y separación de mesas sin ubicar. Implementarlos hasta
      que pasen.
- [ ] 5.2 Escribir `frontend/test/components/reservas/plano-mesas.test.tsx` (rojo): lista con
      etiqueta, capacidad y estado en palabras; leyenda con los tres estados; cada estado con
      patrón, marca y texto (no solo color); mesa sin ubicar solo en la lista; SVG con
      `aria-hidden`; resumen con `role="status"`; sin controles de selección de mesa.
- [ ] 5.3 Implementar `frontend/src/components/reservas/plano-mesas.tsx`: SVG con `viewBox` en
      celdas, formas redonda/cuadrada/rectangular como tablillas de madera con los tokens
      existentes (sin hex propios), patrones de relleno y marcas por estado, leyenda y lista.
- [ ] 5.4 Agregar los tests (rojo→verde) del atenuado y el aviso cuando `disponible` es `false`
      (motivos primero, texto "hoy no se puede reservar este turno") y de la aclaración
      "La mesa se asigna automáticamente al confirmar la reserva" / "foto del momento".
- [ ] 5.5 Escribir tests y componente del esqueleto `plano-mesas-cargando.tsx`: `aria-busy`,
      texto accesible, sin animación con `prefers-reduced-motion: reduce` (simular
      `matchMedia`), y la regla CSS correspondiente en el componente o en `globals.css` usando
      solo tokens existentes.
- [ ] 5.6 Tests y manejo de errores: fallo `5xx`/red ⇒ mensaje + "Reintentar" reutilizando
      `error-con-reintento.tsx` y la reserva sigue disponible; `429` ⇒ mensaje específico sin
      reintento automático.
- [ ] 5.7 Integrar en `frontend/app/reservas/nueva/resultado/page.tsx`: pedido del plano en
      paralelo con `disponibilidad` y catálogo (`cache: "no-store"`), envuelto en `Suspense` con
      el esqueleto, de modo que su error no tumbe la página. La página hoy retorna antes cuando
      `disponible` es `false` (lista los motivos); esa rama también debe renderizar el plano
      atenuado con su aviso, después de los motivos, y se cubre con un test propio. Verificar que los tests existentes
      de la página siguen en verde.
- [ ] 5.8 Orden en celular: lista antes que dibujo en pantallas angostas, sin scroll horizontal de
      la página a 360 px (test del componente con las clases de orden y revisión visual).

## 6. Verificación final

- [ ] 6.1 Revisión visual real: levantar backend y frontend con el seed, abrir
      `/reservas/nueva/resultado` en escritorio y en 360 px, capturar pantallas de STANDARD y
      VIP con mesas libres, ocupadas y que no alcanzan, y confirmar que se distinguen en
      escala de grises y con el lector de pantalla leyendo la lista. Adjuntar capturas al PR.
- [ ] 6.2 Prueba manual de seguridad: con curl y sin token, consultar el plano de un turno con
      una reserva real del seed y confirmar a ojo que no aparece ningún dato personal ni id;
      comprobar el `429` excediendo el límite.
- [ ] 6.3 Correr `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`,
      `npm run test:e2e`, `npm run test:frontend`, `npm run test:scripts`, `npm run
      openapi:check` y `openspec validate --all --strict`; todo en verde, sin warnings nuevos.
- [ ] 6.4 Actualizar el README (o la documentación de seed) con el layout del plano y la
      nota de que el admin todavía no lo edita (D6).
- [ ] 6.5 Abrir el PR en español enlazado a este change, pedir la aprobación de un compañero y,
      una vez mergeado, archivar con `openspec archive plano-mesas`.
