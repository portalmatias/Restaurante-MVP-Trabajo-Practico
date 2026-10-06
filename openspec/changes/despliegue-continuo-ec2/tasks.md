## 1. Prerrequisitos

- [ ] 1.1 Crear `feature/despliegue-continuo-ec2` desde `main` y confirmar que se cumplen los
      hechos de `design.md` (Context): sin Dockerfiles, `next.config.ts` con el rewrite de
      `/api`, `main.ts` con `HOST || '127.0.0.1'` y `configurarRed`, y `prisma` como
      dependencia de producción. Si algo cambió, anotarlo en la descripción del PR.
- [ ] 1.2 Confirmar y fijar los tags de las imágenes base (`node:20-alpine` con versión de
      parche, `caddy:2.x-alpine`, `postgres:16.4-alpine`). Confirmar en la documentación de
      Caddy de ese tag que `reverse_proxy` ignora los `X-Forwarded-For` entrantes de orígenes no
      confiables (D2). Anotar los tags y el enlace a la documentación en el PR.
- [ ] 1.3 Confirmar el régimen del Tier gratuito de la cuenta de AWS que se va a usar: fecha de
      creación (antes o después del 15 de julio de 2025), plan (Free o pago), saldo de créditos
      y fecha de vencimiento. Estimar con la AWS Pricing Calculator el consumo mensual de
      `t3.micro` + EBS de 20 GB + IPv4 pública + snapshots en la región elegida (D9), y
      verificar que entra en los créditos o en los límites gratuitos hasta el fin de la
      cursada. Anotar el resultado, sin datos de la cuenta, en el PR. Si no entra, frenar y
      decidirlo con el equipo antes de seguir.

## 2. Seed de producción (D8)

- [ ] 2.1 Extraer las funciones del catálogo de `backend/prisma/seed.ts` (configuración, zonas,
      mesas y turnos) a `backend/prisma/catalogo.ts`, sin cambiar el comportamiento. Exportar
      las constantes del admin de desarrollo. Verificar que `npm run db:seed -w backend` dos
      veces seguidas deja los mismos conteos, y que los tests de integración siguen en verde.
- [ ] 2.2 Escribir los tests de `seed-produccion` contra la base de test (integración):
      - sin `ADMIN_EMAIL` o `ADMIN_PASSWORD`, falla;
      - con una contraseña de 15 caracteres, falla;
      - con la contraseña o el email de desarrollo, falla;
      - con valores válidos, crea el catálogo y el admin, sin reservas;
      - correrlo dos veces no duplica nada;
      - con otra contraseña en la segunda corrida, no cambia el hash del admin existente.

      Verificar que fallan sin la implementación (rojo).
- [ ] 2.3 Implementar `backend/prisma/seed-produccion.ts` y verificar que pasan los tests de
      2.2 con `npm run test:integration -w backend`.

## 3. Imágenes de contenedor (D3)

- [ ] 3.1 Escribir `.dockerignore` y `backend/Dockerfile` (multi-stage, usuario `node`,
      `HOST=0.0.0.0`, con `dist-seed/seed-produccion.js` compilado y `prisma/`). Verificar que
      `docker build -f backend/Dockerfile .` construye, que `docker run --rm <img> id -u` no da
      `0` y que `docker history --no-trunc` y `docker inspect` no muestran ningún valor de
      `.env`.
- [ ] 3.2 Agregar `output: "standalone"` a `frontend/next.config.ts` y escribir
      `frontend/Dockerfile` (build-arg `NEXT_PUBLIC_API_URL=http://backend:3001`,
      `HOSTNAME=0.0.0.0`, usuario `node`). Verificar que construye, que `npm run dev` y
      `npm run test -w frontend` siguen funcionando en local, y que el usuario no es root.

## 4. Composición de producción (D1, D2, D5, D6)

- [ ] 4.1 Escribir `deploy/docker-compose.prod.yml`:
      - redes `borde` e `interna` (`172.30.0.0/24`, frontend en `172.30.0.10`);
      - **solo** `caddy` con `ports: ["80:80"]`;
      - healthchecks, `restart: unless-stopped`, rotación de logs y `mem_limit` por servicio,
        con los parámetros de memoria de PostgreSQL y Node de D1;
      - `TRUST_PROXY=172.30.0.10` en el backend y `DATABASE_URL` armada con
        `POSTGRES_PASSWORD`.

      Verificar con `docker compose -f deploy/docker-compose.prod.yml config` que ningún otro
      servicio publica puertos.
- [ ] 4.2 Escribir `deploy/Caddyfile` con `SITE_ADDRESS`, `reverse_proxy frontend:3000` y los
      encabezados de D2 (incluido quitar `Server` y `X-Powered-By`). Verificar localmente,
      levantando la composición con imágenes locales y un `.env` de prueba:
      - `curl -I http://127.0.0.1/` muestra los encabezados esperados y no muestra `Server` ni
        `X-Powered-By`;
      - `curl http://127.0.0.1/api/zonas` responde `200`.
- [ ] 4.3 Probar la IP real del cliente con la composición local: 6 logins fallidos desde el
      host con un `X-Forwarded-For` distinto cada uno → el sexto responde `429`. Después, un
      login desde otro contenedor de la red `borde` (otra IP) → responde `401`, no `429`.
      Guardar la salida para el PR (spec: "Límites de solicitudes por IP real del cliente").

