## Why

Los dos documentos base del proyecto —`openspec/config.yaml` (constitución técnica) y
`requerimientos-mvp.docx` (relevamiento funcional)— se escribieron por separado y difieren
en cuatro puntos estructurales: el modelo de autenticación del cliente, los estados de una
reserva, el mínimo de comensales de la zona VIP y el algoritmo de asignación de mesa. Si el
equipo empieza a repartirse ramas (`feature/auth`, `feature/spec-disponibilidad`,
`feature/reserva-crear`, etc.) sin resolver esto antes, cada integrante puede terminar
implementando una versión distinta del mismo concepto.

Este change no agrega comportamiento nuevo al sistema: fija las decisiones que ya estaban
en conflicto y deja un mapa de arquitectura de referencia, para que los changes de
capabilities concretas (auth, gestión de salón, disponibilidad, reservas) que siguen en el
orden de trabajo del docx puedan escribirse sin volver a discutir estos puntos.

## What Changes

- **Decisión — Autenticación de cliente:** se adopta el modelo de `config.yaml`: el cliente
  **no crea cuenta**. Reserva dejando nombre, email y teléfono; consulta y cancela con
  **código de reserva (8 caracteres) + email**. Se descartan los RF-01/02/03 y los endpoints
  `/auth/register` / `/auth/login` orientados a cliente del docx. El admin sí se autentica
  con JWT (`@nestjs/jwt` + Passport).
- **Decisión — Estados de la reserva:** se adopta el enum de `config.yaml`:
  `PENDIENTE → CONFIRMADA → CANCELADA`, con `NO_SHOW` como estado adicional que solo el
  admin puede marcar, y solo después de pasado el turno. Se descarta el estado `COMPLETADA`
  del docx (RN-11); no hay un evento explícito de "reserva completada con éxito" en el MVP.
- **Decisión — Mínimo de comensales VIP:** se adopta el rango de `config.yaml`
  (VIP: 2 a 12 comensales) como el mínimo/máximo configurable de la zona
  (`Zona.minComensales` / tope superior), reemplazando el valor por defecto de 4 que
  proponía el docx (RN-07). Sigue siendo un valor de configuración, no hardcodeado.
- **Decisión — Asignación de mesa:** se adopta *best fit* (mesa disponible de menor
  capacidad que alcance) como algoritmo de asignación automática, según `config.yaml`. Esto
  **revierte explícitamente** la exclusión de alcance del docx, que dejaba la asignación
  inteligente "fuera del MVP" a favor de "primera mesa libre que cumpla capacidad" (RF-12).
  Es una decisión de producto, no solo técnica: hay que dejarla asentada porque le quita a
  el equipo el argumento de "no está en el alcance" si en algún momento se cuestiona el
  esfuerzo de implementarla.
- Se actualiza `openspec/config.yaml` (`context:`) para reflejar estas cuatro decisiones sin
  ambigüedad y corregir la referencia rota a `openspec/project.md` (el archivo no existe;
  el contenido vive en `config.yaml`).
- Se agrega `design.md` con el mapa de arquitectura general: módulos del backend por
  dominio, límites del contrato `backend` ↔ `frontend` vía OpenAPI, y el flujo de punta a
  punta de una reserva (consulta de disponibilidad → creación → confirmación/cancelación),
  como referencia para los changes de capabilities que siguen.

## Capabilities

### New Capabilities
_Ninguna._ Este change no introduce specs de comportamiento — ver `design.md` para el
detalle de por qué. Las capabilities de dominio (`autenticacion-admin`, `gestion-salon`,
`disponibilidad`, `reservas`) se especifican cada una en su propio change posterior, según
el orden de trabajo de `requerimientos-mvp.docx` §10.

### Modified Capabilities
_Ninguna._ Todavía no existen specs archivadas en `openspec/specs/` sobre las que este
change pueda declarar un delta.

> Este change fija `skip_specs: true` en su `.openspec.yaml`: no cambia comportamiento del
> sistema, solo resuelve decisiones de diseño y las documenta. `openspec validate` no debe
> exigirle specs.

## Impact

- **`openspec/config.yaml`** (campo `context:`): se actualizan las secciones de
  autenticación (§5), reglas de negocio (§6) y la línea de "Ubicación" del encabezado.
- **Ningún código todavía.** No hay `backend/`, `frontend/` ni `prisma/schema.prisma` en el
  repo — este change es puramente de especificación/decisión.
- **Desbloquea** los siguientes changes del orden de trabajo (`feature/spec-modelo-dominio`,
  `feature/auth`, `feature/spec-disponibilidad`, `feature/reserva-crear`,
  `feature/cancelacion-turnos`, `feature/spec-reserva-vip`), que ahora pueden asumir estas
  cuatro decisiones como dadas en vez de volver a plantearlas.
