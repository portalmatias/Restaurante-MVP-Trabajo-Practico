## 1. Prerrequisitos

- [x] 1.1 Crear `feature/despliegue-continuo-ec2` desde `main` y confirmar que se cumplen los
      hechos de `design.md` (Context): sin Dockerfiles, `next.config.ts` con el rewrite de
      `/api`, `main.ts` con `HOST || '127.0.0.1'` y `configurarRed`, y `prisma` como
      dependencia de producción. Si algo cambió, anotarlo en la descripción del PR.
- [x] 1.2 Confirmar y fijar los tags de las imágenes base (`node:20-alpine` con versión de
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

- [x] 1.4 Cubrir los escenarios modificados de `exposicion-red`:
      - confirmar que los tests unitarios de `configurar-red` ya rechazan `10.0.0.0/7` y
        admiten `10.0.0.0/8`;
      - agregar en `backend/test/exposicion-red.e2e-spec.ts` el caso "Confianza declarada solo
        en el proxy de borde detrás de /api": con `TRUST_PROXY` apuntando a una dirección que
        no es la de la conexión, variar `X-Forwarded-For` no evita el `429`;
      - releer la sección "Red y límites de solicitudes" del README contra el requisito
        "Condición de despliegue documentada" modificado.

      Verificar con `npm run test -w backend` y `npm run test:e2e -w backend`.

## 2. Seed de producción (D8)

- [x] 2.1 Extraer las funciones del catálogo de `backend/prisma/seed.ts` (configuración, zonas,
      mesas y turnos) a `backend/prisma/catalogo.ts`, sin cambiar el comportamiento. Exportar
      las constantes del admin de desarrollo. Verificar que `npm run db:seed -w backend` dos
      veces seguidas deja los mismos conteos, y que los tests de integración siguen en verde.
- [x] 2.2 Escribir los tests de `seed-produccion` contra la base de test (integración):
      - sin `ADMIN_EMAIL` o `ADMIN_PASSWORD`, falla;
      - con una contraseña de 15 caracteres, falla;
      - con la contraseña o el email de desarrollo, falla;
      - con valores válidos, crea el catálogo y el admin, sin reservas;
      - correrlo dos veces no duplica nada;
      - con otra contraseña en la segunda corrida, no cambia el hash del admin existente.

      Verificar que fallan sin la implementación (rojo).
- [x] 2.3 Implementar `backend/prisma/seed-produccion.ts` y verificar que pasan los tests de
      2.2 con `npm run test:integration -w backend`.

## 3. Imágenes de contenedor (D3)

- [x] 3.1 Escribir `.dockerignore` y `backend/Dockerfile` (multi-stage, usuario `node`,
      `HOST=0.0.0.0`, con `dist-seed/seed-produccion.js` compilado y `prisma/`). Verificar que
      `docker build -f backend/Dockerfile .` construye, que `docker run --rm <img> id -u` no da
      `0`, que `docker history --no-trunc` y `docker inspect` no muestran ningún valor de
      `.env`, y que el **sistema de archivos** de la imagen tampoco: exportarlo
      (`docker create` + `docker export`) y verificar que no contiene ningún archivo `.env*` y que
      `grep` no encuentra ninguno de los valores del `.env` local. Repetir la misma verificación
      sobre la imagen del frontend en 3.2.
- [x] 3.2 Agregar `output: "standalone"` a `frontend/next.config.ts` y escribir
      `frontend/Dockerfile` (build-arg `NEXT_PUBLIC_API_URL=http://backend:3001`,
      `HOSTNAME=0.0.0.0`, usuario `node`). Verificar que construye, que `npm run dev` y
      `npm run test -w frontend` siguen funcionando en local, que el usuario no es root, y la
      verificación de secretos de 3.1 (historial, configuración y sistema de archivos).

## 4. Composición de producción (D1, D2, D5, D6)

- [x] 4.1 Escribir `deploy/docker-compose.prod.yml`:
      - redes `borde` e `interna` (`172.30.0.0/24`, frontend en `172.30.0.10`);
      - **solo** `caddy` con `ports: ["80:80", "443:443"]` y el volumen `caddy_data` (D1);
      - las imágenes propias **por digest** (`image@${DIGEST_BACKEND}`), nunca por tag;
      - healthchecks, `restart: unless-stopped`, rotación de logs y `mem_limit` por servicio,
        con los parámetros de memoria de PostgreSQL y Node de D1;
      - `TRUST_PROXY=172.30.0.10` en el backend y `DATABASE_URL` armada con
        `POSTGRES_PASSWORD`.

      Verificar con `docker compose -f deploy/docker-compose.prod.yml config` que ningún otro
      servicio publica puertos.
- [x] 4.2 Escribir `deploy/Caddyfile` con `SITE_ADDRESS`,
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
- [x] 4.3 Probar la IP real del cliente con la composición local: 6 logins fallidos desde el
      host con un `X-Forwarded-For` distinto cada uno → el sexto responde `429`. Después, un
      login desde otro contenedor de la red `borde` (otra IP) → responde `401`, no `429`.
      Guardar la salida para el PR (spec: "Límites de solicitudes por IP real del cliente").

## 5. Despliegue en la instancia y workflow de CD (D4, D7, D10)

- [ ] 5.1 Escribir `deploy/desplegar.sh` según D7:
      - validación de `sha`, digests y `modo`, y `flock`;
      - validación del `.env` (D6): existe, es de `root` con modo `600` o `400`, tiene
        `JWT_SECRET`, `POSTGRES_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `SITE_ADDRESS` con
        su formato, se lee sin ejecutarlo y no se imprime ningún valor; el script nunca
        modifica el `.env`;
      - `SIGHUP` y `SIGPIPE` ignorados y salida duplicada en
        `/var/log/reservas-despliegue.log` (conexión SSH cortada);
      - ruta `/opt/reservas` (el repositorio clonado directo ahí, sin nivel `repo/`);
      - `version_previa` y etapa vigente (`SITE_ADDRESS_VIGENTE`) leídas al inicio; en modo
        `despliegue`, saltear solo un SHA **anterior** al que sirve (no el igual); búsqueda
        en `historial` en modo `vuelta-atras`;
      - comprobación según la etapa (`curl --resolve` en HTTPS), con espera de hasta 300 s en un
        cambio de etapa a un dominio, y vuelta atrás a la versión **y la etapa** previas;
      - reejecución una sola vez cuando el commit nuevo trae otro `desplegar.sh` (solo en modo
        `despliegue`);
      - checkout, escritura de `.despliegue/compose.env` (modo `600`) con las imágenes por
        digest, pull, migraciones, seed, `up` y comprobación;
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
      - una migración rota corta antes del `up`;
      - con el `.env` ausente, con modo `644` o sin `ADMIN_PASSWORD`, termina en error sin
        tocar nada y sin imprimir valores;
      - si se corta la salida estándar a mitad del despliegue (`SIGHUP` y tubería cerrada), el
        despliegue termina igual y el log queda completo.

      Guardar las salidas para el PR.
- [ ] 5.3 Escribir primero los tests y después `deploy/ssh-entrada.sh` (D4), el comando
      forzado de la clave SSH. Los tests lo ejecutan con distintos `SSH_ORIGINAL_COMMAND` y un
      `desplegar.sh` de prueba que solo registra sus argumentos:
      - `<sha> <digest> <digest> despliegue` y `<sha> - - vuelta-atras` válidos invocan a
        `desplegar.sh` con los cuatro argumentos esperados, cada uno por separado (el `-` llega
        como cadena vacía);
      - se rechazan (código `2` y sin invocar nada): comando vacío, `bash`, `ls; id`,
        `$(id) ...`, un SHA de 39 o 41 caracteres o con mayúsculas, un digest sin
        `sha256:` o de otra longitud, un `modo` desconocido, argumentos de más, saltos de línea,
        espacios o tabulaciones extra, y una segunda línea con otro comando;
      - ningún valor del pedido se evalúa en una shell (`eval`, `sh -c`, expansión).

      Verificar que fallan sin la implementación (rojo), que pasan, y `shellcheck` sin
      advertencias. Dejar en el runbook (6.1) la línea de `authorized_keys` y la regla de
      `sudoers`.
- [ ] 5.4 Escribir `.github/workflows/cd.yml` según D4:
      - `workflow_run` con las tres condiciones, más `workflow_dispatch` con los inputs `sha`
        y `modo` validados;
      - job `decidir`, que usa la función de 5.6;
      - en `modo=vuelta-atras`, el job `imagenes` no corre y los dos digests se envían como
        `-`;
      - job `imagenes` con `packages: write`, que no sobrescribe un tag existente y expone los
        digests;
      - job `desplegar` con `environment: produccion` y `contents: read` (sin `id-token`), que
        usa el cliente `ssh` del runner (sin acciones de terceros para la conexión): valida
        `SERVER_PORT`, `SERVER_USER` y `SERVER_HOST`, escribe la clave y `SSH_KNOWN_HOSTS` en un
        directorio temporal con `umask 077` que borra con un `trap`, y se conecta con
        `StrictHostKeyChecking=yes` y `BatchMode=yes`; envía `<sha> <digestBackend|->
        <digestFrontend|-> <modo>`; envuelve `ssh` en `timeout 30m` y no usa `set -x`;
      - si falta alguno de los secrets `SERVER_*` o `SSH_*`, termina en error con un mensaje
        claro, sin afectar al CI;
      - acciones fijadas por SHA y `concurrency` sin cancelar.

      Verificar con `actionlint` sin errores.
- [x] 5.5 Agregar `npm run test:frontend` al job de tests de `ci.yml` (D10). Verificar en el
      PR que el job lo ejecuta y queda en verde (el paso «Tests del frontend» corre y pasa en el
      CI del PR #79, junto con «Tests de las utilidades de scripts/» y «Tests de
      deploy/desplegar.sh»).
- [x] 5.6 Escribir primero los tests y después `scripts/cd/decidir-despliegue.mjs` (D4, D10),
      con un caso por escenario del requisito "Despliegue automático solo desde main con CI en
      verde":
      - "CI en rojo sobre main" (no despliega);
      - "Dos merges seguidos" y "CI viejo que termina después de uno nuevo" (el viejo se omite
        si hay un posterior verde);
      - "Commit posterior con CI en rojo o todavía corriendo" (el verde se despliega);
      - "Despliegue manual de un commit no válido" (fuera de `main`, CI no verde o superado);
      - vuelta atrás manual a un SHA de `main` (se acepta aunque esté superado).

      Verificar que fallan sin la implementación y que pasan con `npm run test:scripts`.
- [x] 5.7 Escribir `.github/workflows/certificado.yml` (D2): ejecución diaria y manual, que
      solo corre si existe la variable `SUBDOMINIO`, y falla si el certificado no es válido para
      ese nombre o le quedan menos de 21 días, y al fallar abre un issue (o comenta el abierto)
      con `permissions: issues: write` (D2). Verificar con `actionlint`, y probar el chequeo
      contra un sitio con certificado válido y contra uno vencido (por ejemplo,
      `expired.badssl.com`).

- [x] 5.8 Escribir `deploy/test/desplegar.test.sh` (D7, D10) con simulacros de `docker`, `curl`,
      `flock`, `sleep` y `stat`: primer despliegue, cambio de etapa fallido con vuelta atrás a la
      etapa previa, redespliegue del mismo SHA con otro `SITE_ADDRESS`, SHA anterior superado,
      reejecución por cambio del script (una sola vez y log sin duplicar). Verificar que las
      pruebas fallan al revertir el atajo «superada» o la vuelta atrás a la etapa.
- [ ] 5.9 CI (D10): `test:scripts` con la lista explícita de archivos de test, incluido
      `scripts/cd/decidir-despliegue.test.mjs` (Node 20 y `cmd.exe` no expanden globs), y un
      paso `npm run test:deploy` en `ci.yml`. Verificar en el PR que ambos corren.
- [ ] 5.10 En `cd.yml` (D3, D4): sin `concurrency` (cola con `flock` en el servidor) y, si el tag
      `:<sha>` ya existe, exigir que la imagen declare `org.opencontainers.image.revision` igual
      al SHA (si no, el job falla). Verificar con un registro local que la lectura de la etiqueta
      funciona.

## 6. Infraestructura y primer despliegue (D9)

- [x] 6.1 Escribir `docs/despliegue.md`:
      - runbook de AWS y del servidor, siguiendo las secciones 1 a 4 de la guía de la docente:
        security group (22, 80 y 443), instancia Ubuntu 24.04 sin rol IAM, Docker y Compose,
        clon directo en `/opt/reservas` (con el punto final), usuario `deploy` fuera del grupo
        `docker`, regla de `sudoers`, `sshd` endurecido, par de claves dedicado (generado en la
        computadora del operador) con la línea de `authorized_keys` (`command=` y `restrict`)
        y `.env` de producción;
      - el environment `produccion` de GitHub con `SERVER_HOST`, `SERVER_USER`, `SERVER_PORT`,
        `SSH_PRIVATE_KEY` y `SSH_KNOWN_HOSTS` (cómo obtener y verificar la huella), y cómo
        borrar la clave privada de la computadora después de copiarla;
      - rotación de la clave de despliegue y revocación ante una filtración;
      - el riesgo aceptado del puerto 22 abierto a internet y sus mitigaciones;
      - cuenta y costos: MFA en root, usuarios IAM con MFA, sin Organizations, alerta de
        Budgets, `t3.micro` con créditos de CPU `standard`, swap, y fecha de vencimiento del
        plan Free (comparada con la entrega del TP) con exportación previa por `pg_dump`;
      - metadatos: instancia sin rol IAM, IMDSv2 obligatorio y límite de saltos 1;
      - security group por etapa: IPs del equipo en la etapa HTTP (y cómo actualizarlas),
        `0.0.0.0/0` en 80 y 443 al activar HTTPS;
      - vuelta atrás manual, rotación de la contraseña del admin y backups (`pg_dump` y `scp`
        con el usuario de administración);
      - activación de HTTPS con el subdominio de la docente (pasarle la IP, esperar el DNS,
        cambiar `SITE_ADDRESS`, verificar) y cómo volver a la IP si el DNS falla (restringiendo
        primero el security group a las IPs del equipo);
      - la sección "Etapa transitoria en HTTP" con el riesgo aceptado;
      - cómo apagar y eliminar los recursos.

      Verificar que cada recurso que usa el workflow o el script figura en el runbook.
- [ ] 6.2 Crear la infraestructura y preparar el servidor siguiendo el runbook:
      - instancia, security group, IP elástica, `swapfile`, Docker, clon en `/opt/reservas`,
        usuario `deploy`, `sudoers`, `sshd`, `.env` y clave SSH;
      - pedirle a la docente un subdominio apuntado a la IP elástica y pasárselo cuando
        exista la instancia;
      - crear el environment `produccion` (solo `main`) con sus secrets y borrar de la
        computadora la clave privada.

      Hacer el primer despliegue con `workflow_dispatch`. Verificar que
      el workflow termina en verde y que `http://<IP-elástica>/` muestra la app. Con la app
      recibiendo uso (un recorrido de reserva completo y el panel de admin), medir con
      `docker stats` y `free -m` el consumo de memoria, ajustar los `mem_limit` si hace falta y
      anotar las mediciones en el PR. Confirmar en la consola que la instancia está en
      `standard` y que la alerta de Budgets existe.
- [ ] 6.3 Verificar desde afuera de AWS la superficie y las credenciales, y guardar las salidas
      (sin IPs ni ARNs que no hagan falta) en el PR:
      - `nc -zv <IP> 5432`, `3000` y `3001` no conectan, y el `22` sí;
      - `ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no` y el ingreso
        como `root` son rechazados;
      - en la etapa HTTP, `curl http://<IP>/` desde una red fuera de las IPs del equipo (por
        ejemplo, datos del celular) no conecta;
      - `aws ec2 describe-instances` muestra `HttpTokens=required`,
        `HttpPutResponseHopLimit=1` y **ningún** perfil IAM asociado, y desde un contenedor
        (`docker compose exec backend`) un `PUT` a `http://169.254.169.254/latest/api/token`
        no obtiene respuesta;
      - login con las credenciales del README → `401`;
      - login con las de producción → `200`;
      - `GET /api/reservas/...` de una reserva de ejemplo → no existe;
      - repetir la prueba de 4.3 contra producción.
- [ ] 6.4 Verificar los límites de la clave de despliegue (con la clave real, desde un equipo
      del equipo, y guardar las salidas sin datos sensibles):
      - `ssh deploy@<IP>` sin comando (shell interactiva) → rechazado;
      - `ssh deploy@<IP> id`, `ssh deploy@<IP> "uno dos"` y un SHA o digest mal formado
        → rechazados sin ejecutar nada;
      - `ssh -L 8080:127.0.0.1:5432 deploy@<IP>` y `ssh -A` → no reenvían nada (`restrict`);
      - `deploy` no puede leer `/opt/reservas/.env`, no puede escribir en `/opt/reservas`, no
        pertenece al grupo `docker` y `sudo -l` solo lista `desplegar.sh`;
      - un workflow de una rama de prueba no obtiene `SSH_PRIVATE_KEY`;
      - con una huella equivocada en `SSH_KNOWN_HOSTS`, el workflow aborta antes de
        autenticarse.

      Revisar los logs de un despliegue y confirmar que no aparece ningún secreto ni la clave.
- [ ] 6.5 Mergear un cambio trivial a `main` y verificar que se despliega solo y que una reserva
      creada antes del despliegue sigue consultable. Reiniciar la instancia y verificar que la
      app vuelve sola con los mismos datos.
- [ ] 6.6 Activar HTTPS cuando la docente confirme el subdominio: pasarle la IP elástica,
      verificar con `dig +short <subdominio>` que resuelve a esa IP, **cambiar `SITE_ADDRESS` en
      `/opt/reservas/.env` y redesplegar primero, y abrir 80 y 443 a `0.0.0.0/0` después**, cuando
      el log lo indique (D7, D9). Verificar:
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

- [ ] 6.7 Hacer públicos los paquetes `reservas-backend` y `reservas-frontend` de GHCR tras la
      primera publicación y reintentar el primer despliegue (D3, runbook «Paquetes en GHCR»).
      Verificar que los despliegues siguientes descargan sin credenciales.

## 7. Documentación y cierre

- [x] 7.1 Actualizar `config.yaml`:
      - §4: `deploy/`, los Dockerfiles y `cd.yml`;
      - §10: `ADMIN_EMAIL` y `ADMIN_PASSWORD` solo para el seed de producción;
      - §12: workflow de CD por SSH (secrets del environment `produccion`).

      Actualizar también `.env.example` y el README (sección "Despliegue" con enlace a
      `docs/despliegue.md`). Verificar que `openspec validate --all --strict` pasa.
- [ ] 7.2 Revisar la Definition of Done (§13), mergear y archivar el change con
      `openspec archive despliegue-continuo-ec2`.
