#!/usr/bin/env bash
#
# Procedimiento de despliegue en la instancia de producción (D7 de
# openspec/changes/despliegue-continuo-ec2/design.md).
#
# Lo ejecuta como root deploy/ssh-entrada.sh (mediante `sudo`), que es el comando forzado de la
# clave SSH del workflow de CD y le pasa los cuatro argumentos ya validados:
#
#   desplegar.sh <sha> <digestBackend> <digestFrontend> <modo>
#
#   sha             SHA completo del commit de main (40 caracteres hexadecimales en minúscula).
#   digestBackend   digest de la imagen del backend  (sha256:<64 hex>, o vacío: ssh-entrada.sh
#                   traduce el marcador `-` que manda el workflow a una cadena vacía).
#   digestFrontend  digest de la imagen del frontend (sha256:<64 hex>, o vacío).
#   modo            `despliegue` o `vuelta-atras`. En `despliegue` los dos digests son
#                   obligatorios. En `vuelta-atras` el workflow los manda vacíos: el SHA tiene
#                   que figurar en el historial y se usan los digests registrados ahí (si
#                   llegara alguno, se ignora).
#
# Códigos de salida: 0 desplegado (o versión ya superada, sin cambios); 1 falló (con vuelta
# atrás si había una versión previa); 2 parámetros inválidos (no se tocó nada).
#
# Archivos en /opt/reservas (el repositorio se clona ahí, directamente):
#   .env                       lo copia a mano quien instala el servidor (docs/despliegue.md):
#                              JWT_SECRET, POSTGRES_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD y
#                              SITE_ADDRESS. Tiene que ser de root y de modo 600 o 400. Este
#                              script solo lo LEE; nunca lo modifica ni lo imprime.
#   .despliegue/compose.env    el que sí genera este script para Compose, por versión: los
#                              secretos de arriba más las imágenes por digest (root, modo 600).
#   .despliegue/VERSION_ACTUAL, historial y desplegar.lock: estado del despliegue.
#
# Seguridad: el script corre SIN `set -x` y nunca imprime los valores del .env. Las
# credenciales del admin no se escriben en ningún archivo propio de este script: solo llegan,
# por entorno, al contenedor del seed.
#
# Todo el cuerpo está dentro de `main`: bash lee los scripts de a partes, y el `git checkout`
# de abajo reemplaza este mismo archivo mientras corre. Con una función, bash ya leyó todo
# antes de ejecutar nada.

set -euo pipefail

# Conexión cortada (D7): si se cae el SSH del runner, sshd manda SIGHUP y cierra la tubería de
# salida. Un despliegue interrumpido entre la migración y el `up` sería peor que uno fallido,
# así que se ignoran SIGHUP y SIGPIPE (las señales ignoradas las heredan los procesos hijos) y
# la salida se copia también a un log propio. `tee --output-error=warn` sigue escribiendo el log
# aunque la salida estándar ya no exista. Si el log no se puede abrir, se sigue sin él.
trap '' HUP PIPE
LOG_DESPLIEGUE="${RESERVAS_LOG:-/var/log/reservas-despliegue.log}"
# Reejecutado por sí mismo (D7) hereda la salida ya duplicada: no se vuelve a abrir.
if [ -z "${RESERVAS_REEJECUTADO:-}" ] && ( umask 077; : >> "$LOG_DESPLIEGUE" ) 2> /dev/null; then
  exec > >(tee --output-error=warn -a "$LOG_DESPLIEGUE") 2>&1
fi

