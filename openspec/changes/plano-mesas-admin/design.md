## Context

Ver proposal.md (Why). Estado actual que condiciona el diseño:

- Las columnas `posX`, `posY`, `ancho`, `alto` y `forma` de `Mesa`, y `planoColumnas` y
  `planoFilas` de `Zona`, ya existen (change `plano-mesas`). La base garantiza con CHECK que las
  coordenadas van juntas y no son negativas, y que el tamaño es al menos 1. Que la mesa entre en
  la grilla y que no se superponga cruza filas y tablas: lo valida quien escribe, hoy solo el
  seed con `validarLayout` (`backend/src/plano-mesas/layout-plano.ts`).
- `MesasService.actualizar` ya corre la edición en una transacción `Serializable` con hasta 3
  reintentos ante conflicto de serialización (`P2034`), y responde `409` si se agotan.
- El `ValidationPipe` global usa `whitelist` y `forbidNonWhitelisted`: hoy un `PATCH` con `posX`
  responde `400`. El cambio de contrato es solo aditivo.
- En el frontend, `mesas-panel.tsx` tiene el formulario de alta y edición, y reparte los errores
  de la API entre campos por el texto del mensaje (`errores-campo.ts`). El dibujo del plano del
  cliente (`plano-mesas.tsx`, PR #89) define la geometría: celdas de 48 unidades del `viewBox`,
  margen de 4 y la silueta de cada forma.

## Goals / Non-Goals

**Goals:**
- Una sola fuente de verdad para la regla de grilla y superposición en el backend, compartida
  con el seed.
- Que dos ediciones simultáneas no puedan dejar dos mesas en la misma celda.
- Que editar la etiqueta o la capacidad de una mesa nunca falle por su ubicación.
- Reutilizar la geometría del dibujo del cliente, para que la vista previa del admin se vea igual
  que el plano que ve el cliente.

**Non-Goals:**
- Validar en la base que las mesas no se superpongan (constraint de exclusión): ver D3.
- Un endpoint nuevo para la ubicación: ver D1.

## Decisions

### D1. Se extiende `PATCH /admin/mesas/:id` en vez de sumar `/posicion`

Los cinco campos del plano entran como opcionales en `ActualizarMesaDto`. Así el formulario guarda
todo en un solo pedido y una sola transacción, y la regla "cambio de zona sin ubicación nueva deja
la mesa sin ubicar" vive en el mismo lugar que el cambio de zona.

- **Alternativa:** `PATCH /admin/mesas/:id/posicion`, como sugería D6 de `plano-mesas`. Separa la
  ubicación, pero un cambio de zona más una ubicación nueva pasaría a ser dos pedidos, con un
  estado intermedio donde la mesa ya está en la zona nueva con coordenadas de la vieja. Además
  sumaría una ruta a la lista de `throttle-rutas-admin` y a los guards.

`null` y ausente significan cosas distintas: `posX: null` quita la mesa del plano y la ausencia no
toca la posición. Las dos se validan con `@ValidateIf((dto) => dto.posX != null)` (y su par para
`posY`) seguido de `@IsInt()` y `@Min(0)`: con valor se exige un entero no negativo, y `null` pasa
la validación del DTO sin confundirse con la ausencia, que el service distingue con `undefined`.
`ancho`, `alto` y `forma` no admiten `null` y usan `@IsOptional()` como los campos actuales. Que
`posX` y `posY` vayan juntas lo valida el service (D2), con el mensaje "posX y posY van juntos: los
dos con valor o los dos en null."

### D2. Validación en el service, dentro de la transacción existente

En `ejecutarActualizacion`, después de las validaciones actuales (etiqueta, zona y reservas
activas):

1. Se calcula el lugar final: zona final, `posX`/`posY` finales (si cambia la zona y el pedido no
   las trae, `null`), y `ancho`/`alto` finales.
2. Si el pedido no toca ningún campo del plano ni la zona, no se valida nada más (spec: "Pedido sin
   campos del plano no cambia la ubicación").
3. Si la mesa queda ubicada, se leen dentro de la transacción la grilla de la zona final y las
   demás mesas ubicadas de esa zona, y se llama a una función pura nueva de `layout-plano.ts`:

   ```ts
   export function problemasDeUbicacion(
     zona: DimensionesPlano,
     mesa: MesaEnPlano,
     otras: MesaEnPlano[],
   ): { fueraDeGrilla: boolean; superpuestaCon: string[] };
   ```

   Reutiliza `seSuperponen` y la misma condición de grilla que `validarLayout`, que queda para el
   seed. `superpuestaCon` sale ordenada con `ordenarMesasPorEtiqueta`.
4. `fueraDeGrilla` → `400` "La mesa queda fuera de la grilla de 12 por 8."; `superpuestaCon` no
   vacía → `409` "La mesa se superpone con S2 y S3." (lista con comas y "y" antes de la última).
   Se informa primero la grilla: una mesa afuera no necesita la lista de superposiciones.

Solo se valida la mesa editada contra las demás. Un problema previo entre otras dos mesas (un
layout cargado a mano) no bloquea al admin, que justamente puede estar arreglándolo.

- **Alternativa:** correr `validarLayout` sobre la zona completa con la mesa ya movida. Es más
  corto, pero bloquearía la edición por problemas que no causó este pedido, y sus mensajes nombran
  pares de mesas en vez de decir qué hacer.

### D3. Concurrencia: alcanza con `Serializable`

Dos pedidos que mueven S1 y S2 a la misma celda leen las mesas de la zona (cada uno lee la fila
que el otro escribe) y escriben una cada uno. Esa dependencia cruzada es exactamente lo que
detecta el aislamiento `Serializable` de PostgreSQL: uno de los dos falla con `P2034`, se
reintenta, ve la mesa ya movida y responde `409` por superposición (o `409` por agotar los
reintentos). No hace falta `SELECT ... FOR UPDATE` ni un lock de zona.

- **Alternativa:** un constraint de exclusión con `gist` sobre rectángulos. Sería la garantía más
  fuerte, pero necesita la extensión `btree_gist`, un tipo geométrico calculado y SQL a mano en la
  migración, para una regla que no es una invariante de negocio (no afecta reservas) sino visual.

### D4. Respuestas: campos nuevos y requeridos

`MesaRespuestaDto` suma `posX`, `posY` (enteros o `null`), `ancho`, `alto` y `forma`;
`ZonaRespuestaDto` suma `planoColumnas` y `planoFilas`. Van como requeridos en la respuesta porque
siempre están: un cliente viejo los ignora. El único consumidor es el frontend, que regenera sus
tipos desde `openapi.yaml` en el mismo PR.

### D5. Frontend: formulario con vista previa

- **Datos.** El formulario de edición pide `GET /admin/mesas?zonaId=<zona del formulario>` al
  abrirse y cada vez que cambia la zona, para dibujar las demás mesas. La grilla sale de la zona
  (`planoColumnas`, `planoFilas`) que el panel ya recibe de `GET /admin/zonas`.
- **Campos.** Columna y Fila son `<select>` numerados desde 1 (la API, desde 0: se convierte al
  armar el pedido y al leer la mesa). Ofrecen de 1 a `columnas - ancho + 1` y de 1 a
  `filas - alto + 1`, y se corrigen al último valor válido cuando crece el ancho o el alto. Ancho y
  Alto son `<select>` de 1 a `columnas` y de 1 a `filas`. Forma es un grupo de radios.
- **Qué se envía.** Solo los campos del plano que cambiaron respecto de la mesa original. Así,
  editar la etiqueta de una mesa con un problema previo no dispara la validación (D2).
- **Vista previa.** Se extrae la geometría de `plano-mesas.tsx` (`CELDA`, `MARGEN` y `Silueta`) a
  `frontend/src/components/reservas/plano-geometria.tsx`, que usan el plano del cliente y la vista
  previa. Las demás mesas se dibujan con el relleno neutro (`muted`) y la que se edita con la
  madera oscura (`madera`), con su etiqueta. El SVG es `aria-hidden`.
- **Texto.** Un párrafo con `aria-live="polite"` describe la ubicación ("S3 ocupa las columnas 6 y
  7, filas 1 y 2."; una celda: "la columna 6"; tres o más: "las columnas 6 a 8") y agrega "Se
  superpone con S5." cuando corresponde. La superposición se calcula en el cliente con una
  función de `frontend/src/lib/plano-mesas.ts`: duplica la regla del backend, que no se puede
  importar (`config.yaml` §4). Es solo un aviso: la API decide.
- **Errores.** `errores-campo.ts` suma una regla `ubicacion` que reconoce "fuera de la grilla",
  "se superpone" y "posX y posY van juntos", y los muestra junto a la sección.
- **Listado.** La tabla suma la columna "Plano" con "Columna 6, fila 1" o "Sin ubicar".

### Contrato OpenAPI

Fragmento que el PR de implementación incorpora a `openapi/openapi.yaml`:

```yaml
components:
  schemas:
    ActualizarMesaDto:
      type: object
      properties:
        # zonaId, capacidad y etiqueta: sin cambios
        posX:
          type: integer
          nullable: true
          minimum: 0
          description: >-
            Columna de la esquina superior izquierda en la grilla de la zona, desde 0. Va
            junto con posY; los dos en null quitan la mesa del plano. Si se cambia la zona
            sin indicarla, la mesa queda sin ubicar.
          example: 8
        posY:
          type: integer
          nullable: true
          minimum: 0
          description: Fila de la esquina superior izquierda, desde 0. Va junto con posX.
          example: 5
        ancho:
          type: integer
          minimum: 1
          description: Columnas que ocupa la mesa en el plano.
          example: 3
        alto:
          type: integer
          minimum: 1
          description: Filas que ocupa la mesa en el plano.
          example: 2
        forma:
          $ref: '#/components/schemas/FormaMesa'
    MesaRespuestaDto:
      type: object
      properties:
        # id, zonaId, capacidad y etiqueta: sin cambios
        posX: { type: integer, nullable: true, minimum: 0, example: 5 }
        posY: { type: integer, nullable: true, minimum: 0, example: 0 }
        ancho: { type: integer, minimum: 1, example: 2 }
        alto: { type: integer, minimum: 1, example: 2 }
        forma: { $ref: '#/components/schemas/FormaMesa' }
      required: [id, zonaId, capacidad, etiqueta, posX, posY, ancho, alto, forma]
    ZonaRespuestaDto:
      properties:
        # campos actuales: sin cambios
        planoColumnas: { type: integer, minimum: 1, example: 12 }
        planoFilas: { type: integer, minimum: 1, example: 8 }
      # required: los actuales más planoColumnas y planoFilas
paths:
  /admin/mesas/{id}:
    patch:
      responses:
        '400':
          description: >-
            Datos inválidos: valores fuera de rango, una sola de las dos coordenadas, o una
            ubicación que deja la mesa fuera de la grilla de su zona.
        '409':
          description: >-
            Las causas actuales, o la mesa se superpone con otra mesa ubicada de su zona.
```

## Risks / Trade-offs

- [La regla de superposición está escrita dos veces: backend y frontend] → La del frontend solo
  arma un aviso; un desfasaje se nota como un aviso que no coincide con la respuesta de la API, no
  como datos inválidos. Los tests de ambos lados usan los mismos casos del seed.
- [`null` frente a ausente en class-validator (D1)] → Un test por caso: ausente no toca la
  posición, `null` en los dos quita la mesa, `null` en uno solo responde `400`.
- [Un reintento por serialización podría devolver un `409` genérico en vez del de superposición]
  → Es aceptable: el formulario muestra el mensaje que llegue y la mesa no queda superpuesta.
- [El dibujo del plano vive en PR #89] → La implementación espera a que se integre y se archive
  `plano-mesas` (proposal, Impact), y entonces extrae la geometría sin cambiar cómo se ve el
  plano del cliente: sus tests actuales tienen que seguir pasando.

## Migration Plan

Sin migración de base: las columnas ya existen. El despliegue es el habitual. La vuelta atrás es
revertir el PR: el contrato nuevo es aditivo y las posiciones que haya cargado el admin siguen
siendo válidas para el plano del cliente.
