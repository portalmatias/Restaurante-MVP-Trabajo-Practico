## Context

Estado real del código (rama `main`, verificado leyendo `backend/src`):

- `Mesa` (`backend/prisma/schema.prisma`): `id`, `zonaId`, `capacidad`, `etiqueta` (única),
  `reservas`. No tiene posición.
- `GET /disponibilidad` (`DisponibilidadController` → `DisponibilidadService.consultar`) llama a
  `cargarContexto(prisma, solicitud)`, que lee turno, zona, `ConfiguracionNegocio`, la
  ocupación de la zona y global, y **`mesasLibres`**: las mesas de la zona sin ninguna reserva
  `PENDIENTE`/`CONFIRMADA` en ese turno y fecha. Después `evaluarReglas` (pura, con el reloj
  inyectado) devuelve los motivos y `calcularLugaresRestantes` el cupo.
- `ReservasService` (creación) reutiliza esas mismas funciones dentro de una transacción con
  `bloquearTurnoFecha` (lock advisory) y elige la mesa con `elegirMesaBestFit(contexto.mesasLibres,
  comensales)` (`backend/src/reservas/elegir-mesa-best-fit.ts`). El índice único parcial
  `(mesaId, turnoId, fecha)` es la última barrera contra la doble reserva (invariante 1).
- `GET /disponibilidad` tiene `@SkipThrottle()` (no recibe códigos ni expone datos personales);
  el resto de las rutas públicas sin código tampoco limitan. Las rutas con código de reserva
  usan el límite global (`THROTTLE_TTL`/`THROTTLE_LIMIT`, `config.yaml` §5 y §10) y las de admin
  60/min (change `throttle-rutas-admin`).
- El frontend resuelve `/reservas/nueva/resultado` como Server Component que llama al backend
  con `cache: "no-store"` y usa un cliente tipado derivado de `openapi/openapi.yaml`
  (`frontend/src/lib/api/schema.d.ts`, `npm run api:types`).

Restricciones de la constitución que condicionan el diseño: contract-first con `openapi:check`
(§3), migraciones versionadas y nunca `db push` (§10), nada de librerías nuevas sin
justificarlas (§2), ningún endpoint público expone datos personales de otras reservas (§5),
valores de negocio en configuración o seed (§14) y el aviso del propio `schema.prisma`: el
índice único parcial de `Reserva` se edita a mano en la migración inicial, así que **cualquier
`prisma migrate dev` nuevo debe revisarse para rechazar el intento de "reparar" ese índice**.

## Goals / Non-Goals

**Goals**
- Que el cliente vea, para fecha + turno + zona + comensales, qué mesas están libres, ocupadas
  o no alcanzan, sobre un dibujo del salón de la zona.
- Que el plano **no pueda contradecir** a la reserva real: si el plano muestra una mesa libre
  que alcanza, la creación (si nadie se adelanta) asigna una mesa de esas; si el plano no
  muestra ninguna, la creación responde sin mesa.
- No exponer datos de terceros.
- Accesible, usable en celular, con la estética Kakefuda existente.

**Non-Goals**
- Elegir la mesa (D9). Editor de plano para el admin (D6). Combinar mesas. Varios pisos.
  Rediseñar la estética Kakefuda: este change solo la usa.

## Decisions

### D1. Modelo de datos: columnas en `Mesa` y dimensiones en `Zona`

**Decisión.** Columnas nuevas, todas compatibles hacia atrás:

```prisma
enum FormaMesa { REDONDA CUADRADA RECTANGULAR }

model Zona {
  // ...campos existentes
  /// Ancho y alto de la grilla lógica del plano de la zona, en celdas.
  planoColumnas Int @default(12)
  planoFilas    Int @default(8)
}

model Mesa {
  // ...campos existentes
  /// Esquina superior izquierda en la grilla (base 0). Nulos = mesa sin ubicar en el plano.
  posX  Int?
  posY  Int?
  /// Tamaño en celdas.
  ancho Int @default(1)
  alto  Int @default(1)
  forma FormaMesa @default(RECTANGULAR)
}
```

Más `CHECK` en la migración (SQL a mano, igual que el índice parcial de `Reserva`):
`posX >= 0`, `posY >= 0`, `ancho >= 1`, `alto >= 1`, `(posX IS NULL) = (posY IS NULL)`, y en
`Zona` `planoColumnas >= 1`, `planoFilas >= 1`. Que la mesa **entre** en la grilla de su zona
(`posX + ancho <= planoColumnas`) cruza dos tablas y no se puede expresar como `CHECK`: lo valida
el service que escriba posiciones (hoy, el seed; mañana, el editor de D6) y un test del seed.
El solapamiento entre mesas tampoco se impone en la base (no es una invariante de negocio; solo
importa visualmente) y lo cubre un test del seed.