## 5. Despliegue en la instancia y workflow de CD (D4, D7, D10)

- [ ] 5.1 Escribir `deploy/desplegar.sh` según D7:
      - validación del SHA y `flock`;
      - checkout, generación de `.env` con modo `600`, pull, migraciones, seed, `up` y
        comprobación;
      - vuelta atrás y `prune`.

      Verificar con `shellcheck` sin advertencias. Verificar también que con un SHA inválido
      (`abc`, 39 caracteres o mayúsculas) termina en error sin tocar nada.
- [ ] 5.2 Probar `desplegar.sh` contra una máquina local o una VM con Docker, apuntando a un
      remoto de prueba:
      - un SHA sano termina en 0 y escribe `VERSION_ACTUAL`;
      - una imagen que no responde (por ejemplo, el frontend con un comando que sale
        enseguida) dispara la vuelta atrás y termina en 1, con la versión anterior
        respondiendo;
      - una migración rota corta antes del `up`.

      Guardar las salidas para el PR.
- [ ] 5.3 Escribir `deploy/ssm-desplegar.json` (documento SSM con `sha` y
      `allowedPattern: ^[0-9a-f]{40}$`). Verificar que es JSON válido y que el comando que
      ejecuta es solo `desplegar.sh` con el parámetro.
- [ ] 5.4 Escribir `.github/workflows/cd.yml` según D4:
      - `workflow_run` con las tres condiciones, más `workflow_dispatch` con el input `sha`
        validado;
      - job `imagenes` con `packages: write` y job `desplegar` con `environment: produccion`
        e `id-token: write`;
      - acciones fijadas por SHA y `concurrency` sin cancelar.

      Verificar con `actionlint` sin errores.
- [ ] 5.5 Agregar `npm run test:frontend` al job de tests de `ci.yml` (D10). Verificar en el
      PR que el job lo ejecuta y queda en verde.

## 6. Infraestructura y primer despliegue (D9)

- [ ] 6.1 Escribir `docs/despliegue.md`:
      - runbook de AWS con las políticas JSON completas (confianza OIDC, rol de GitHub y perfil
        de la instancia), el security group y los parámetros de SSM;
      - cuenta y costos: MFA en root, usuarios IAM con MFA, sin Organizations, alerta de
        Budgets, `t3.micro` con créditos de CPU `standard`, swap, y fecha de vencimiento del
        plan Free con exportación previa por `pg_dump`;
      - vuelta atrás manual, rotación de la contraseña del admin y backups;
      - paso a HTTPS;
      - la sección "Riesgo aceptado: HTTP sin cifrar";
      - cómo apagar y eliminar los recursos.

      Verificar que cada recurso que usa el workflow o el script figura en el runbook.
- [ ] 6.2 Crear la infraestructura siguiendo el runbook, el environment `produccion` (solo
      `main`) y sus variables. Hacer el primer despliegue con `workflow_dispatch`. Verificar que
      el workflow termina en verde y que `http://<IP-elástica>/` muestra la app. Con la app
      recibiendo uso (un recorrido de reserva completo y el panel de admin), medir con
      `docker stats` y `free -m` el consumo de memoria, ajustar los `mem_limit` si hace falta y
      anotar las mediciones en el PR. Confirmar en la consola que la instancia está en
      `standard` y que la alerta de Budgets existe.
- [ ] 6.3 Verificar desde afuera de AWS la superficie y las credenciales, y guardar las salidas
      (sin IPs ni ARNs que no hagan falta) en el PR:
      - `nc -zv <IP> 22`, `5432`, `3000` y `3001` no conectan;
      - login con las credenciales del README → `401`;
      - login con las de producción → `200`;
      - `GET /api/reservas/...` de una reserva de ejemplo → no existe;
      - repetir la prueba de 4.3 contra producción.
- [ ] 6.4 Verificar los límites del rol de GitHub con sus credenciales (por ejemplo, con un job
      temporal en una rama de prueba o asumiendo el rol desde la consola):
      - `ssm send-command` con `AWS-RunShellScript` → `AccessDenied`;
      - `ssm get-parameter /reservas/prod/JWT_SECRET` → `AccessDenied`;
      - un workflow desde otra rama no obtiene credenciales.

      Revisar los logs de un despliegue y confirmar que no aparece ningún secreto.
- [ ] 6.5 Mergear un cambio trivial a `main` y verificar que se despliega solo y que una reserva
      creada antes del despliegue sigue consultable. Reiniciar la instancia y verificar que la
      app vuelve sola con los mismos datos.

## 7. Documentación y cierre

- [ ] 7.1 Actualizar `config.yaml`:
      - §2: excepción de AWS como infraestructura de despliegue, a propuesta de la docente y
        dentro del Tier gratuito;
      - §4: `deploy/`, los Dockerfiles y `cd.yml`;
      - §10: `ADMIN_EMAIL` y `ADMIN_PASSWORD` solo para el seed de producción;
      - §12: workflow de CD.

      Actualizar también `.env.example` y el README (sección "Despliegue" con enlace a
      `docs/despliegue.md`). Verificar que `openspec validate --all --strict` pasa.
- [ ] 7.2 Revisar la Definition of Done (§13), mergear y archivar el change con
      `openspec archive despliegue-continuo-ec2`.
