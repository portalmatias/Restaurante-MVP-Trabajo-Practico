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
      creación, plan (Free o pago), saldo de créditos y fecha de vencimiento del plan, y
      **compararla con la fecha de entrega del TP**. Estimar con la AWS Pricing Calculator el consumo mensual de
      `t3.micro` + EBS de 20 GB + IPv4 pública + snapshots en la región elegida (D9), y
      verificar que entra en los créditos o en los límites gratuitos hasta el fin de la
      cursada. Anotar el resultado, sin datos de la cuenta, en el PR. Si no entra, frenar y
      decidirlo con el equipo antes de seguir.

- [ ] 1.4 Cubrir los escenarios modificados de `exposicion-red`:
      - confirmar que los tests unitarios de `configurar-red` ya rechazan `10.0.0.0/7` y
        admiten `10.0.0.0/8`;
      - agregar en `backend/test/exposicion-red.e2e-spec.ts` el caso "Confianza declarada solo
        en el proxy de borde detrás de /api": con `TRUST_PROXY` apuntando a una dirección que
        no es la de la conexión, variar `X-Forwarded-For` no evita el `429`;
      - releer la sección "Red y límites de solicitudes" del README contra el requisito
        "Condición de despliegue documentada" modificado.

      Verificar con `npm run test -w backend` y `npm run test:e2e -w backend`.

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
      `0`, que `docker history --no-trunc` y `docker inspect` no muestran ningún valor de
      `.env`, y que el **sistema de archivos** de la imagen tampoco: exportarlo
      (`docker create` + `docker export`) y verificar que no contiene ningún archivo `.env*` y que
      `grep` no encuentra ninguno de los valores del `.env` local. Repetir la misma verificación
      sobre la imagen del frontend en 3.2.
- [ ] 3.2 Agregar `output: "standalone"` a `frontend/next.config.ts` y escribir
      `frontend/Dockerfile` (build-arg `NEXT_PUBLIC_API_URL=http://backend:3001`,
      `HOSTNAME=0.0.0.0`, usuario `node`). Verificar que construye, que `npm run dev` y
      `npm run test -w frontend` siguen funcionando en local, que el usuario no es root, y la
      verificación de secretos de 3.1 (historial, configuración y sistema de archivos).

## 4. Composición de producción (D1, D2, D5, D6)

- [ ] 4.1 Escribir `deploy/docker-compose.prod.yml`:
      - redes `borde` e `interna` (`172.30.0.0/24`, frontend en `172.30.0.10`);
      - **solo** `caddy` con `ports: ["80:80", "443:443"]` y el volumen `caddy_data` (D1);
      - las imágenes propias **por digest** (`image@${DIGEST_BACKEND}`), nunca por tag;
      - healthchecks, `restart: unless-stopped`, rotación de logs y `mem_limit` por servicio,
        con los parámetros de memoria de PostgreSQL y Node de D1;
      - `TRUST_PROXY=172.30.0.10` en el backend y `DATABASE_URL` armada con
        `POSTGRES_PASSWORD`.

      Verificar con `docker compose -f deploy/docker-compose.prod.yml config` que ningún otro
      servicio publica puertos.
- [ ] 4.2 Escribir `deploy/Caddyfile` con `SITE_ADDRESS`,
      `reverse_proxy frontend:3000`, los encabezados de D2 (incluido quitar `Server` y
      `X-Powered-By`) y HSTS solo en la etapa HTTPS. Verificar localmente, levantando la
      composición con imágenes locales y un `.env` de prueba con `SITE_ADDRESS=:80`:
      - `curl -I http://127.0.0.1/` muestra los encabezados esperados y no muestra `Server` ni
        `X-Powered-By`;
      - `curl http://127.0.0.1/api/zonas` responde `200`;
      - en la etapa HTTP no se envía `Strict-Transport-Security`.

      Para la etapa HTTPS, verificar con `caddy adapt` que con `SITE_ADDRESS=ejemplo.test` la
      configuración incluye la redirección de HTTP a HTTPS y el encabezado HSTS (la emisión real
      del certificado se prueba en 6.6).
