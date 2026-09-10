## 1. Prerrequisitos (bloqueante)

- [ ] 1.1 Confirmar que la implementación de `fundacion-repo` está mergeada a `main` y que
      `backend/` existe con Prisma configurado. No continuar con la sección 2 hasta que esto
      sea cierto — verificar con `ls backend/prisma` y `npm run build -w backend -- --help`.
- [ ] 1.2 Confirmar que la implementación de `modelo-dominio` ya aplicó la migración que crea
      la tabla `Usuario`. Verificar con `npx prisma migrate status -w backend` (o equivalente)
      y confirmando que el modelo `Usuario` aparece en `backend/prisma/schema.prisma`.

## 2. Módulo de autenticación

- [ ] 2.1 Crear `backend/src/auth/` (`auth.module.ts`, `dto/login.dto.ts` con
      `class-validator` para email/contraseña) y registrarlo en `AppModule`. Verificar que
      `npm run build -w backend` compila sin errores.
- [ ] 2.2 Implementar `AuthService.login`: busca el `Usuario` por email, compara la
      contraseña con `bcrypt.compare` contra `passwordHash`, lanza `UnauthorizedException`
      genérica si no coincide (sin indicar cuál dato falló), y firma un JWT con
      `@nestjs/jwt` (`sub`, `rol`) si coincide. Verificar con un test unitario que cubre el
      caso exitoso y el de credenciales incorrectas.
- [ ] 2.3 Implementar `AuthController` con `POST /auth/login` que llama a
      `AuthService.login`. Verificar con Supertest contra el usuario admin del seed y
      confirmar que la respuesta trae el JWT en el body.
- [ ] 2.4 Aplicar `@Throttle()` sobre `POST /auth/login` con un límite más estricto que el
      default de `@nestjs/throttler` (ver `design.md`). Verificar corriendo `THROTTLE_TTL`
      intentos + 1 seguidos contra el endpoint y confirmando que el último responde `429`.

## 3. Guards de autenticación y rol

- [ ] 3.1 Implementar `JwtStrategy` (`passport-jwt`) que valida firma y expiración contra
      `JWT_SECRET` y devuelve `{ id, rol }`. Verificar con un test unitario: un token válido
      pasa, uno con firma inválida es rechazado.
- [ ] 3.2 Implementar `JwtAuthGuard` (extiende `AuthGuard('jwt')`) y aplicarlo a una ruta de
      prueba. Verificar manualmente (o con Supertest) que una request sin header
      `Authorization` es rechazada.
- [ ] 3.3 Implementar el decorador `@Roles()` y `RolesGuard` (con `Reflector`), aplicado
      después de `JwtAuthGuard` en la cadena. Verificar con un test unitario que compara el
      rol requerido de la ruta contra el rol del token.

## 4. Tests de los requisitos de la spec

- [ ] 4.1 Test: login exitoso devuelve un JWT válido (spec: "Login de administrador",
      escenario "Login exitoso devuelve un JWT").
- [ ] 4.2 Test: login con email inexistente o contraseña incorrecta devuelve un error
      genérico, sin distinguir cuál dato falló (escenario "Credenciales incorrectas
      rechazadas").
- [ ] 4.3 Test: un JWT ya expirado es rechazado en una ruta protegida (spec: "Contenido y
      vigencia del JWT", generando un token con expiración forzada a un instante pasado).
- [ ] 4.4 Test e2e: una ruta de admin sin header `Authorization` responde `401` (spec:
      "Autenticación exigida en rutas de admin" — también exigido explícitamente por
      `config.yaml` §9).
- [ ] 4.5 Test e2e: una ruta de admin con JWT válido pero de un rol distinto al requerido
      responde `403` (spec: "Autorización por rol en rutas de admin" — también exigido
      explícitamente por `config.yaml` §9).
- [ ] 4.6 Test e2e: superar el límite de intentos configurado contra `/auth/login` responde
      `429` en el intento siguiente, sin llegar a validar credenciales (spec: "Límite de
      intentos de login").

## 5. Verificación final

- [ ] 5.1 Correr `openspec validate auth-admin --strict` y confirmar que el change es válido.
- [ ] 5.2 Si `openapi/openapi.yaml` ya existe para este momento, agregar `POST /auth/login` y
      el `securityScheme` de bearer JWT en el mismo PR (Definition of Done, `config.yaml`
      §13). Si todavía no existe, dejarlo anotado en la descripción del PR como pendiente.
- [ ] 5.3 Confirmar que no hicieron falta variables de entorno nuevas (`JWT_SECRET` y
      `JWT_EXPIRES_IN` ya están en `.env.example` desde `fundacion-repo`). Si alguna
      implementación concreta necesitó una variable adicional, agregarla y documentarla en
      el mismo PR.