**Valores por defecto y migración.** `posX/posY` nulos, `ancho/alto` = 1, `forma` =
`RECTANGULAR` y `planoColumnas/planoFilas` = 12 × 8. La migración es solo `ALTER TABLE ... ADD
COLUMN` con defaults o nulos: no reescribe filas problemáticas, no rompe a `reservas-crear` ni a
`gestion-salon` (sus DTOs usan `whitelist` y `forbidNonWhitelisted`, así que `POST/PATCH
/admin/mesas` no aceptan las columnas nuevas y una mesa dada de alta por el admin queda "sin
ubicar"). Rollback: `DROP COLUMN` de las siete columnas (cinco de `Mesa` y dos de `Zona`) y,
después de la columna `forma`, `DROP TYPE` del enum, sin pérdida de datos de negocio. La
migración se genera con `prisma migrate dev --create-only --name plano_mesas` (sin aplicarla),
se **revisa el SQL** descartando el intento de Prisma de "reparar" el índice parcial, se agregan
los `CHECK` a mano, se aplica con `prisma migrate dev` y se commitea.

**Alternativas consideradas**

| Alternativa | A favor | En contra |
|---|---|---|
| **A. Columnas en `Mesa` + dimensiones en `Zona` (elegida)** | Una sola lectura (`mesa.findMany` ya existe); sin joins; migración trivial; el seed hace upsert por `etiqueta` como hoy. | `Mesa` mezcla identidad de negocio con presentación; si el día de mañana hay varios planos por zona (p. ej. terraza en verano) no alcanza. |
| B. Tabla `PlanoZona` (1 por zona) con JSON de mesas | Separa presentación de dominio; admite versiones del plano. | JSON sin tipos ni constraints (hay que validar a mano); la posición de una mesa borrada queda huérfana; más piezas para el mismo resultado. |
| C. Tabla `PosicionMesa` (1:1 con `Mesa`) + `PlanoZona` | Normalizado, constraints reales, versionable. | Dos tablas y un join para un dato que siempre se lee junto con la mesa; sobreingeniería para 9 mesas. |
| D. Coordenadas en píxeles o porcentaje | Dibujo "libre". | Acopla la base a una resolución; imposible de validar contra la grilla; difícil de hacer accesible y responsive. |

Se elige A porque el plano es 1:1 con la mesa y el MVP no necesita versiones. La grilla lógica
(celdas) se elige sobre píxeles porque el frontend escala la grilla a cualquier ancho y porque
permite validar límites y solapamientos con aritmética entera. Si aparece la necesidad de
varios planos, migrar a B/C es aditivo.

**Layout inicial del seed** (coordenadas base 0, esquina superior izquierda, `ancho × alto` en
celdas; una celda es el espacio de una mesa de 2 personas):

| Zona | Grilla | Mesa | Capacidad | Forma | posX, posY | Tamaño |
|---|---|---|---|---|---|---|
| STANDARD | 12 × 8 | S1 | 2 | REDONDA | 0, 0 | 1 × 1 |
| STANDARD | | S2 | 2 | REDONDA | 2, 0 | 1 × 1 |
| STANDARD | | S3 | 4 | CUADRADA | 5, 0 | 2 × 2 |
| STANDARD | | S4 | 6 | RECTANGULAR | 0, 3 | 3 × 2 |
| STANDARD | | S5 | 8 | RECTANGULAR | 5, 3 | 4 × 2 |
| VIP | 10 × 6 | V1 | 2 | REDONDA | 0, 0 | 1 × 1 |
| VIP | | V2 | 4 | CUADRADA | 3, 0 | 2 × 2 |
| VIP | | V3 | 6 | RECTANGULAR | 0, 3 | 3 × 2 |
| VIP | | V4 | 12 | RECTANGULAR | 4, 3 | 6 × 2 |

Las mesas pequeñas arriba (junto a la "entrada"/ventana) y las grandes abajo, con pasillo libre
entre filas y columnas. Todas entran en su grilla y ninguna se solapa (se verifica en un test del
seed). El seed sigue siendo idempotente: el `upsert` por `etiqueta` incluye ahora estas columnas
en `update`, de modo que un seed re-corrido restaura el layout (decisión consciente mientras no
exista el editor de D6; cuando exista, el seed dejará de pisar posiciones en `update`).

### D2. Endpoint público `GET /plano-mesas` y reutilización exacta de las reglas

**Ruta.** `GET /plano-mesas?fecha&turnoId&zonaId&comensales`, mismos cuatro parámetros y mismas
validaciones que `/disponibilidad` (se reutiliza `ConsultarDisponibilidadDto`, por lo que
`400` para parámetros mal formados y `404` si el turno o la zona no existen, con los mismos
textos). Se descartan `GET /zonas/{id}/plano` (mezcla catálogo estático con estado dinámico y
vuelve ambiguo el cacheo) y agregar el plano a `/disponibilidad` (cambia un contrato en uso y
obliga a pagar la consulta de mesas a quien no la necesita).

**Reutilización.** Nuevo `PlanoMesasModule` que importa `DisponibilidadModule` y `PrismaModule`.
`PlanoMesasService.consultar(query)`:

1. Arma la `SolicitudDisponibilidad` igual que `DisponibilidadService` (misma
   `fechaCalendarioDesdeIso`).
2. `contexto = await cargarContexto(prisma, solicitud)`, **la misma función** que usa la
   consulta y la creación.
3. `motivos = evaluarReglas(contexto, solicitud, new Date())` y
   `lugaresRestantes = calcularLugaresRestantes(contexto)`: el veredicto del plano es idéntico
   al de `/disponibilidad` por construcción (mismo código, no una copia).
4. Lee las mesas de la zona con sus columnas de plano (`mesa.findMany` con `select` explícito
   de `id`, `etiqueta`, `capacidad`, `posX`, `posY`, `ancho`, `alto`, `forma`) más
   `zona.planoColumnas/planoFilas`.
5. Deriva el estado **solo** con `contexto.mesasLibres` (la lista que ya usan
   `SIN_MESA_DISPONIBLE` y `elegirMesaBestFit`):
   - la mesa **no está** en `mesasLibres` → `OCUPADA`;
   - está y `capacidad >= comensales` → `LIBRE`;
   - está y `capacidad < comensales` → `NO_ALCANZA`.
   `OCUPADA` tiene precedencia sobre `NO_ALCANZA` (una mesa ocupada y chica es "ocupada": es el
   dato más fuerte y no revela nada extra).

Consecuencia (consistencia garantizada): existe al menos una mesa `LIBRE` ⇔ `mesasLibres`
contiene una con `capacidad >= comensales` ⇔ **no** aparece `SIN_MESA_DISPONIBLE` en `motivos`.
Se prueba con un test que recorre las dos listas.

Dos precisiones de semántica:
- `LIBRE` describe a la **mesa**, no a la reserva. Puede haber una mesa `LIBRE` y a la vez
  `disponible: false` (aforo de zona o global superado, anticipación, turno inactivo, comensales
  fuera de rango). El frontend debe mostrar el veredicto de `disponible`/`motivos` por encima
  del plano y no sugerir que se puede reservar si `disponible` es `false`.
- `mesasLibres` se lee en una sola consulta dentro de `cargarContexto`; las mesas de la zona se
  leen en otra. Entre ambas una mesa podría crearse o borrarse por el admin. Una mesa que no
  está en `mesasLibres` porque es nueva se mostraría `OCUPADA` por un instante. Es una foto del
  momento (igual que `/disponibilidad`, `config.yaml` §6) y el costo de cerrarlo con una
  transacción `RepeatableRead` no se justifica; se documenta y se acepta.

**Fragmento OpenAPI** (va al PR de implementación en `openapi/openapi.yaml`; no se agrega al YAML
ejecutable antes, regla de `config.yaml` §3). Los `summary` y `description` quedan en español y
el texto debe coincidir letra por letra con los decoradores `@nestjs/swagger` del controller:

```yaml
/plano-mesas:
  get:
    summary: Consultar el plano de mesas de una zona
    description: >-
      Devuelve el plano de una zona con el estado de cada mesa para una fecha, un turno y una
      cantidad de comensales: libre, ocupada o que no alcanza. Es informativo: no reserva ni
      bloquea nada y la mesa se asigna automáticamente al confirmar la reserva. Incluye el
      mismo veredicto que `GET /disponibilidad` (`disponible`, `lugaresRestantes`, `motivos`).
      No expone datos de las reservas, solo el estado de cada mesa. Es una ruta pública, sin
      autenticación, con límite de solicitudes.
    operationId: PlanoMesasController_consultar
    tags: [plano-mesas]
    parameters:          # fecha, turnoId, zonaId, comensales: idénticos a /disponibilidad
      - { name: fecha, in: query, required: true, schema: { type: string, format: date, pattern: '^\d{4}-\d{2}-\d{2}$' } }
      - { name: turnoId, in: query, required: true, schema: { type: string, format: uuid } }
      - { name: zonaId, in: query, required: true, schema: { type: string, format: uuid } }
      - { name: comensales, in: query, required: true, schema: { type: integer, minimum: 1 } }
    responses:
      '200': { description: ..., content: { application/json: { schema: { $ref: '#/components/schemas/PlanoMesasRespuesta' } } } }
      '400': { description: Consulta mal formada, content: ErrorRespuesta }
      '404': { description: El turno o la zona no existen, content: ErrorRespuesta }
      '429': { description: Se superó el límite de solicitudes, content: ErrorRespuesta }
components:
  schemas:
    EstadoMesaPlano: { type: string, enum: [LIBRE, OCUPADA, NO_ALCANZA] }
    FormaMesa: { type: string, enum: [REDONDA, CUADRADA, RECTANGULAR] }
    MesaPlano:
      type: object
      required: [etiqueta, capacidad, forma, posX, posY, ancho, alto, estado]
      properties:
        etiqueta: { type: string, example: S3 }
        capacidad: { type: integer, minimum: 1 }
        forma: { $ref: '#/components/schemas/FormaMesa' }
        posX: { type: [integer, 'null'], minimum: 0, description: Nulo si la mesa no está ubicada en el plano }
        posY: { type: [integer, 'null'], minimum: 0 }
        ancho: { type: integer, minimum: 1 }
        alto: { type: integer, minimum: 1 }
        estado: { $ref: '#/components/schemas/EstadoMesaPlano' }
    PlanoMesasRespuesta:
      type: object
      required: [zona, columnas, filas, disponible, lugaresRestantes, motivos, mesas]
      properties:
        zona: { type: string, enum: [STANDARD, VIP] }
        columnas: { type: integer, minimum: 1 }
        filas: { type: integer, minimum: 1 }
        disponible: { type: boolean }
        lugaresRestantes: { type: integer, minimum: 0 }
        motivos: { type: array, items: { $ref: '#/components/schemas/MotivoNoDisponible' } }
        mesas: { type: array, items: { $ref: '#/components/schemas/MesaPlano' } }
```

(El fragmento está abreviado para legibilidad; el PR de implementación lo escribe expandido,
con `description` en español y ejemplos, siguiendo el estilo de `/disponibilidad`.) `mesas`
sale ordenada por `etiqueta` para que el orden no dependa del plan de Postgres y la lista
textual sea estable. Se reutilizan `MotivoNoDisponible` y `ErrorRespuesta` del contrato actual.
**No** se expone `id` de la mesa: el cliente no lo necesita (la clave de lista es la `etiqueta`,
única) y exponerlo es un dato más que no aporta; si D9 llega a implementarse, ese change lo
agrega. La respuesta incluye `Cache-Control: no-store`.

### D3. Seguridad y exposición de datos

Análisis para un endpoint público (`config.yaml` §5: "ningún endpoint público expone datos
personales de otras reservas"):

- **Qué se expone.** Por mesa: `etiqueta`, `capacidad`, geometría y un estado de tres valores.
  Es información que cualquier visitante del salón ve. **No** se expone: id de reserva, código,
  nombre, email, teléfono, comensales de la reserva, estado de la reserva (`PENDIENTE` vs
  `CONFIRMADA`, que revelaría actividad del admin en VIP), hora de creación ni `Reserva.mesaId`.
  El `select` de Prisma es explícito (nunca `include: { reservas: true }`) y un test de contrato
  verifica que la respuesta contiene exactamente las claves del esquema (`additionalProperties:
  false`), de modo que un campo agregado por descuido rompe el test.
- **`OCUPADA` no distingue por qué.** Reservas `PENDIENTE` y `CONFIRMADA` se ven igual; las
  `CANCELADA`/`NO_SHOW` liberan la mesa (igual que `cargarContexto`).
- **Inferencia de datos de terceros.** El estado por mesa sumado a `capacidad` permite inferir
  una cota del tamaño del grupo (mesa de 12 ocupada ⇒ probablemente un grupo grande). Se
  acepta: ya hoy `lugaresRestantes` por zona expone la suma de comensales, y no identifica a
  nadie. El riesgo real (identificar personas) no existe porque no hay ningún dato personal en
  la respuesta. Queda registrado como pregunta abierta si el equipo prefiere ocultar la
  distinción entre ocupada y "no alcanza" cuando la mesa además está ocupada (ya es así: gana
  `OCUPADA`).
- **Enumeración.** El espacio enumerable son (fecha × turno × zona × comensales): lo que un
  atacante obtiene es el mapa de ocupación del restaurante, el mismo que el cliente legítimo
  ve, y que ya se puede derivar de `/disponibilidad` variando `comensales`. No hay identificador
  de reserva que adivinar, así que no es la enumeración que `config.yaml` §5 combate con
  throttling en las rutas con código. El riesgo residual es de **disponibilidad** (raspado
  masivo del calendario para scraping competitivo o carga sobre la base), no de
  confidencialidad.
- **Límite de solicitudes.** `GET /disponibilidad` está en `@SkipThrottle()` y se justificó
  porque mirar varias fechas seguidas es uso normal. El plano hace 7 consultas (turno, zona,
  configuración, dos agregados y mesas libres, más la lectura de mesas), algo más caro que la
  consulta simple. **Decisión:** límite propio de **120 solicitudes por minuto por origen**
  (`@Throttle` en el controller, constante nombrada, mismo mecanismo que usa el change
  `throttle-rutas-admin` con `limite-admin.decorator.ts`), no el global de 10 (rompería el uso
  normal: cambiar fecha, turno y cantidad son varias consultas) y no `@SkipThrottle()`. Detrás
  del proxy `/api` de Next el origen que ve el throttler es compartido por todos los clientes
  (`exposicion-red-local`, #62), y como `resultado/page.tsx` llama al backend desde el servidor
  de Next, **todos los visitantes comparten el cupo de 120/min**. Es un riesgo conocido: si se
  agota, el plano responde `429` para todos (el resto de la página sigue funcionando, ver D8).
  Se mantiene el valor como punto de partida y se deja como pregunta abierta si el equipo prefiere
  `@SkipThrottle()` por coherencia con `/disponibilidad`.
- **Sin autenticación ni cookies**, sin CORS nuevo, sin variables de entorno nuevas. No se
  loguean los parámetros más allá del log HTTP estándar y nunca se loguea el cuerpo.
- **Principio de mínimo privilegio** aplicado también a la base: el endpoint solo lee. No hay
  escritura posible por esta ruta, y por eso no entra en la lista de rutas que toman
  `bloquearTurnoFecha`.
- **Verificar, no asumir:** los tests de integración arman reservas con datos personales
  reconocibles (nombre, email, teléfono, código) y afirman que **ninguno** de esos textos
  aparece en el cuerpo serializado de la respuesta.

### D4. Consistencia con la reserva real

La reserva real y el plano usan los mismos tres insumos (`cargarContexto`, `evaluarReglas`,
`mesasLibres`), así que no hay una segunda definición de "libre". Lo que **no** garantiza (y lo
dice la UI): entre mirar el plano y confirmar puede aparecer otra reserva (carrera). La
invariante de no-doble-reserva sigue defendida por lo de siempre: `bloquearTurnoFecha` +
`cargarContexto` dentro de la transacción de creación + índice único parcial. **El plano no
toma locks ni escribe**, por lo que no puede degradar la concurrencia de las reservas. El texto
del frontend aclara que la mesa se asigna al confirmar y que el plano es una foto del momento.

*Mesa que se asignará*: se evaluó mostrar cuál mesa elegiría `elegirMesaBestFit`. Se **descarta
en esta versión**: sería una promesa que la carrera puede romper y empuja al usuario a creer que
eligió esa mesa (ver D9). Queda como pregunta abierta.

### D5. Frontend: componente de plano

- Archivos nuevos (en el estilo de `frontend/src/components/reservas/`): `plano-mesas.tsx`
  (dibujo + lista), `plano-mesas-cargando.tsx` (esqueleto) y un helper puro
  `frontend/src/lib/plano-mesas.ts` (por ejemplo, `ordenarMesas`, `resumirPlano`, texto de
  estado por mesa) para testear sin DOM.
- **Render.** SVG con `viewBox = columnas × filas` en unidades de celda (una celda ≈ 48 px
  lógicos), de modo que escala al ancho del contenedor sin JavaScript de medición. Cada mesa es
  un `<g>` con la forma (círculo, cuadrado o rectángulo con esquinas pequeñas) en estilo de
  tablilla Kakefuda: madera (tokens de `frontend/app/globals.css`, solo mención: no se
  rediseña), `etiqueta` y `capacidad` impresas. El SVG es decorativo para tecnologías de
  asistencia (`aria-hidden="true"`); el contenido accesible es la lista (D7).
- **Estados sin depender del color** (WCAG 1.4.1): cada estado suma un patrón y un texto,
  además del color: `LIBRE` (relleno liso + marca ✓ + texto "Libre"), `OCUPADA` (rayado diagonal
  + marca × + "Ocupada"), `NO_ALCANZA` (punteado + marca – + "No alcanza"). Contraste de texto y
  bordes ≥ 4.5:1 / 3:1 contra el fondo de la tablilla, verificado con los tokens reales.
- **Leyenda** siempre visible con los tres estados (misma forma y texto que en el dibujo).
- **Mesas sin ubicar** (`posX` nulo): no se dibujan; figuran en la lista con la nota
  "sin ubicar en el plano". Si **ninguna** tiene posición, se oculta el dibujo y queda solo la
  lista.
- **Veredicto primero.** El plano se muestra debajo del mensaje de `disponible`/`motivos` que la
  página ya presenta, y cuando `disponible` es `false` el plano se atenúa y se agrega el texto
  "El plano muestra el estado de las mesas, pero hoy no se puede reservar este turno por: …".
- **Obtención de datos.** El plano se pide en el Server Component de la página, en paralelo con
  `disponibilidad` y el catálogo, pero **su fallo no tumba la página**: la página usa un
  `Suspense` con un componente servidor propio que captura el error y renderiza
  `ErrorConReintento` (ya existe). `cache: "no-store"`. Tipos de `schema.d.ts` regenerados.

### D6. Administración del plano: queda para un change siguiente

**Decisión.** Este change **no** incluye edición del plano por el admin; el layout lo define el
seed. Razones: (1) un editor (arrastrar mesas, validar solapamientos, guardar) es una pieza de
UI de tamaño similar a todo este change y con su propio análisis de accesibilidad; (2) los
cambios de posición no alteran ninguna regla de negocio, así que posponerlos no bloquea valor;
(3) cada PR debe ser chico y revisable (`config.yaml` §14).

Qué ocurre mientras tanto: el admin puede crear/editar/borrar mesas con las rutas actuales
(`gestion-salon`), pero las mesas nuevas quedan "sin ubicar" y no aparecen en el dibujo, solo en
la lista; borrar una mesa la quita del plano sin más. Para evitar sorpresas, la spec de
`modelo-dominio` fija el valor por defecto y la spec de `plano-mesas` exige que una mesa sin
ubicar nunca rompa la respuesta. Change futuro (`plano-mesas-admin`): `PATCH /admin/mesas/:id`
(o `/admin/mesas/:id/posicion`) con validación de límites y solapamiento en el service,
protegido por `JwtAuthGuard` + `RolesGuard`, con throttle de admin.

### D7. Accesibilidad del plano (es un gráfico)

- **Alternativa textual siempre disponible**, no oculta tras un clic: debajo del dibujo hay una
  lista (`<ul>`) con una fila por mesa: "Mesa S3, para 4 comensales: libre". Es la fuente
  accesible primaria; el SVG es `aria-hidden`.
- **Resumen** en un párrafo con `role="status"` y texto: "En la zona Standard hay 3 mesas libres
  para 4 comensales, 1 ocupada y 1 que no alcanza."
- **No depender solo del color:** patrón + marca + texto (D5).
- **Foco y teclado.** En esta versión el plano es informativo y **no tiene elementos
  interactivos**, así que no añade paradas de tabulación inútiles; la lista es texto navegable
  con lector de pantalla. Si D9 se implementa, las mesas pasan a ser `<button>` reales dentro de
  una lista, con foco visible (anillo del token de foco existente) y activación por Enter/Espacio.
- **`prefers-reduced-motion`:** las transiciones y el brillo del esqueleto se desactivan con
  `@media (prefers-reduced-motion: reduce)`; la aparición del plano no usa animación esencial.
- **Contraste, foco y zoom:** texto en píxeles relativos (`rem`), la página sigue usable a 200 %
  de zoom, sin scroll horizontal del `body`.
- **Celular.** La grilla escala al ancho disponible (360 px de viewport → ~328 px de dibujo →
  ~27 px por celda en STANDARD de 12 columnas). Para que las tablillas chicas (una celda) sigan
  legibles, la `etiqueta` se imprime en un tamaño mínimo de 11 px y la `capacidad` solo se
  imprime en el dibujo si la mesa mide al menos 2 celdas de ancho (la lista siempre la dice). La
  lista va **antes** que el dibujo en pantallas angostas (`order`), porque ahí es la vía más
  rápida; en escritorio van lado a lado o dibujo primero. El contenedor tiene
  `overflow-x: auto` solo como red de seguridad.
- **Estados de carga/error/429:**
  - Carga: esqueleto con las dimensiones aproximadas del plano (sin saltos de layout), con
    `aria-busy="true"` y texto accesible "Cargando el plano de mesas".
  - Error de red o `5xx`: bloque "No pudimos cargar el plano. Podés seguir con tu reserva igual."
    con botón "Reintentar". La reserva nunca depende del plano.
  - `429`: mensaje específico "Estamos recibiendo muchas consultas. Probá de nuevo en un
    minuto." sin reintento automático (evita agravar el límite compartido).
  - `404/400`: se tratan como la página ya trata los de `/disponibilidad` (selección inválida).
- Copy en voseo rioplatense, como el resto del cliente.

### D8. Estrategia de tests

Orden: tests primero, en rojo, y luego la implementación (ver `tasks.md`).

- **Unitarios** (`*.spec.ts`, al lado del archivo): la función pura que deriva el estado de cada
  mesa a partir de `mesasLibres` y `comensales` (tabla de casos: libre, ocupada, no alcanza,
  ocupada y chica ⇒ ocupada, capacidad exacta ⇒ libre, mesa sin ubicar); validador de layout
  (límites, solapamientos) que usa el seed.
- **Integración contra PostgreSQL real** (`backend/test/*.integration-spec.ts`, sin mocks de
  Prisma): reserva `CONFIRMADA`/`PENDIENTE` ⇒ `OCUPADA`; `CANCELADA`/`NO_SHOW` ⇒ libre; mesa
  sin posición ⇒ `posX: null` y no rompe; **sin fuga de datos personales** (cuerpo serializado
  no contiene nombre/email/teléfono/código); respuesta sin `id` ni claves extra; invariante de
  consistencia: para una grilla de combinaciones, `existe mesa LIBRE ⇔ SIN_MESA_DISPONIBLE ∉
  motivos`; migración aplicada sobre una base con datos previos conserva reservas y mesas.
- **Consistencia con la creación e invariante 1:** un test que (a) pide el plano, (b) crea una
  reserva con los mismos parámetros y (c) comprueba que la mesa asignada estaba `LIBRE` en el
  plano; otro con dos creaciones concurrentes sobre la última mesa que alcanza (se reutiliza el
  patrón de `reservas-concurrencia.integration-spec.ts`): exactamente una gana, la otra recibe
  el rechazo habitual, y el plano posterior muestra la mesa `OCUPADA`. Esto prueba que el plano
  no altera la defensa contra la doble reserva (no escribe ni toma locks).
- **e2e** (`backend/test/plano-mesas.e2e-spec.ts`, Supertest): ruta pública sin token ⇒ `200`;
  `400` con parámetros inválidos; `404` con turno o zona inexistentes; `Cache-Control: no-store`;
  `429` al exceder el límite (con el límite bajado por configuración de test, como hace
  `throttle-rutas-admin.e2e-spec.ts`) y que la solicitud 121 no ejecuta consultas.
- **Seed:** test de que el layout inicial entra en la grilla, no se solapa y es idempotente
  (correr dos veces no duplica ni cambia posiciones).
- **Frontend (Jest + React Testing Library, `frontend/test/`)**: render con estados mixtos
  (lista con texto de estado por mesa, leyenda, resumen); no depende solo del color (cada estado
  tiene texto y marca); mesa sin ubicar aparece solo en la lista; `disponible: false` muestra el
  aviso y atenúa; esqueleto con `aria-busy`; error con botón de reintento; mensaje específico de
  `429`; el SVG tiene `aria-hidden`; con `prefers-reduced-motion` no hay clase de animación
  (matchMedia simulado).
- **Contrato (`openapi:check`).** El CI genera el spec desde los decoradores de `@nestjs/swagger`
  y lo diffea contra `openapi/openapi.yaml`. El PR de implementación debe agregar el path y los
  tres esquemas **en ambos lados con texto idéntico** (summary, description, ejemplos,
  `enumName` de `EstadoMesaPlano` y `FormaMesa`, orden de `required`). Riesgos: (1) campos
  nulables, que `@nestjs/swagger` emite con `nullable` (3.0) y el YAML escribe como `type:
  [integer, 'null']` (3.1). `scripts/openapi-diff.mjs` no contiene ninguna normalización de
  nulables, así que ambas representaciones se compararían como distintas y `openapi:check`
  fallaría: hay que acordar una única forma en ambos lados (tarea 4.3) y, si hace falta, ajustar
  el decorador (`type: [..]` en `@ApiProperty`) en vez de tocar el script (que está cubierto
  por `test:scripts`); (2) el 429
  debe estar documentado en el YAML igual que lo hace `throttle-rutas-admin`; (3) correr
  `openapi:lint` (Spectral) y `npm run api:types` + `api:types:check` del frontend.

### D9. Elegir mesa: fuera de alcance (pregunta abierta)

Si el cliente pudiera tocar una mesa, el input de la reserva incluiría `mesaId` y se rompería
una decisión de dominio: **hoy la mesa nunca llega en el input** (`config.yaml` §6: asignación
automática *best fit*; `ReservasService` recibe solo la zona). Cambiaría: (a) el best fit deja
de ser la regla (podrían desperdiciarse mesas grandes: una pareja ocupando la de 12);
(b) habría que validar que la mesa pertenece a la zona (invariante 3) y que alcanza
(invariante 2) con el `mesaId` que manda el cliente, un campo manipulable; (c) hay una carrera
nueva (dos personas eligen la misma mesa) con un rechazo distinto al actual; (d) la VIP, que
requiere confirmación del admin, necesitaría definir si el admin puede reasignar; (e) el
contrato de `POST /reservas` cambia; (f) hace falta exponer `id` de mesa públicamente. Todo eso
merece su propio change con su propio análisis; esta versión lo deja explícito como no-objetivo.

## Risks / Trade-offs

- **Migración con `prisma migrate dev` y el índice parcial de `Reserva`.** Prisma intentará
  regenerar el índice como no parcial. Mitigación: revisar el SQL generado y quitar ese
  fragmento antes de commitear; test `indices-partial.integration-spec.ts` existente lo detecta
  si se cuela.
- **Cupo de throttle compartido** detrás del proxy de Next (D3): un pico agota el plano para
  todos. Mitigación: degradación elegante (el plano es opcional) y valor de 120/min revisable.
- **Raspado del calendario** (disponibilidad pública): ya existe con `/disponibilidad`; el plano
  no agrega datos personales.
- **Layout desactualizado:** mesas creadas por el admin quedan sin ubicar hasta que exista el
  editor (D6). Aceptado y documentado en la lista ("sin ubicar").
- **Foto del momento:** el plano puede quedar desactualizado entre la vista y la confirmación;
  la UI lo dice y la creación valida de nuevo.
- **Carga extra en la base:** 7 consultas por plano; el cupo de throttle y `no-store` la acotan;
  son lecturas por clave indexada sobre decenas de filas.
- **Estética:** el plano depende de los tokens Kakefuda actuales; si cambian, el componente los
  hereda (usa solo variables CSS, sin hex propios).

## Migration Plan

1. Migración aditiva (columnas, enum, `CHECK`). Sin paso destructivo ni `db push`.
2. Seed actualizado con el layout (idempotente); en bases ya cargadas basta con volver a correr
   `db:seed`.
3. Deploy backend primero (el endpoint nuevo no rompe a nadie), después frontend (que ya
   tolera `404` del plano degradando la sección). Rollback: revertir el frontend y luego la
   migración (`DROP COLUMN`).

## Open Questions

1. **¿Elegir mesa en el futuro?** ¿El equipo quiere un change posterior para que el cliente
   elija (o prefiera) mesa? Implica D9 completo.
2. **¿Mostrar la mesa que asignaría el best fit?** Útil, pero es una promesa que la carrera
   puede romper (D4).
3. **Límite de solicitudes:** ¿120/min compartido, otro valor, o `@SkipThrottle()` como
   `/disponibilidad`?
4. **¿Ocultar `capacidad` y estado de mesas en VIP?** (privacidad de un sector exclusivo) o
   mostrar todo igual que en STANDARD.
5. **Admin:** ¿se prioriza el editor de plano (`plano-mesas-admin`) antes de la entrega del TP, o
   alcanza con el layout del seed?
6. **Barra de omakase:** ¿Ichigo tiene asientos en barra? Si es así, ¿se modelan como mesas de
   capacidad 1 (`forma` nueva `BARRA`) o fuera del alcance?
7. **Mesas sin ubicar:** ¿se muestran en la lista (propuesto) o el admin debería poder impedir
   mesas nuevas sin posición?