- [ ] 4.3 Probar la IP real del cliente con la composición local: 6 logins fallidos desde el
      host con un `X-Forwarded-For` distinto cada uno → el sexto responde `429`. Después, un
      login desde otro contenedor de la red `borde` (otra IP) → responde `401`, no `429`.
      Guardar la salida para el PR (spec: "Límites de solicitudes por IP real del cliente").

## 5. Despliegue en la instancia y workflow de CD (D4, D7, D10)

- [ ] 5.1 Escribir `deploy/desplegar.sh` según D7:
      - validación de `sha`, digests y `modo`, y `flock`;
      - `version_previa` leída al inicio, chequeo de ancestro en modo `despliegue` y búsqueda
        en `historial` en modo `vuelta-atras`;
      - checkout, generación de `.env` con modo `600` e imágenes por digest, pull,
        migraciones, seed, `up` y comprobación;
      - vuelta atrás a `version_previa`, registro en `VERSION_ACTUAL` e `historial`, y
        limpieza explícita de imágenes (no `docker image prune` solo).

      Verificar con `shellcheck` sin advertencias. Verificar también que termina en error sin
      tocar nada con un SHA inválido (`abc`, 39 caracteres o mayúsculas), con un digest
      inválido y con un `modo` desconocido.
- [ ] 5.2 Probar `desplegar.sh` contra una máquina local o una VM con Docker, apuntando a un
      remoto de prueba:
      - un SHA sano termina en 0, escribe `VERSION_ACTUAL` y lo agrega a `historial`;
      - con dos versiones ya desplegadas (A y después B), una versión C que no responde
        vuelve a **B** (la que estaba sirviendo), no a A, y termina en 1;
      - en modo `despliegue`, un SHA ancestro de la versión actual termina en 0 sin cambiar
        nada;
      - en modo `vuelta-atras`, un SHA que está en `historial` vuelve con sus digests
        registrados, aunque el tag se haya vuelto a publicar con otra imagen; uno que no está
        en `historial` se rechaza;
      - después de tres despliegues, solo quedan en disco las imágenes de la versión actual y
        de la anterior;
      - una migración rota corta antes del `up`.

      Guardar las salidas para el PR.
- [ ] 5.3 Escribir `deploy/ssm-desplegar.json` (documento SSM con `sha`, `digestBackend`,
      `digestFrontend` y `modo`, cada uno con su `allowedPattern` o `allowedValues` de D4).
      Verificar que es JSON válido y que el comando que ejecuta es solo `desplegar.sh` con esos
      parámetros.
- [ ] 5.4 Escribir `.github/workflows/cd.yml` según D4:
      - `workflow_run` con las tres condiciones, más `workflow_dispatch` con los inputs `sha`
        y `modo` validados;
      - job `decidir`, que usa la función de 5.6;
      - en `modo=vuelta-atras`, el job `imagenes` no corre y se envían `sha` y `modo` con los
        digests vacíos;
      - job `imagenes` con `packages: write`, que no sobrescribe un tag existente y expone los
        digests; job `desplegar` con `environment: produccion` e `id-token: write`;
      - acciones fijadas por SHA y `concurrency` sin cancelar.

      Verificar con `actionlint` sin errores.
- [ ] 5.5 Agregar `npm run test:frontend` al job de tests de `ci.yml` (D10). Verificar en el
      PR que el job lo ejecuta y queda en verde.
- [ ] 5.6 Escribir primero los tests y después `scripts/cd/decidir-despliegue.mjs` (D4, D10),
      con un caso por escenario del requisito "Despliegue automático solo desde main con CI en
      verde":
      - "CI en rojo sobre main" (no despliega);
      - "Dos merges seguidos" y "CI viejo que termina después de uno nuevo" (el viejo se omite
        si hay un posterior verde);
      - "Commit posterior con CI en rojo o todavía corriendo" (el verde se despliega);
      - "Despliegue manual de un commit no válido" (fuera de `main`, CI no verde o superado);
      - vuelta atrás manual a un SHA de `main` (se acepta aunque esté superado).

      Verificar que fallan sin la implementación y que pasan con `npm run test:scripts`.
