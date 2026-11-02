## Why

Con `plano-mesas`, el layout de cada zona lo define solo el seed: una mesa que el admin da de
alta queda "sin ubicar" y nunca aparece en el dibujo, y no hay forma de moverla ni de cambiar su
tamaño o su forma sin tocar la base. El design de `plano-mesas` (D6) dejó este editor para un
change siguiente; este es ese change.

## What Changes

- `PATCH /admin/mesas/:id` acepta campos opcionales para ubicar la mesa en el plano de su zona:
  columna y fila (`posX`, `posY`), tamaño (`ancho`, `alto`) y `forma`. También permite quitarla
  del plano (`posX` y `posY` en `null`). Es un cambio aditivo: un pedido sin esos campos se
  comporta igual que hoy.
- El backend valida la ubicación contra la grilla de la zona y contra las demás mesas de esa zona:
  rechaza con `400` los valores fuera de rango (coordenadas negativas, tamaño menor que 1 o mayor
  que la grilla, una forma que no existe, `null` en el tamaño o la forma), una mesa que se sale de
  la grilla o un pedido con solo una de las dos coordenadas, y con `409` una mesa que se superpone
  con otra. Así ningún valor inválido llega a los CHECK de la base. La validación corre dentro de la transacción
  `Serializable` que ya usa la edición de mesas, así dos ediciones simultáneas no pueden dejar
  dos mesas en la misma celda.
- Si el admin cambia una mesa de zona sin mandar una ubicación nueva, la mesa queda sin ubicar en
  la zona nueva: sus coordenadas viejas no significan nada en otra grilla.
- `GET /admin/mesas` y las respuestas de alta y edición de mesas incluyen la ubicación, el tamaño y
  la forma. `GET /admin/zonas` incluye el tamaño de la grilla del plano (`planoColumnas`,
  `planoFilas`). Ambos son campos nuevos en respuestas: no rompen a ningún consumidor.
- En `/admin/salon`, el formulario de edición de una mesa suma la sección "Ubicación en el plano":
  columna, fila, ancho, alto y forma, con una vista previa del plano de la zona que se actualiza
  al cambiar los valores y marca si la mesa se superpone con otra. Un botón permite quitar la
  mesa del plano.

### Fuera de alcance

- Arrastrar mesas sobre la grilla: la ubicación se carga con el formulario (decisión del equipo,
  2026-10-28).
- Cambiar el tamaño de la grilla de una zona (`planoColumnas`, `planoFilas`): lo sigue fijando el
  seed. Si se achicara a mano, la mesa que queda afuera conserva su posición: el plano del
  cliente no la dibuja y la lista la muestra como sin ubicar (así lo implementa `plano-mesas` en
  #89, aunque su spec no lo fija), y el admin la puede volver a ubicar con este editor.
- Ubicar la mesa en el mismo alta: la mesa nueva se crea sin ubicar, como hoy, y se ubica al
  editarla.
- Que el cliente elija la mesa (D9 de `plano-mesas`).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `gestion-salon`: el listado de zonas incluye el tamaño de la grilla; el listado de mesas incluye
  la ubicación; la edición de una mesa permite ubicarla, cambiar su tamaño y su forma, o quitarla
  del plano, con validación de grilla y de superposición; un cambio de zona sin ubicación nueva
  deja la mesa sin ubicar.
- `frontend-admin`: la edición de una mesa en `/admin/salon` suma la ubicación en el plano con
  vista previa.

## Impact

- **Dependencia:** necesita el change `plano-mesas` integrado y archivado (PR #89), porque usa las
  columnas `posX`, `posY`, `ancho`, `alto` y `forma` que define su delta de `modelo-dominio` y los
  componentes del dibujo del plano. Esta propuesta se puede revisar antes, pero la implementación
  arranca después de ese archivo.
- **Backend:** `mesas` (DTO de edición y de respuesta, service), `zonas` (DTO de respuesta) y
  `plano-mesas/layout-plano.ts`, que hoy usa el seed y pasa a usarse también desde el service.
  Sin migraciones: las columnas ya existen.
- **Contrato:** `openapi/openapi.yaml` (`ActualizarMesaDto`, `MesaRespuestaDto`,
  `ZonaRespuestaDto` y las respuestas `400`/`409` de `PATCH /admin/mesas/{id}`) y los tipos
  generados del frontend.
- **Frontend:** `mesas-panel.tsx` y el dibujo del plano, del que se reutiliza la geometría.
- **Seguridad:** sin rutas nuevas. `PATCH /admin/mesas/:id` ya está protegida con
  `JwtAuthGuard` + `RolesGuard` y con el límite de las rutas de administración.
