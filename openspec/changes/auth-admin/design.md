## Context

Ver `proposal.md` — `Why`. La entidad `Usuario` (email único, `passwordHash`, `rol`) ya está
definida en `openspec/specs/modelo-dominio/spec.md`. Este documento resuelve cómo implementar
el login y los guards sobre NestJS + Passport + `@nestjs/jwt`, ya decididos como stack en
`config.yaml` §5. No hay código en el repo todavía: `backend/` nace en la implementación de
`fundacion-repo` (spec ya mergeada, implementación pendiente).

## Goals / Non-Goals

**Goals:**
- Resolver qué estrategia de Passport usar para el login y cuál para proteger rutas.
- Definir dónde vive la comparación de contraseña con bcrypt y qué excepción HTTP dispara.
- Definir cómo `RolesGuard` obtiene el rol requerido de cada ruta.

**Non-Goals:**
- No define refresh tokens ni recuperación de contraseña — `config.yaml` §5 los excluye
  explícitamente del MVP.
- No define el endpoint de gestión de usuarios (alta de nuevos admins) — no está en el alcance
  de ninguna capability listada en `docs/roadmap-mvp.md`; el seed de `modelo-dominio` ya crea
  el usuario admin inicial.

## Decisions

### Login sin `passport-local`
**Decisión:** el login se implementa como un método de servicio (`AuthService.login`) que
busca el `Usuario` por email y compara la contraseña con `bcrypt.compare`, sin usar la
estrategia `passport-local`. **Alternativa considerada:** usar `PassportLocalStrategy` +
`LocalAuthGuard` para el login, como es común en tutoriales de NestJS. Se descarta: agregaría
una dependencia (`passport-local`) que `config.yaml` §2 obligaría a justificar, a cambio de
nada — el flujo de login de este proyecto es un único endpoint con dos campos fijos (email,
contraseña), no gana nada de la abstracción de estrategias intercambiables que ofrece
Passport para credenciales. `passport` + `passport-jwt` sí se usan, pero solo para el lado de
**verificación** del token en rutas protegidas (ver próxima decisión).

### Verificación de rutas protegidas con `passport-jwt`
`JwtAuthGuard` extiende `AuthGuard('jwt')` de `@nestjs/passport`, respaldado por una
`JwtStrategy` (`passport-jwt`) que extrae el bearer token del header `Authorization`, verifica
la firma contra `JWT_SECRET` y valida la expiración automáticamente (comportamiento de
`passport-jwt`, no hay que reimplementarlo). El método `validate()` de la estrategia devuelve
`{ id: sub, rol }`, que NestJS adjunta a `request.user`.

### `RolesGuard` y el decorador `@Roles()`
`RolesGuard` lee los roles requeridos de la ruta con `Reflector` (metadata seteada por un
decorador `@Roles(RolUsuario.ADMIN)` sobre el handler) y los compara contra
`request.user.rol`, que ya dejó `JwtAuthGuard` (vía `JwtStrategy`). `RolesGuard` corre después
de `JwtAuthGuard` en la cadena de guards — si no hay usuario autenticado, `JwtAuthGuard` ya
cortó la solicitud con `401` antes de que `RolesGuard` se ejecute.

### Variables de entorno: ninguna nueva
`JWT_SECRET` y `JWT_EXPIRES_IN` ya figuran en la lista de variables mínimas de `config.yaml`
§10. Este change no agrega ninguna variable a `.env.example`.

### Rate limiting en `/auth/login` con `@nestjs/throttler`
**Decisión:** `/auth/login` lleva un `@Throttle()` propio, más estricto que el default (por
ejemplo 5 intentos / 60s por IP), usando `@nestjs/throttler`. **Alternativa considerada:**
dejarlo sin throttling, apoyándose en que `config.yaml` §5 solo lo exige explícitamente para
las rutas públicas de cliente (por el código de reserva de baja entropía). Se descarta: un
login de admin es el endpoint de mayor privilegio del sistema (acceso total al panel), y es
un objetivo típico de fuerza bruta/credential stuffing independientemente de si el identificador
(email) es público o no — la ausencia de una exigencia explícita en §5 no equivale a que el
riesgo no exista. `@nestjs/throttler` ya está permitido por `config.yaml` §2 para las rutas de
cliente, así que reusarlo acá no suma una dependencia nueva, solo una configuración adicional
del mismo módulo. `THROTTLE_TTL` y `THROTTLE_LIMIT` (ya listadas en `config.yaml` §10) se
reusan como default global; el guard de `/auth/login` sobreescribe esos valores con un límite
más estricto vía el decorador.

## Risks / Trade-offs

- **[Riesgo]** Sin refresh tokens, un JWT expirado interrumpe el trabajo del admin a mitad de
  sesión → **Mitigación:** decisión ya tomada en `config.yaml` §5 (fuera de alcance del MVP),
  60 minutos es suficiente para una sesión de gestión típica del TP.
- **[Riesgo]** El secreto del JWT rotado invalida todos los tokens activos → **Mitigación:**
  aceptable — vidas de token cortas (60 min) ya acotan el impacto, y la rotación de secreto no
  es una operación frecuente en este MVP.
