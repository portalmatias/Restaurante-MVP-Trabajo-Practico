## Context

La motivación está en proposal.md. Hoy `Reserva` guarda nombre, email y teléfono del cliente,
y `POST /reservas` rechaza con `400` cualquier campo fuera de los siete conocidos
(`forbidNonWhitelisted`). La consulta pública devuelve una vista mínima sin datos de contacto, y
el plano de mesas no expone ningún dato de las reservas. El cambio toca la base, dos
respuestas de la API y dos pantallas, por eso este documento.

## Goals / Non-Goals

**Goals:**
- Un campo opcional que no cambie el comportamiento de quien no lo usa: un pedido sin
  `notaCliente` responde igual que hoy, salvo el campo nuevo en `null` en las respuestas.
- Que backend, base y frontend cuenten el largo de la misma manera: en puntos de código (D2).

**Non-Goals:**
- Editar o borrar la nota después de crear la reserva.
- Filtrar o buscar por la nota en el admin.
- Mostrar la nota en el dashboard de aforo o en el plano de mesas.
- Enviar la nota por email o notificar al restaurante.

## Decisions

### D1. Columna `notaCliente String? @db.VarChar(500)`

Una columna nullable en `Reserva`, con una migración que solo hace `ADD COLUMN`. No modifica
filas existentes, que quedan en `NULL`.

- **Por qué `VarChar(500)` y no `Text`:** el límite queda también en la base, como defensa si
  algún día otra ruta escribe la nota sin pasar por el DTO. En PostgreSQL, `varchar(n)` cuenta
  caracteres (puntos de código), no bytes.
- **Alternativa descartada:** una tabla aparte de notas. Sería necesaria con varias notas o con
  historial, y ninguna de las dos cosas está pedida.

### D2. Normalizar antes de validar

En `CrearReservaDto`, `notaCliente` lleva `@IsOptional()`, para que `undefined` y `null` pasen
sin error, y un `@Transform` que quita los espacios de los bordes y convierte el texto vacío en
`undefined` antes de las validaciones. Así el límite de 500 se mide sobre lo que se guarda (spec
"Los espacios de los bordes no cuentan para el límite"), y una nota ausente, `null`, vacía o de
solo espacios termina en `null` sin error. Un valor que no es texto (`42`) no se transforma, y
`@IsString()` lo rechaza con `400`. El servicio guarda `notaCliente ?? null`.

- **Un solo conteo: puntos de código.** El largo es `Array.from(texto).length`, igual que
  `varchar(n)` de PostgreSQL. No se usa `@MaxLength(500)` de class-validator: el DTO define un
  validador propio (`@MaxPuntosDeCodigo(500)`) con esa misma cuenta, así backend y frontend
  comparten la definición. Un emoji simple cuenta como uno; uno compuesto (familia, bandera,
  tono de piel) o con selector de variación (`❤️` son dos puntos de código) cuenta como varios.
  Tests: 499 letras más "🎂" se aceptan; 499 letras más "❤️" se rechazan (501).
- **Alternativa descartada:** recortar en el servicio. El DTO ya validaría el largo sin recortar,
  y una nota de 500 caracteres con espacios en los bordes se rechazaría sin motivo.

### D3. La nota en las respuestas

`notaCliente` se suma como `string | null`, siempre presente, en `ReservaCreadaRespuestaDto` y
`ReservaAdminRespuestaDto`.

- En la creación, quien envía la nota es quien la recibe.
- **La consulta pública NO la devuelve.** La nota puede traer datos de salud y el par código +
  email no alcanza como control: el código es un identificador de baja entropía (no un secreto),
  y una enumeración o una filtración revelaría la nota. Alternativa descartada: agregar un
  secreto de un solo uso (OTP), un mecanismo nuevo fuera del alcance. Si más adelante se quiere
  mostrarla ahí, se decide junto con ese control.
- **Siempre presente y no opcional:** el frontend no tiene que distinguir "ausente" de "sin
  nota", y el contrato lo deja explícito.
- **Alternativa descartada:** no devolverla en la creación y que la confirmación muestre lo que
  la persona escribió. La pantalla mostraría el texto sin recortar, distinto de lo guardado.

### D4. Contrato OpenAPI

