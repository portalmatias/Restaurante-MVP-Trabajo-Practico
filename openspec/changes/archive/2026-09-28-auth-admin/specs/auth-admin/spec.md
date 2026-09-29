## Purpose

Login del administrador y protección de las rutas de admin mediante JWT: emisión del token
al autenticarse y el rechazo de cualquier solicitud que no presente un token válido del rol
correcto.

## ADDED Requirements

### Requirement: Login de administrador
El sistema SHALL exponer `POST /auth/login`, que recibe email y contraseña, valida contra el
`Usuario` correspondiente comparando la contraseña con el hash almacenado mediante bcrypt, y
devuelve un JWT de acceso si coinciden.

#### Scenario: Login exitoso devuelve un JWT
- **WHEN** un Usuario envía su email y la contraseña correcta a `/auth/login`
- **THEN** el sistema responde con un JWT de acceso válido

#### Scenario: Credenciales incorrectas rechazadas
- **WHEN** se envía un email que no existe, o una contraseña que no coincide con el hash
  almacenado para ese email
- **THEN** el sistema rechaza el login sin indicar cuál de los dos datos era incorrecto

### Requirement: Contenido y vigencia del JWT
El sistema SHALL emitir un JWT de acceso que incluye `sub` (id del Usuario) y `rol`, con una
vigencia de 60 minutos y sin mecanismo de refresh.

#### Scenario: Token expirado no sirve para acceder a rutas protegidas
- **WHEN** pasaron más de 60 minutos desde la emisión de un JWT
- **THEN** el sistema rechaza ese JWT en cualquier ruta protegida y exige un nuevo login

### Requirement: Autenticación exigida en rutas de admin
El sistema SHALL rechazar cualquier solicitud a una ruta protegida que no incluya un JWT
válido en el header `Authorization: Bearer <token>`.

#### Scenario: Ruta de admin sin token rechazada
- **WHEN** se solicita una ruta de admin sin header `Authorization`
- **THEN** el sistema responde `401 Unauthorized` sin ejecutar la lógica de la ruta

### Requirement: Autorización por rol en rutas de admin
El sistema SHALL rechazar una solicitud a una ruta que exige un rol determinado cuando el
`rol` codificado en el JWT no coincide con el requerido, incluso si el JWT es válido.

#### Scenario: Ruta de admin con token de rol incorrecto rechazada
- **WHEN** se solicita una ruta que exige rol `ADMIN` presentando un JWT válido pero emitido
  para un rol distinto
- **THEN** el sistema responde `403 Forbidden` sin ejecutar la lógica de la ruta

### Requirement: Límite de intentos de login
El sistema SHALL limitar la cantidad de intentos a `POST /auth/login` por origen en una
ventana de tiempo, rechazando los intentos que superan ese límite antes de validar las
credenciales.

#### Scenario: Login bloqueado tras exceder el límite de intentos
- **WHEN** un mismo origen supera el límite configurado de intentos a `/auth/login` dentro de
  la ventana de tiempo configurada
- **THEN** el sistema rechaza los intentos siguientes de ese origen con `429 Too Many
  Requests`, sin validar email ni contraseña