- [ ] 5.7 Escribir `.github/workflows/certificado.yml` (D2): ejecución diaria y manual, que
      solo corre si existe la variable `SUBDOMINIO`, y falla si el certificado no es válido para
      ese nombre o le quedan menos de 21 días. Verificar con `actionlint`, y probar el chequeo
      contra un sitio con certificado válido y contra uno vencido (por ejemplo,
      `expired.badssl.com`).

## 6. Infraestructura y primer despliegue (D9)

- [ ] 6.1 Escribir `docs/despliegue.md`:
      - runbook de AWS con las políticas JSON completas (confianza OIDC, rol de GitHub y perfil
        de la instancia), el security group y los parámetros de SSM;
      - cuenta y costos: MFA en root, usuarios IAM con MFA, sin Organizations, alerta de
        Budgets, `t3.micro` con créditos de CPU `standard`, swap, y fecha de vencimiento del
        plan Free (comparada con la entrega del TP) con exportación previa por `pg_dump`;
      - metadatos: IMDSv2 obligatorio y límite de saltos 1;
      - security group por etapa: IPs del equipo en la etapa HTTP (y cómo actualizarlas),
        `0.0.0.0/0` en 80 y 443 al activar HTTPS;
      - vuelta atrás manual, rotación de la contraseña del admin y backups;
      - activación de HTTPS con el subdominio de la docente (pasarle la IP, esperar el DNS,
        cambiar `SITE_ADDRESS`, verificar) y cómo volver a la IP si el DNS falla (restringiendo
        primero el security group a las IPs del equipo);
      - la sección "Etapa transitoria en HTTP" con el riesgo aceptado;
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
      - en la etapa HTTP, `curl http://<IP>/` desde una red fuera de las IPs del equipo (por
        ejemplo, datos del celular) no conecta;
      - `aws ec2 describe-instances` muestra `HttpTokens=required` y
        `HttpPutResponseHopLimit=1`, y desde un contenedor
        (`docker compose exec backend`) un `PUT` a `http://169.254.169.254/latest/api/token`
        no obtiene respuesta;
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
- [ ] 6.6 Activar HTTPS cuando la docente confirme el subdominio: pasarle la IP elástica,
      verificar con `dig +short <subdominio>` que resuelve a esa IP, cambiar
      `/reservas/prod/config/SITE_ADDRESS` y redesplegar. Verificar:
      - `curl -I https://<subdominio>/` responde `200` con un certificado válido (sin `-k`) y
        con `Strict-Transport-Security`;
      - `curl -I http://<subdominio>/reservas` responde con una redirección permanente a
        HTTPS;
      - después de redesplegar y de reiniciar la instancia, Caddy reutiliza el certificado (los
        logs no muestran una emisión nueva);
      - se rota la contraseña del admin (runbook), porque pudo haber viajado en claro en la
        etapa HTTP;
      - se crea la variable `SUBDOMINIO` y una ejecución manual de `certificado.yml` termina en
        verde.

      Actualizar la documentación para indicar que producción ya está en la etapa HTTPS.

## 7. Documentación y cierre

- [ ] 7.1 Actualizar `config.yaml`:
      - §4: `deploy/`, los Dockerfiles y `cd.yml`;
      - §10: `ADMIN_EMAIL` y `ADMIN_PASSWORD` solo para el seed de producción;
      - §12: workflow de CD.

      Actualizar también `.env.example` y el README (sección "Despliegue" con enlace a
      `docs/despliegue.md`). Verificar que `openspec validate --all --strict` pasa.
- [ ] 7.2 Revisar la Definition of Done (§13), mergear y archivar el change con
      `openspec archive despliegue-continuo-ec2`.