Fragmento que incorpora el PR de implementación a `openapi/openapi.yaml`:

```yaml
components:
  schemas:
    CrearReservaDto:
      properties:
        # los siete campos actuales: sin cambios
        notaCliente:
          type: string
          nullable: true
          maxLength: 500
          description: >-
            Nota opcional del cliente para el restaurante. Se guarda sin los espacios de los
            bordes; ausente, `null`, vacía o con solo espacios, la reserva queda sin nota.
            El largo se cuenta en puntos de código.
          example: Es un cumpleaños.
    ReservaCreadaRespuestaDto:
      properties:
        notaCliente: { type: string, nullable: true, example: Es un cumpleaños. }
      # required: los actuales más notaCliente
    # ReservaConsultadaRespuestaDto: sin cambios (no lleva la nota)
    ReservaAdminRespuestaDto:
      properties:
        notaCliente: { type: string, nullable: true, example: Es un cumpleaños. }
      # required: los actuales más notaCliente
```

`npm run openapi:check` tiene que pasar, y los tipos del frontend se regeneran.

### D5. Frontend

- **Paso de datos:** un `<textarea>` con `Label`, la ayuda y el contador enlazados por
  `aria-describedby`. El contador, el límite de 500, el error y el pedido usan el mismo texto
  sin los espacios de los bordes (`texto.trim()`) y cuentan con `Array.from(...).length`, como
  el backend. El error de largo sigue el patrón de validación en línea del resto de los campos.
- **Confirmación:** la página `/reservas/nueva/exito` solo lee el código y el estado de la
  query, y la nota no puede ir en la URL (dato sensible; quedaría en historial y logs).
  Decisión: al crearse la reserva, el formulario guarda en `sessionStorage` la `notaCliente`
  de la respuesta (clave por código de reserva) antes de navegar, y un componente cliente de la
  página de éxito la lee y muestra el apartado «Tu nota» con `whitespace-pre-line` para
  respetar los saltos de línea. Sin nota guardada, o con `sessionStorage` no disponible, no
  muestra el apartado. React escapa el texto, así que no hace falta sanitizar. Alternativa
  descartada: hacerla viajar por la query.
  Al salir de la confirmación (cuando el componente se desmonta) la nota se borra de
  `sessionStorage`, porque puede traer datos de salud y no hace falta que quede en el navegador.
  No se borra al leerla: recargar la confirmación la seguiría mostrando hasta que la persona se
  va. (Observación de la revisión de #115.)
- **Detalle de la consulta:** no cambia, porque la consulta pública no devuelve la nota (D3).
- **Admin:** la nota va en la celda de contacto, debajo del teléfono, con `whitespace-pre-line`
  para respetar los saltos de línea. La búsqueda en la página
  sigue mirando solo código, nombre y email, como dice hoy su spec.

### D6. Logs

La nota no se escribe en ningún log del backend, igual que el resto de los datos de contacto.
Hoy el módulo de reservas no tiene logs, así que alcanza con no agregarlos: la revisión del PR
lo controla.

## Risks / Trade-offs

- [La nota puede traer datos de salud (alergias, celiaquía)] → Solo la ven el admin y quien la
  acaba de enviar; no va a la consulta pública, a la URL, a logs ni al plano. La ayuda del campo menciona las
  alergias porque es un uso esperado.
- [Contar distinto en frontend y backend (UTF-16 frente a puntos de código)] → Los dos cuentan
  puntos de código con `Array.from` (D2 y D5), y los escenarios del emoji lo fijan con un test
  de cada lado.
- [Un emoji compuesto, como una familia o una bandera, son varios puntos de código] → Cuenta
  como varios caracteres, en el contador y en el backend por igual. Es aceptable: el límite
  solo evita textos gigantes.
- [Textos largos ensanchan la fila del listado del admin] → La celda permite el corte de línea;
  500 caracteres son unas cinco líneas.

## Migration Plan

Una migración que agrega la columna nullable, sin tocar datos. El despliegue es el habitual
(el CD corre `prisma migrate deploy`). La vuelta atrás es revertir el PR; la columna puede
quedar en la base sin efecto, o quitarse con una migración nueva si se decide abandonar la
función.
