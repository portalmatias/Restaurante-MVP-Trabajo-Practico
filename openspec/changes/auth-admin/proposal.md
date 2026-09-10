## Why

El admin del sistema necesita autenticarse para acceder a las rutas de gestión (salón,
confirmación de reservas VIP, marcar no-shows). Hoy la entidad `Usuario` ya existe en
`openspec/specs/modelo-dominio/spec.md` (email único, `passwordHash`, `rol`), pero ningún
change define todavía cómo se emite, valida o exige un token de sesión. Sin esto, ninguna ruta
de admin de las capabilities siguientes (`gestion-salon`, confirmación VIP) tiene forma de
protegerse, y `docs/roadmap-mvp.md` (Fase 3) marca este change como prerrequisito de
`gestion-salon`.

## What Changes

- Se introduce la capability `auth-admin`, que especifica:
  - `POST /auth/login`: valida email + contraseña contra `Usuario`, compara el hash con
    bcrypt, y devuelve un JWT de acceso si son correctos.
  - El JWT de acceso: vida corta (60 minutos), incluye `sub` (id de Usuario) y `rol`; viaja en
    el header `Authorization: Bearer <token>`.
  - Un guard (`JwtAuthGuard`) que exige un JWT válido para acceder a una ruta protegida, y un
    guard de rol (`RolesGuard`) que además exige que el `rol` del token coincida con el
    requerido por el endpoint.
  - Sin refresh tokens ni recuperación de contraseña en el MVP (si el JWT expira, el admin
    vuelve a hacer login).
  - Límite de intentos (`@Throttle()`) sobre `POST /auth/login`, más estricto que el default
    de `@nestjs/throttler`: es el endpoint de mayor privilegio del sistema y un objetivo típico
    de fuerza bruta, independientemente de que `config.yaml` §5 solo exija throttling
    explícitamente en las rutas públicas de cliente.
- No modifica la entidad `Usuario` de `modelo-dominio` — sus campos ya alcanzan para este
  change. No hay delta sobre esa capability.
- No introduce librerías nuevas: `@nestjs/jwt`, `passport` (+ `passport-jwt`) y `bcrypt` ya
  están avaladas por `config.yaml` §5. `@nestjs/throttler` ya está permitido por §2 (se suma de
  todos modos para las rutas públicas de cliente en `disponibilidad`/`reserva-consultar`); este
  change solo agrega una configuración de throttling propia sobre `/auth/login`, no una
  dependencia nueva.

## Capabilities

### New Capabilities
- `auth-admin`: login de administrador, emisión y validación de JWT, y los guards que
  protegen rutas de admin por autenticación y por rol.

### Modified Capabilities
_Ninguna._ La entidad `Usuario` que consume este change ya quedó definida en
`modelo-dominio`; este change no le agrega ni le cambia ningún requisito.

## Impact

- **Bloquea:** `gestion-salon` (Fase 3, dueño lussofacundo-iresm) necesita el guard mergeado
  para proteger sus rutas de admin — aunque, según el roadmap, la spec de `gestion-salon` se
  puede escribir antes sin esperar a este change.
- **Dependencia externa a este change:** el PR de spec (`feature/spec-auth-admin`, este) no
  necesita código. El PR de implementación (`feature/auth-admin`) depende de que exista
  `backend/` — lo crea la implementación de `fundacion-repo` (`feature/fundacion-repo`), que
  al momento de escribir este proposal todavía no arrancó (solo se mergeó su spec). También
  depende de que la implementación de `modelo-dominio` (`feature/modelo-dominio`) haya corrido
  la migración que crea la tabla `Usuario`.
- **Código afectado (cuando se implemente):** `backend/src/auth/` (`auth.module.ts`,
  `auth.controller.ts`, `auth.service.ts`, `dto/login.dto.ts`, guards y estrategia de
  Passport), y sus tests en `backend/src/auth/**/*.spec.ts` + `backend/test/auth.e2e-spec.ts`.
- **Afecta `openapi/openapi.yaml`:** este change agrega el endpoint `POST /auth/login` y el
  `securityScheme` de bearer JWT al contrato. `openapi/openapi.yaml` todavía no existe en el
  repo (nace en la implementación de `fundacion-repo`); si para cuando se implemente este
  change ya existe, se actualiza en el mismo PR (Definition of Done, `config.yaml` §13).