main() {
  # Rutas. RESERVAS_RAIZ, RESERVAS_REGISTRO y RESERVAS_SEGUNDOS_COMPROBACION existen solo para las pruebas locales (deploy/test/desplegar.test.sh, tarea 5.2)
  # (docs/despliegue.md); en la instancia no se definen.
  local RAIZ="${RESERVAS_RAIZ:-/opt/reservas}"
  local REPO="$RAIZ"
  local ENV_FILE="$RAIZ/.env"
  local ESTADO="$RAIZ/.despliegue"
  local ENV_COMPOSE="$ESTADO/compose.env"
  local ARCHIVO_ACTUAL="$ESTADO/VERSION_ACTUAL"
  local ARCHIVO_HISTORIAL="$ESTADO/historial"
  local ARCHIVO_SITE="$ESTADO/SITE_ADDRESS_VIGENTE"
  local COMPOSE_FILE="$REPO/deploy/docker-compose.prod.yml"
  local SEGUNDOS_COMPROBACION="${RESERVAS_SEGUNDOS_COMPROBACION:-90}"

  log() { printf '[desplegar %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
  error() { printf '[desplegar %s] ERROR: %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }

  # ---------------------------------------------------------------------------------------
  # 1. Validación de parámetros (defensa en profundidad: ssh-entrada.sh ya los validó). Antes de tocar
  #    nada, ni siquiera el lock.
  # ---------------------------------------------------------------------------------------
  if [ "$#" -ne 4 ]; then
    error "uso: desplegar.sh <sha> <digestBackend> <digestFrontend> <despliegue|vuelta-atras>"
    return 2
  fi
  local sha="$1" digest_backend="$2" digest_frontend="$3" modo="$4"
  if ! [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    error "SHA inválido: tiene que ser el SHA completo del commit (40 caracteres hexadecimales en minúscula)."
    return 2
  fi
  # Los digests pueden llegar vacíos (en la vuelta atrás no hacen falta), pero si vienen, con
  # el formato exacto.
  if ! [[ "$digest_backend" =~ ^(sha256:[0-9a-f]{64})?$ ]] || ! [[ "$digest_frontend" =~ ^(sha256:[0-9a-f]{64})?$ ]]; then
    error "digest inválido: el formato esperado es sha256:<64 caracteres hexadecimales>."
    return 2
  fi
  if [ "$modo" != "despliegue" ] && [ "$modo" != "vuelta-atras" ]; then
    error "modo inválido: tiene que ser 'despliegue' o 'vuelta-atras'."
    return 2
  fi
  if [ "$modo" = "despliegue" ] && { [ -z "$digest_backend" ] || [ -z "$digest_frontend" ]; }; then
    error "en modo despliegue hacen falta los dos digests (los publica el job imagenes del workflow)."
    return 2
  fi

  # ---------------------------------------------------------------------------------------
  # Lock: segunda barrera contra despliegues simultáneos (la primera es el `concurrency` del
  # workflow).
  # ---------------------------------------------------------------------------------------
  umask 077
  mkdir -p "$ESTADO"
  # Si el script se reejecutó a sí mismo (ver más abajo), hereda el descriptor 9 ya bloqueado:
  # volver a abrir el archivo soltaría el lock un instante.
  if [ -z "${RESERVAS_REEJECUTADO:-}" ]; then
    exec 9> "$ESTADO/desplegar.lock"
    if ! flock -w 900 9; then
      error "hay otro despliegue en curso desde hace más de 15 minutos."
      return 1
    fi
  fi

  # Owner del repositorio en GHCR, deducido del clon público (GHCR usa minúsculas).
  local url_origen owner registro
  url_origen="$(git -C "$REPO" remote get-url origin)"
  owner="$(printf '%s' "$url_origen" | sed -E 's#^.*github\.com[:/]([^/]+)/.*$#\1#' | tr '[:upper:]' '[:lower:]')"
  registro="${RESERVAS_REGISTRO:-ghcr.io/$owner}"
  local imagen_backend="$registro/reservas-backend"
  local imagen_frontend="$registro/reservas-frontend"

  compose() {
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_COMPOSE" "$@"
  }

  # ---------------------------------------------------------------------------------------
  # Variables del servidor (/opt/reservas/.env). Se leen una vez, a variables locales, sin
  # imprimirlas. El archivo NO se ejecuta (no se hace `source`): se interpreta línea por línea,
  # así que un valor con `$(...)` o `;` es solo texto.
  # ---------------------------------------------------------------------------------------
  local p_jwt="" p_postgres="" p_admin_email="" p_admin_password="" p_site=""
  leer_parametros() {
    local dueno modo linea nombre valor
    if [ ! -f "$ENV_FILE" ]; then
      error "no existe $ENV_FILE: copiá el .env de producción al servidor (docs/despliegue.md)."
      return 1
    fi
    # Dueño: quien corre el script (root en la instancia). Modo: solo el dueño lo lee.
    dueno="$(stat -c '%u' "$ENV_FILE")"
    modo="$(stat -c '%a' "$ENV_FILE")"
    if [ "$dueno" != "$(id -u)" ]; then
      error "$ENV_FILE tiene que ser de root (chown root:root)."
      return 1
    fi
    if [ "$modo" != "600" ] && [ "$modo" != "400" ]; then
      error "$ENV_FILE tiene modo $modo: tiene que ser 600 (chmod 600), porque tiene secretos."
      return 1
    fi
    while IFS= read -r linea || [ -n "$linea" ]; do
      linea="${linea%$'\r'}"
      case "$linea" in "" | \#*) continue ;; esac
      [[ "$linea" == *=* ]] || continue
      nombre="${linea%%=*}"
      valor="${linea#*=}"
      # Comillas dobles o simples alrededor del valor completo (como en .env.example).
      if [[ "$valor" =~ ^\"(.*)\"$ ]] || [[ "$valor" =~ ^\'(.*)\'$ ]]; then valor="${BASH_REMATCH[1]}"; fi
      case "$nombre" in
        JWT_SECRET) p_jwt="$valor" ;;
        POSTGRES_PASSWORD) p_postgres="$valor" ;;
        ADMIN_EMAIL) p_admin_email="$valor" ;;
        ADMIN_PASSWORD) p_admin_password="$valor" ;;
        SITE_ADDRESS) p_site="$valor" ;;
      esac
    done < "$ENV_FILE"

    local faltan=()
    [ -n "$p_jwt" ] || faltan+=(JWT_SECRET)
    [ -n "$p_postgres" ] || faltan+=(POSTGRES_PASSWORD)
    [ -n "$p_admin_email" ] || faltan+=(ADMIN_EMAIL)
    [ -n "$p_admin_password" ] || faltan+=(ADMIN_PASSWORD)
    [ -n "$p_site" ] || faltan+=(SITE_ADDRESS)
    if [ "${#faltan[@]}" -gt 0 ]; then
      error "faltan variables en $ENV_FILE (o están vacías): ${faltan[*]}."
      return 1
    fi
    # Formatos: la contraseña de la base va dentro de DATABASE_URL, así que solo admite
    # caracteres que no hay que codificar en una URL.
    if ! [[ "$p_postgres" =~ ^[A-Za-z0-9_-]{24,}$ ]]; then
      error "POSTGRES_PASSWORD tiene que tener 24 caracteres o más, solo letras, números, '_' o '-' (ver docs/despliegue.md)."
      return 1
    fi
    if [ "${#p_jwt}" -lt 32 ] || ! [[ "$p_jwt" =~ ^[A-Za-z0-9_-]+$ ]]; then
      error "JWT_SECRET tiene que tener 32 caracteres o más, solo letras, números, '_' o '-' (ver docs/despliegue.md)."
      return 1
    fi
    if ! [[ "$p_site" =~ ^(:80|[a-z0-9]([a-z0-9.-]*[a-z0-9])?)$ ]]; then
      error "SITE_ADDRESS tiene que ser ':80' o un nombre de dominio en minúsculas."
      return 1
    fi
  }

  # Escribe el env de Compose para una versión: root, modo 600, reemplazo atómico.
  generar_env() {
    local d_back="$1" d_front="$2" site="$3" temporal
    temporal="$(mktemp "$ESTADO/compose.env.XXXXXX")"
    {
      printf 'POSTGRES_PASSWORD=%s\n' "$p_postgres"
      printf 'JWT_SECRET=%s\n' "$p_jwt"
      printf 'SITE_ADDRESS=%s\n' "$site"
      printf 'IMAGEN_BACKEND=%s\n' "$imagen_backend"
      printf 'DIGEST_BACKEND=%s\n' "$d_back"
      printf 'IMAGEN_FRONTEND=%s\n' "$imagen_frontend"
      printf 'DIGEST_FRONTEND=%s\n' "$d_front"
    } > "$temporal"
    chmod 600 "$temporal"
    mv -f "$temporal" "$ENV_COMPOSE"
  }

  # Comprueba la versión a través del proxy de borde: la página principal y una consulta a
  # la API. Recibe la etapa (SITE_ADDRESS) con la que está levantada la versión: en la etapa
  # HTTPS se conecta a 127.0.0.1 con el nombre del sitio (SNI), así que si Caddy no consigue el
  # certificado la comprobación falla y se vuelve a la etapa anterior (D7).
  comprobar() {
    local site="$1" base opciones=(-s -o /dev/null --max-time 10)
    if [ "$site" = ":80" ]; then
      base="http://127.0.0.1"
    else
      base="https://$site"
      opciones+=(--resolve "$site:443:127.0.0.1")
    fi
    local limite=$((SECONDS + SEGUNDOS_COMPROBACION)) codigo_inicio codigo_api tipo_api
    while [ "$SECONDS" -lt "$limite" ]; do
      codigo_inicio="$(curl "${opciones[@]}" -w '%{http_code}' "$base/" || true)"
      read -r codigo_api tipo_api < <(curl "${opciones[@]}" -w '%{http_code} %{content_type}\n' "$base/api/zonas" || true) || true
      if [ "$codigo_inicio" = "200" ] && [ "${codigo_api:-}" = "200" ] && [[ "${tipo_api:-}" == application/json* ]]; then
        log "comprobación OK: / -> 200, /api/zonas -> 200 (JSON)."
        return 0
      fi
      sleep 5
    done
    error "la comprobación no pasó en ${SEGUNDOS_COMPROBACION} s (/ -> ${codigo_inicio:-sin respuesta}, /api/zonas -> ${codigo_api:-sin respuesta})."
    return 1
  }

  # Borra las imágenes propias que no sean de la versión actual ni de la anterior del
  # historial. `docker image prune` no alcanza: las versiones viejas no quedan "colgadas".
  limpiar_imagenes() {
    local conservar=() sha_linea db df sha_actual
    read -r sha_actual db df < "$ARCHIVO_ACTUAL"
    conservar+=("$db" "$df")
    # La versión inmediatamente anterior: la última línea del historial con otro SHA.
    while read -r sha_linea db df; do
      if [ "$sha_linea" != "$sha_actual" ]; then
        conservar+=("$db" "$df")
        break
      fi
    done < <(tac "$ARCHIVO_HISTORIAL")

    local repo digest
    for repo in "$imagen_backend" "$imagen_frontend"; do
      while read -r digest; do
        [ -n "$digest" ] && [ "$digest" != "<none>" ] || continue
        # Comparación con un bucle y no con `grep -q` en una tubería: con pipefail, un SIGPIPE
        # daría "no encontrado" y se borraría una imagen que hay que conservar.
        local se_conserva=false c
        for c in "${conservar[@]}"; do
          [ "$c" = "$digest" ] && se_conserva=true
        done
        if [ "$se_conserva" = false ]; then
          log "borrando imagen vieja $repo@$digest"
          docker image rm "$repo@$digest" > /dev/null || log "no se pudo borrar $repo@$digest (se sigue)."
        fi
      done < <(docker image ls --digests --format '{{.Digest}}' "$repo" | sort -u)
    done
  }

  # Levanta una versión ya preparada (checkout + env de Compose) y la comprueba.
  levantar_y_comprobar() {
    compose up -d --remove-orphans && comprobar "$1"
  }

  # Deja el checkout y el env de Compose como estaban, sin reiniciar contenedores (falla antes del up).
  restaurar_archivos() {
    if [ -n "$sha_previo" ]; then
      git -C "$REPO" checkout -q --detach "$sha_previo"
      generar_env "$db_previo" "$df_previo" "$site_previo"
      log "checkout y env de Compose restaurados a la versión previa ($sha_previo); los contenedores no se tocaron."
    fi
  }

  # ---------------------------------------------------------------------------------------
  # 2. Versión que está sirviendo: a ella se vuelve si algo falla.
  # ---------------------------------------------------------------------------------------
  local sha_previo="" db_previo="" df_previo="" site_previo=""
  if [ -s "$ARCHIVO_ACTUAL" ]; then
    read -r sha_previo db_previo df_previo < "$ARCHIVO_ACTUAL"
  fi
  if [ -s "$ARCHIVO_SITE" ]; then
    read -r site_previo < "$ARCHIVO_SITE"
  fi
  log "versión en servicio: ${sha_previo:-ninguna (primer despliegue)}"

  # ---------------------------------------------------------------------------------------
  # 3. Código del commit y decisión según el modo.
  # ---------------------------------------------------------------------------------------
  log "actualizando el clon ($modo de $sha)..."
  git -C "$REPO" fetch -q origin main
  if ! git -C "$REPO" merge-base --is-ancestor "$sha" origin/main 2> /dev/null; then
    error "el commit $sha no está en la historia de main."
    return 1
  fi

  if [ "$modo" = "despliegue" ]; then
    # El atajo vale solo para un commit ANTERIOR al que está sirviendo. Redesplegar el mismo SHA
    # sigue de largo: es la forma de aplicar un cambio del .env (por ejemplo SITE_ADDRESS al
    # pasar de HTTP a HTTPS), y `--is-ancestor` también da verdadero para un SHA igual.
    if [ -n "$sha_previo" ] && [ "$sha" != "$sha_previo" ] && git -C "$REPO" merge-base --is-ancestor "$sha" "$sha_previo"; then
      log "versión superada: $sha ya está contenido en la versión en servicio ($sha_previo). No se cambia nada."
      return 0
    fi
    if [ "$sha" = "$sha_previo" ]; then
      log "redespliegue de la versión en servicio: se regenera el entorno de Compose y se recrean los contenedores que hayan cambiado."
    fi
  else
    local registrada=""
    if [ -f "$ARCHIVO_HISTORIAL" ]; then
      registrada="$(awk -v s="$sha" '$1 == s { linea = $0 } END { print linea }' "$ARCHIVO_HISTORIAL")"
    fi
    if [ -z "$registrada" ]; then
      error "vuelta atrás rechazada: $sha no figura entre las versiones desplegadas con éxito."
      return 1
    fi
    read -r _ digest_backend digest_frontend <<< "$registrada"
    log "vuelta atrás pedida: se usan los digests registrados en el historial para $sha."
  fi

  leer_parametros
  # Sin registro de etapa (instalación anterior a este archivo), la vigente es la del .env.
  [ -n "$site_previo" ] || site_previo="$p_site"
  if [ "$p_site" != "$site_previo" ]; then
    log "cambio de etapa: $site_previo -> $p_site"
  fi

  # El script en ejecución es el del commit anterior: un cambio a `desplegar.sh` llegaría un
  # despliegue tarde. Si el commit nuevo trae otra versión del script, se continúa con ella
  # (D7). Solo en modo despliegue: una vuelta atrás no debe correr el script de una versión
  # vieja. El lock (descriptor 9) pasa heredado al proceso nuevo.
  local script_en_uso="" script_nuevo=""
  if [ "$modo" = "despliegue" ] && [ -z "${RESERVAS_REEJECUTADO:-}" ]; then
    script_en_uso="$(git -C "$REPO" hash-object "$REPO/deploy/desplegar.sh")"
    script_nuevo="$(git -C "$REPO" rev-parse "$sha:deploy/desplegar.sh" 2> /dev/null || true)"
  fi
  git -C "$REPO" checkout -q --detach "$sha"
  if [ -n "$script_nuevo" ] && [ "$script_nuevo" != "$script_en_uso" ]; then
    log "desplegar.sh cambió en $sha: se continúa con la versión nueva del script."
    RESERVAS_REEJECUTADO=1 exec "$REPO/deploy/desplegar.sh" "$sha" "$digest_backend" "$digest_frontend" "$modo"
  fi

  # 4 y 5. Env de Compose de la versión nueva e imágenes por digest.
  generar_env "$digest_backend" "$digest_frontend" "$p_site"
  log "descargando imágenes..."
  if ! compose pull -q; then
    error "no se pudieron descargar las imágenes de $sha. Si es el primer despliegue, comprobá que los paquetes de GHCR sean públicos (docs/despliegue.md, 'Paquetes en GHCR')."
    restaurar_archivos
    return 1
  fi

  # 6. Base de datos arriba antes de migrar.
  if ! compose up -d --wait postgres; then
    error "la base de datos no quedó sana."
    restaurar_archivos
    return 1
  fi

  # 7. Migraciones. Si fallan, la versión nueva no se levanta y la anterior sigue atendiendo.
  log "aplicando migraciones..."
  if ! compose run --rm -T backend prisma migrate deploy; then
    error "falló una migración: no se levanta la versión nueva."
    restaurar_archivos
    return 1
  fi

  # 8. Datos iniciales. Las credenciales del admin pasan solo por el entorno del proceso.
  log "cargando datos iniciales de producción..."
  if ! ADMIN_EMAIL="$p_admin_email" ADMIN_PASSWORD="$p_admin_password" \
    compose run --rm -T -e ADMIN_EMAIL -e ADMIN_PASSWORD backend node dist-seed/seed-produccion.js; then
    error "falló la carga de datos iniciales: no se levanta la versión nueva."
    restaurar_archivos
    return 1
  fi

  # 9 y 10. Versión nueva arriba y comprobación a través del proxy de borde.
  log "levantando la versión $sha..."
  if levantar_y_comprobar "$p_site"; then
    # 11. Registro y limpieza. La etapa vigente se guarda aparte: es a la que vuelve una vuelta
    # atrás si un cambio de etapa falla.
    local linea_version="$sha $digest_backend $digest_frontend"
    printf '%s\n' "$linea_version" > "$ARCHIVO_ACTUAL.tmp"
    mv -f "$ARCHIVO_ACTUAL.tmp" "$ARCHIVO_ACTUAL"
    printf '%s\n' "$p_site" > "$ARCHIVO_SITE.tmp"
    mv -f "$ARCHIVO_SITE.tmp" "$ARCHIVO_SITE"
    if [ ! -f "$ARCHIVO_HISTORIAL" ] || [ "$(tail -n 1 "$ARCHIVO_HISTORIAL")" != "$linea_version" ]; then
      printf '%s\n' "$linea_version" >> "$ARCHIVO_HISTORIAL"
    fi
    limpiar_imagenes
    log "DESPLEGADO $sha"
    return 0
  fi

  # 12. Falló la comprobación: volver a la versión que estaba sirviendo.
  if [ -z "$sha_previo" ]; then
    error "primer despliegue fallido y sin versión previa a la que volver: se detienen los contenedores."
    compose stop || true
    return 1
  fi
  error "la versión $sha no responde: VUELTA ATRÁS a $sha_previo (etapa $site_previo)"
  git -C "$REPO" checkout -q --detach "$sha_previo"
  generar_env "$db_previo" "$df_previo" "$site_previo"
  if levantar_y_comprobar "$site_previo"; then
    log "VUELTA ATRÁS a $sha_previo completada, con la etapa $site_previo; la versión en servicio no cambió."
  else
    error "VUELTA ATRÁS a $sha_previo: la versión previa tampoco responde. Revisar a mano (docs/despliegue.md)."
  fi
  return 1
}

main "$@"; exit $?
