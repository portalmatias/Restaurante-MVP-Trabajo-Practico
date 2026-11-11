## Context

La motivación está en proposal.md. Hoy `Reserva` guarda nombre, email y teléfono del cliente,
y `POST /reservas` rechaza con `400` cualquier campo fuera de los siete conocidos
(`forbidNonWhitelisted`). La consulta pública devuelve una vista mínima sin datos de contacto, y
el plano de mesas no expone ningún dato de las reservas. El cambio toca la base, tres
respuestas de la API y tres pantallas, por eso este documento.

## Goals / Non-Goals

**Goals:**
- Un campo opcional que no cambie el comportamiento de quien no lo usa: un pedido sin
  `notaCliente` responde igual que hoy, salvo el campo nuevo en `null` en las respuestas.
- Que backend, base y frontend cuenten el largo de la misma manera.

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

En `CrearReservaDto`, un `@Transform` quita los espacios de los bordes y convierte el texto
vacío en `undefined` antes de las validaciones. Así el límite de 500 se mide sobre lo que se
guarda (spec "Los espacios de los bordes no cuentan para el límite"), y una nota de solo
espacios termina en `null` sin error. Un valor que no es texto (`42`) no se transforma, y
`@IsString()` lo rechaza con `400`.

- `@MaxLength(500)` de class-validator usa `isLength` de validator.js, que cuenta un par
  sustituto (un emoji) como un carácter, igual que PostgreSQL. Un test fija ese caso (spec "Un
  emoji cuenta como un carácter").
- **Alternativa descartada:** recortar en el servicio. El DTO ya validaría el largo sin recortar,
  y una nota de 500 caracteres con espacios en los bordes se rechazaría sin motivo.

### D3. La nota en las respuestas

`notaCliente` se suma como `string | null`, siempre presente, en `ReservaCreadaRespuestaDto`,
`ReservaConsultadaRespuestaDto` y `ReservaAdminRespuestaDto`.

- En la creación, quien envía la nota es quien la recibe. En la consulta pública, la vista ya
  exige código y email, el mismo control que protege la reserva.
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
          maxLength: 500
          description: >-
            Nota opcional del cliente para el restaurante. Se guarda sin los espacios de los
            bordes; vacía o con solo espacios, la reserva queda sin nota.
          example: Es un cumpleaños.
    ReservaCreadaRespuestaDto:
      properties:
        notaCliente: { type: string, nullable: true, example: Es un cumpleaños. }
      # required: los actuales más notaCliente
    ReservaConsultadaRespuestaDto:
      properties:
        notaCliente: { type: string, nullable: true, example: Es un cumpleaños. }
      # required: los actuales más notaCliente
    ReservaAdminRespuestaDto:
      properties:
        notaCliente: { type: string, nullable: true, example: Es un cumpleaños. }
      # required: los actuales más notaCliente
```

`npm run openapi:check` tiene que pasar, y los tipos del frontend se regeneran.

### D5. Frontend

- **Paso de datos:** un `<textarea>` con `Label`, la ayuda y el contador enlazados por
  `aria-describedby`. El contador cuenta con `Array.from(texto.trim()).length`, que da un
  elemento por punto de código, como el backend. El error de largo sigue el patrón de
  validación en línea del resto de los campos.
- **Confirmación y detalle:** el apartado «Tu nota» usa `whitespace-pre-line` para respetar los
  saltos de línea. React escapa el texto, así que no hace falta sanitizar.
- **Admin:** la nota va en la celda de contacto, debajo del teléfono. La búsqueda en la página
  sigue mirando solo código, nombre y email, como dice hoy su spec.

### D6. Logs

La nota no se escribe en ningún log del backend, igual que el resto de los datos de contacto.
Hoy el módulo de reservas no tiene logs, así que alcanza con no agregarlos: la revisión del PR
lo controla.

## Risks / Trade-offs

- [La nota puede traer datos de salud (alergias, celiaquía)] → Solo la ven el admin y el
  cliente con código y email; no va a logs ni al plano. La ayuda del campo menciona las
  alergias porque es un uso esperado.
- [Contar distinto en frontend y backend (UTF-16 frente a puntos de código)] → Los dos cuentan
  puntos de código (D2 y D5), y el escenario del emoji lo fija con un test de cada lado.
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
