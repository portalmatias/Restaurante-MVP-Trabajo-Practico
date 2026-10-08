# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Cliente (público, sin cuenta).** Quiere reservar una mesa rápido, casi siempre desde el
  celular. No se registra ni inicia sesión: deja nombre, email y teléfono, y recibe un código de
  reserva de 8 caracteres. Con ese código y su email consulta o cancela la reserva.
- **Administrador (rol único del MVP).** Usa el panel en una computadora. Inicia sesión con email
  y contraseña, mira el estado del aforo y las reservas, y gestiona zonas, mesas y turnos.

## Product Purpose
MVP de una plataforma de reservas para un restaurante. El cliente consulta disponibilidad, crea,
consulta y cancela su reserva; el administrador gestiona el salón y ve el aforo. Es un Trabajo
Práctico grupal académico (3 integrantes) de Ingeniería de Software II: además del producto se
evalúa la calidad de las especificaciones, los Pull Requests y el CI, así que el trabajo tiene
que ser trazable y revisable por pares.

## Positioning
Reservar un omakase de alta gama sin cuenta ni fricción: elegir fecha, turno y comensales, dejar los datos de contacto y
quedarse con un código para consultar o cancelar. Dos zonas del salón (STANDARD y VIP) con reglas
distintas de capacidad y de reserva.

## Operating Context
- Interfaz en español rioplatense (voseo: "Reservá", "Elegí", "Confirmá").
- Flujo del cliente: `/` → `/reservas` → `/reservas/nueva` (selección) → `datos` → `resultado` →
  `exito`; consulta y cancelación en `/reservas/consultar`.
- Flujo del admin: `/admin/login` y panel protegido (`/admin`, `/admin/reservas`, `/admin/salon`).
- El contrato con el backend es `openapi/openapi.yaml`; el frontend no define reglas de negocio
  (zonas, turnos, aforo y ventanas de cancelación salen de la API y de la configuración).
- Next.js 16 con Tailwind 4 y tokens semánticos de color en `app/globals.css`, solo modo claro.

## Capabilities and Constraints
- Sin cuentas de cliente, sin recuperación de contraseña, sin refresh tokens: si la sesión del
  admin expira (60 min), se vuelve a iniciar sesión.
- Ningún dato personal de otras reservas se muestra jamás en pantallas públicas.
- Las rutas públicas de consulta y cancelación tienen límite de solicitudes; la interfaz tiene que
  manejar bien el error `429` y los demás estados de error y carga.
- Restricción técnica: ver `frontend/AGENTS.md`; esta versión de Next.js tiene cambios que rompen
  convenciones previas, hay que leer la guía de `node_modules/next/dist/docs/` antes de escribir
  código.
- **Sin decidir:** logotipo e imágenes propias.

## Brand Commitments
- **Cocina y categoría (confirmado por el equipo):** restaurante **japonés**, de **omakase de alta
  gama**, con **comida tradicional oriental**. El tono es de lujo sobrio y de experiencia íntima, no
  de delivery ni de comida rápida.
- **Nombre (confirmado por el equipo): Ichigo.** El restaurante sigue siendo ficticio. El
  logotipo y el wordmark están sin definir y los propone el diseño. No debe inventar historia,
  chef, premios, precios ni claims sobre el local. Hoy el título del sitio es solo "Reservas de
  Restaurante" y hay que cambiarlo a Ichigo.
- **Referencias visuales que dio el equipo** (a usar como material de la fase de diseño, no como
  requisitos): imariomakase.com (omakase de alta gama), sakesushi.vip (claridad de la acción
  principal) y verostudio.com (ambición y ritmo de scroll).

## Evidence on Hand
No hay fotos, testimonios, reseñas ni datos reales del local. Hay que trabajar sin imágenes de
comida ni de salón propias y no fabricar prueba social. Los únicos assets en `public/` son los
SVG por defecto de Next.js.

## Product Principles
1. **Reservar en pocos pasos desde el celular.** Cada pantalla del cliente se resuelve con una
   mano y sin cuenta.
2. **La confianza se gana con claridad.** El código de reserva, los plazos de cancelación y los
   errores se explican en lenguaje llano, sin culpar al usuario.
3. **El admin necesita escanear, no admirar.** El panel prioriza el estado del aforo y las
   acciones frecuentes en escritorio.
4. **Nada inventado.** Sin marca, cocina ni prueba social que el equipo no haya definido.
5. **Revisable por pares.** Los cambios de diseño se expresan en tokens y componentes existentes,
   con cambios acotados que se puedan revisar en un PR.

## Accessibility & Inclusion
No hay un estándar exigido por el equipo. Se asume como base WCAG 2.1 AA (contraste, foco visible,
objetivos táctiles, uso por teclado), a confirmar con el equipo.
