## 1. Actualizar la constitución del proyecto (`openspec/config.yaml`)

- [x] 1.1 En §5 (Autenticación), quitar la nota "confirmar con la docente" sobre el modelo
      de cliente y dejar asentado sin ambigüedad el modelo sin cuenta (nombre + email +
      teléfono, código de reserva + email para consultar/cancelar). Verificado con
      `grep -n "RF-01\|RF-02\|RF-03\|auth/register\|auth/login" openspec/config.yaml`: los
      patrones solo aparecen en la nota §5 que documenta la decisión (rechazo del modelo
      docx), sin otros restos del flujo de registro/login.
- [x] 1.2 En §6 (tabla de Zonas), confirmar el rango VIP como 2 a 12 comensales sin
      ambigüedad frente a un mínimo por defecto distinto. Verificado con
      `grep -n "mínimo de comensales\|RN-07\|por defecto 4"`: sin resultados; el archivo ya
      traía el rango correcto, no hizo falta editar.
- [x] 1.3 En §6 (Estados de una reserva), confirmar el enum
      `PENDIENTE / CONFIRMADA / CANCELADA / NO_SHOW`. Verificado con
      `grep -n "COMPLETADA" openspec/config.yaml`: sin resultados; ya estaba correcto.
- [x] 1.4 En §6 (Mesas y asignación), confirmar que el texto describe *best fit* como único
      algoritmo de asignación automática del MVP. Verificado con
      `grep -n "primera mesa libre"`: sin resultados; ya estaba correcto.
- [x] 1.5 Corregir la línea "Ubicación: `openspec/project.md`" del encabezado (§0) para que
      diga que la constitución vive en `openspec/config.yaml` (campo `context:`), ya que el
      equipo no usa un `project.md` separado. Editado y verificado leyendo el encabezado
      actualizado.

## 2. Validar el resultado

- [x] 2.1 Correr `openspec doctor` y verificar que reporta la raíz de OpenSpec como `ok`.
      Resultado: `OpenSpec root: ok`.
- [x] 2.2 Confirmar que `openspec/config.yaml` sigue siendo YAML válido después de las
      ediciones. `openspec validate --specs --strict` corre sin error de parseo (reporta
      "No items found to validate", esperable porque todavía no hay specs archivadas).
- [x] 2.3 Correr `openspec validate diseno-general-app --strict` y verificar que el change
      completo (`proposal.md`, `design.md`, `tasks.md`, `.openspec.yaml` con
      `skip_specs: true`) sigue siendo válido tras los cambios de la sección 1. Resultado:
      "Change 'diseno-general-app' is valid".
