## 1. Preparación

- [ ] 1.1 Crear `docs/entrega.md` con la estructura de D1 y D2: una sección de entregables, una
      sección por change archivado con los 11 puntos de `config.yaml` §13, y el apéndice de
      comandos de D3. Verificar que los 19 changes de `openspec/changes/archive/` tienen su
      sección (todavía vacía).

## 2. Verificación de la Definition of Done (D2, D3)

Cada tarea se da por hecha cuando ninguno de sus changes tiene un punto sin valor, y todo
«Cumple» tiene evidencia y todo «No aplica» o «Desvío» tiene su motivo.

- [ ] 2.1 `diseno-general-app`, `fundacion-repo`, `modelo-dominio`, `ci-integracion-db` y
      `auth-admin`.
- [ ] 2.2 `frontend-base`, `gestion-salon`, `disponibilidad`, `reserva-consultar` y
      `reservas-crear`.
- [ ] 2.3 `catalogo-publico`, `cancelacion-turnos`, `reserva-vip`, `frontend-admin`,
      `exposicion-red-local` y `throttle-rutas-admin`.
- [ ] 2.4 `frontend-cliente`, `rediseno-frontend-ichigo` y `plano-mesas`.
- [ ] 2.5 Abrir un issue por cada desvío que se pueda corregir y enlazarlo desde su fila.
      Verificar que cada «Desvío» de `docs/entrega.md` tiene su issue o la explicación de por
      qué no se corrige.

## 3. Entregables de la consigna

- [ ] 3.1 Completar la sección de entregables de `docs/entrega.md` con el README, el resultado
      de `openspec validate --all --strict` y del linter de OpenAPI (`npm run openapi:lint`),
      el enlace a los PRs cerrados y el enlace a los runs de CI de `main`. Verificar que los dos
      comandos pasan en `main` el día que se completa la tarea, y anotar la fecha y el SHA.

## 4. README (D5)

- [ ] 4.1 Agregar la sección «Decisiones de diseño», con una o dos líneas por decisión y un
      enlace al `design.md` archivado. Verificar que cada enlace abre el archivo correcto.
- [ ] 4.2 Corregir el enlace a `openspec/changes/exposicion-red-local/design.md`, que ahora
      está en `archive/2026-10-05-exposicion-red-local/`, y enlazar `docs/entrega.md`.
      Verificar que ninguna ruta a `openspec/` de `README.md`, `backend/README.md`,
      `frontend/README.md` y `docs/` apunta a un archivo que no existe.

## 5. Roadmap (D6)

- [ ] 5.1 Reemplazar «Estado al 2026-09-22» de `docs/roadmap-mvp.md` por el estado a la fecha,
      con cada change en archivado, activo o pendiente y su responsable, y marcar como
      históricas las secciones de planificación. Verificar que ningún change archivado figura
      como pendiente.

## 6. Recorrido de punta a punta

- [ ] 6.1 Con la base local migrada y seedeada, recorrer desde el frontend el flujo de
      `docs/roadmap-mvp.md` §13 («Fase 5 y cierre») y registrar en `docs/entrega.md` cada paso
      con su resultado. Si al seed le faltan datos para algún paso (por ejemplo, un turno ya
      pasado para el `NO_SHOW`), anotarlo y abrir un issue, sin cambiar el seed en este change.

## 7. Cierre

- [ ] 7.1 Correr `openspec validate entrega-final --strict` y `npm run lint`, abrir el primer PR
      de implementación (D7) con descripción en español enlazada a este change y pedir la
      revisión de un compañero.
- [ ] 7.2 A medida que se archivan `despliegue-continuo-ec2`, `ip-real-detras-de-cloudflare`,
      `verificacion-version-desplegada` y `plano-mesas-admin`, sumar su sección a
      `docs/entrega.md` con el mismo criterio de la sección 2. Verificar que no queda ningún
      change archivado sin sección.
- [ ] 7.3 En el segundo PR (D7), archivar el change con `openspec archive entrega-final` y
      verificar que `openspec validate --all --strict` sigue pasando.
