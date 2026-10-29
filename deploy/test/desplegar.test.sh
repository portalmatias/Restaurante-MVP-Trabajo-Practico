#!/usr/bin/env bash
#
# Pruebas locales de deploy/desplegar.sh (tarea 5.2 de despliegue-continuo-ec2).
#
# Corren sin Docker, sin red y sin root: arman un repositorio Git temporal (un remoto y un clon
# que hace de /opt/reservas) y ponen delante en el PATH versiones simuladas de `docker`, `curl`,
# `flock`, `sleep` y `stat`. Lo que se comprueba es la lógica del script (decisiones, estado,
# etapa HTTP/HTTPS, vuelta atrás, reejecución, limpieza de imágenes, migración rota, `.env`
# inválido y conexión cortada), no Docker ni Caddy.
#
# Uso:  bash deploy/test/desplegar.test.sh
# Sale con 0 si pasó todo y con 1 si falló alguna comprobación.

set -u

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_REAL="$AQUI/../desplegar.sh"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT

PASO=0
FALLO=0
ok() { PASO=$((PASO + 1)); printf '  ok   %s\n' "$1"; }
mal() { FALLO=$((FALLO + 1)); printf '  FALLA %s\n' "$1"; [ -z "${2:-}" ] || printf '%s\n' "$2" | sed 's/^/        | /'; }
verificar() { # verificar "descripción" comando...
  local desc="$1"
  shift
  if "$@" > /dev/null 2>&1; then ok "$desc"; else mal "$desc"; fi
}
contiene() { grep -q -- "$2" "$1"; }
no_contiene() { ! grep -q -- "$2" "$1"; }

# --- Simulacros ------------------------------------------------------------------------------
BIN="$T/bin"
mkdir -p "$BIN"
cat > "$BIN/docker" <<'EOF'
#!/usr/bin/env bash
# Registra la llamada. En `up -d` guarda una copia del env de Compose.
echo "docker $*" >> "$FAKE_DIR/docker.log"
case " $* " in
  *" --env-file "*)
    previo=""
    for a in "$@"; do
      [ "$previo" = "--env-file" ] && envf="$a"
      previo="$a"
    done
    case " $* " in
      *" up "*) n=$(($(ls "$FAKE_DIR"/up-*.env 2> /dev/null | wc -l) + 1)); cp "$envf" "$FAKE_DIR/up-$n.env" ;;
    esac
    ;;
esac
# Imágenes en disco: un archivo por repositorio (`imagenes-reservas-backend`, ...), un digest
# por línea. `image ls` las lista y `image rm` las borra del archivo.
case "$1 $2" in
  "image ls")
    repo="${*: -1}"
    cat "$FAKE_DIR/imagenes-${repo##*/}" 2> /dev/null
    exit 0
    ;;
  "image rm")
    ref="$3"
    archivo="$FAKE_DIR/imagenes-$(basename "${ref%@*}")"
    [ -f "$archivo" ] && grep -vx -- "${ref#*@}" "$archivo" > "$archivo.tmp"; mv -f "$archivo.tmp" "$archivo" 2> /dev/null
    exit 0
    ;;
esac
# FAKE_DOCKER_FALLA: un texto; si aparece en los argumentos, la llamada falla (por ejemplo, una
# migración rota). FAKE_DOCKER_HUP: idem, pero le manda SIGHUP a desplegar.sh, como sshd cuando
# se corta la conexión del runner.
if [ -n "${FAKE_DOCKER_HUP:-}" ] && [[ " $* " == *"$FAKE_DOCKER_HUP"* ]]; then
  kill -HUP "$PPID"
fi
if [ -n "${FAKE_DOCKER_FALLA:-}" ] && [[ " $* " == *"$FAKE_DOCKER_FALLA"* ]]; then
  exit 1
fi
exit "${FAKE_DOCKER_SALIDA:-0}"
EOF
cat > "$BIN/curl" <<'EOF'
#!/usr/bin/env bash
# Simula la comprobación: registra la URL y los --resolve, y responde 200 salvo que se pida fallar.
formato=""
url=""
previo=""
for a in "$@"; do
  [ "$previo" = "-w" ] && formato="$a"
  [ "$previo" = "--resolve" ] && echo "resolve $a" >> "$FAKE_DIR/curl.log"
  case "$a" in http://* | https://*) url="$a" ;; esac
  previo="$a"
done
echo "url $url" >> "$FAKE_DIR/curl.log"
if [ "${FAKE_CURL_FALLA_HTTPS:-}" = "1" ] && [[ "$url" == https://* ]]; then
  printf '000'; [[ "$formato" == *content_type* ]] && printf ' \n'
  exit 35
fi
# FAKE_DIGEST_ROTO: la versión levantada con ese digest del backend no responde.
if [ -n "${FAKE_DIGEST_ROTO:-}" ] && grep -qx "DIGEST_BACKEND=$FAKE_DIGEST_ROTO" "$FAKE_ENV_COMPOSE" 2> /dev/null; then
  printf '000'; [[ "$formato" == *content_type* ]] && printf ' \n'
  exit 7
fi
if [[ "$formato" == *content_type* ]]; then printf '200 application/json\n'; else printf '200'; fi
EOF
printf '#!/usr/bin/env bash\nexit 0\n' > "$BIN/flock"
printf '#!/usr/bin/env bash\nexit 0\n' > "$BIN/sleep"
cat > "$BIN/stat" <<'EOF'
#!/usr/bin/env bash
# El .env de prueba hace de archivo de root con modo 600 (chmod no se refleja en todos los
# sistemas). FAKE_ENV_MODO simula otro modo.
for a in "$@"; do
  case "$a" in
    */.env) case " $* " in *" %u "* | *"'%u'"*) id -u ;; *) echo "${FAKE_ENV_MODO:-600}" ;; esac; exit 0 ;;
  esac
done
exec "$REAL_STAT" "$@"
EOF
chmod +x "$BIN"/*
REAL_STAT="$(command -v stat)"
export REAL_STAT FAKE_DIR="$T/fake"
mkdir -p "$FAKE_DIR"

# --- Repositorio de prueba -----------------------------------------------------------------------
git_t() { git -c user.name=prueba -c user.email=prueba@example.com -c commit.gpgsign=false "$@"; }
git init -q --bare -b main "$T/origen.git"
git init -q -b main "$T/trabajo"
(
  cd "$T/trabajo" || exit 1
  mkdir -p deploy
  cp "$SCRIPT_REAL" deploy/desplegar.sh
  chmod +x deploy/desplegar.sh
  echo "servicios: {}" > deploy/docker-compose.prod.yml
  git_t add -A && git_t update-index --chmod=+x deploy/desplegar.sh
  echo a > a.txt && git_t add -A && git_t commit -q -m "c0"
  echo b > b.txt && git_t add -A && git_t commit -q -m "c1"
  echo c > c.txt && git_t add -A && git_t commit -q -m "c2 (otro archivo)"
  # c3 cambia el propio desplegar.sh (solo un comentario al final).
  printf '\n# versión nueva del script\n' >> deploy/desplegar.sh
  git_t add -A && git_t commit -q -m "c3 (cambia desplegar.sh)"
  git_t remote add origin "$T/origen.git" && git_t push -q origin main
)
SHA0="$(git -C "$T/trabajo" rev-parse HEAD~3)"
SHA1="$(git -C "$T/trabajo" rev-parse HEAD~2)"
SHA2="$(git -C "$T/trabajo" rev-parse HEAD~1)"
SHA3="$(git -C "$T/trabajo" rev-parse HEAD)"
git clone -q "$T/origen.git" "$T/raiz"
git -C "$T/raiz" checkout -q --detach "$SHA1"
DB="sha256:$(printf 'a%.0s' $(seq 64))"
DF="sha256:$(printf 'b%.0s' $(seq 64))"
DB2="sha256:$(printf 'c%.0s' $(seq 64))"
DF2="sha256:$(printf 'd%.0s' $(seq 64))"
ESTADO="$T/raiz/.despliegue"
export FAKE_ENV_COMPOSE="$ESTADO/compose.env"
# Digests de prueba: «sha256:» y 64 veces el carácter hexadecimal indicado.
digest() { printf 'sha256:%s' "$(printf "$1%.0s" $(seq 64))"; }

escribir_env() { # escribir_env <SITE_ADDRESS>
  cat > "$T/raiz/.env" <<EOF
JWT_SECRET=$(printf 'j%.0s' $(seq 40))
POSTGRES_PASSWORD=$(printf 'p%.0s' $(seq 30))
ADMIN_EMAIL=admin@prueba.local
ADMIN_PASSWORD=ClaveDePrueba-2026
SITE_ADDRESS=$1
EOF
}

# Corre el script del clon (el que haya en el checkout actual) con el entorno de prueba.
desplegar() { # desplegar <sha> <db> <df> <modo>; deja la salida en $T/salida.txt
  : > "$FAKE_DIR/docker.log"; : > "$FAKE_DIR/curl.log"
  PATH="$BIN:$PATH" RESERVAS_RAIZ="$T/raiz" RESERVAS_REGISTRO="registro.prueba/x" \
    RESERVAS_LOG="$T/despliegue.log" RESERVAS_SEGUNDOS_COMPROBACION=2 RESERVAS_SEGUNDOS_CAMBIO_ETAPA=3 \
    bash "$T/raiz/deploy/desplegar.sh" "$@" > "$T/salida.txt" 2>&1
  CODIGO=$?
}
subidas() { ls "$FAKE_DIR"/up-*.env 2> /dev/null | wc -l | tr -d ' '; }

# --- 1. Primer despliegue en la etapa HTTP -------------------------------------------------------
echo "1. Primer despliegue (etapa :80)"
escribir_env ":80"
desplegar "$SHA1" "$DB" "$DF" despliegue
[ "$CODIGO" = 0 ] && ok "termina en 0" || mal "termina en 0 (código $CODIGO)" "$(cat "$T/salida.txt")"
verificar "queda registrada la versión en servicio" grep -q "^$SHA1 $DB $DF$" "$ESTADO/VERSION_ACTUAL"
verificar "queda registrada la etapa vigente :80" grep -qx ":80" "$ESTADO/SITE_ADDRESS_VIGENTE"
verificar "comprueba por HTTP contra 127.0.0.1" grep -q "^url http://127.0.0.1" "$FAKE_DIR/curl.log"
[ "$(wc -l < "$ESTADO/historial" | tr -d ' ')" = 1 ] && ok "el historial tiene una línea" || mal "el historial tiene una línea"

# --- 2. Cambio de etapa que falla: vuelta atrás a la versión y a la etapa --------------------------
echo "2. Cambio a HTTPS que no obtiene certificado (vuelta atrás a la etapa :80)"
escribir_env "falla.prueba.test"
rm -f "$FAKE_DIR"/up-*.env
FAKE_CURL_FALLA_HTTPS=1 desplegar "$SHA1" "$DB" "$DF" despliegue
[ "$CODIGO" = 1 ] && ok "termina en 1" || mal "termina en 1 (código $CODIGO)" "$(cat "$T/salida.txt")"
verificar "redesplegar el mismo SHA no se saltea" no_contiene "$T/salida.txt" "versión superada"
verificar "avisa el cambio de etapa" contiene "$T/salida.txt" "cambio de etapa: :80 -> falla.prueba.test"
verificar "pide abrir el security group y espera más al certificado" contiene "$T/salida.txt" "espera hasta 3 s a que Caddy obtenga el certificado"
verificar "prueba HTTPS con el nombre del sitio (--resolve)" contiene "$FAKE_DIR/curl.log" "resolve falla.prueba.test:443:127.0.0.1"
verificar "la vuelta atrás vuelve a la etapa :80" contiene "$T/salida.txt" "VUELTA ATRÁS a $SHA1 completada, con la etapa :80"
verificar "la vuelta atrás comprueba por HTTP" contiene "$FAKE_DIR/curl.log" "^url http://127.0.0.1"
ultimo="$(ls "$FAKE_DIR"/up-*.env | sort -t- -k2 -n | tail -1)"
verificar "el último env de Compose quedó con SITE_ADDRESS=:80" contiene "$ultimo" "^SITE_ADDRESS=:80$"
verificar "la etapa vigente sigue en :80" grep -qx ":80" "$ESTADO/SITE_ADDRESS_VIGENTE"

# --- 3. Mismo SHA con otro .env: se aplica (punto 1 de la revisión) -------------------------------
echo "3. Redespliegue del mismo SHA con SITE_ADDRESS nuevo (el que ya estaba sirviendo)"
escribir_env "sitio.prueba.test"
rm -f "$FAKE_DIR"/up-*.env
desplegar "$SHA1" "$DB" "$DF" despliegue
[ "$CODIGO" = 0 ] && ok "termina en 0" || mal "termina en 0 (código $CODIGO)" "$(cat "$T/salida.txt")"
verificar "anuncia el redespliegue de la versión en servicio" contiene "$T/salida.txt" "redespliegue de la versión en servicio"
verificar "regenera el env de Compose con la etapa nueva" contiene "$ESTADO/compose.env" "^SITE_ADDRESS=sitio.prueba.test$"
[ "$(subidas)" -ge 1 ] && ok "recrea los contenedores (compose up)" || mal "recrea los contenedores (compose up)"
verificar "comprueba por HTTPS con el nombre del sitio" contiene "$FAKE_DIR/curl.log" "resolve sitio.prueba.test:443:127.0.0.1"
verificar "guarda la etapa vigente" grep -qx "sitio.prueba.test" "$ESTADO/SITE_ADDRESS_VIGENTE"
[ "$(wc -l < "$ESTADO/historial" | tr -d ' ')" = 1 ] && ok "no duplica la línea del historial" || mal "no duplica la línea del historial"

# --- 4. Un SHA anterior sigue siendo «superado» -------------------------------------------------
echo "4. Un commit anterior al que está sirviendo se saltea"
desplegar "$SHA0" "$DB" "$DF" despliegue
[ "$CODIGO" = 3 ] && ok "termina en 3 (superada: no es un error, pero el workflow la distingue)" || mal "termina en 3 (código $CODIGO)" "$(cat "$T/salida.txt")"
verificar "dice «versión superada»" contiene "$T/salida.txt" "versión superada"
[ ! -s "$FAKE_DIR/docker.log" ] && ok "no toca Docker" || mal "no toca Docker" "$(cat "$FAKE_DIR/docker.log")"

# --- 5. Un despliegue nuevo cuyo desplegar.sh cambió continúa con el script nuevo -----------------
echo "5. El commit nuevo trae otro desplegar.sh: se reejecuta con la versión nueva (una sola vez)"
: > "$T/despliegue.log"
desplegar "$SHA3" "$DB2" "$DF2" despliegue
[ "$CODIGO" = 0 ] && ok "termina en 0" || mal "termina en 0 (código $CODIGO)" "$(cat "$T/salida.txt")"
verificar "avisa que continúa con el script nuevo" contiene "$T/salida.txt" "desplegar.sh cambió en $SHA3"
verificar "queda desplegado el SHA nuevo" grep -q "^$SHA3 $DB2 $DF2$" "$ESTADO/VERSION_ACTUAL"
[ "$(grep -c "DESPLEGADO $SHA3" "$T/salida.txt")" = 1 ] && ok "se despliega una sola vez" || mal "se despliega una sola vez"
[ "$(grep -c "DESPLEGADO $SHA3" "$T/despliegue.log")" = 1 ] && ok "el log propio no queda duplicado" || mal "el log propio no queda duplicado" "$(cat "$T/despliegue.log")"

# --- 6. Un commit con el mismo script no se reejecuta -------------------------------------------
echo "6. Con el mismo desplegar.sh no hay reejecución"
git -C "$T/raiz" checkout -q --detach "$SHA1"
printf '%s %s %s\n' "$SHA1" "$DB" "$DF" > "$ESTADO/VERSION_ACTUAL"
echo "sitio.prueba.test" > "$ESTADO/SITE_ADDRESS_VIGENTE"
desplegar "$SHA2" "$DB2" "$DF2" despliegue
[ "$CODIGO" = 0 ] && ok "termina en 0" || mal "termina en 0 (código $CODIGO)" "$(cat "$T/salida.txt")"
verificar "no se reejecuta" no_contiene "$T/salida.txt" "desplegar.sh cambió"

# Los casos 7 a 12 empiezan sin estado de despliegue, en la etapa :80, con el clon en SHA0. SHA0,
# SHA1 y SHA2 tienen el mismo desplegar.sh, así que no hay reejecución.
DA="$(digest 1)"; FA="$(digest 2)"
DB_="$(digest 3)"; FB="$(digest 4)"
DC="$(digest 5)"; FC="$(digest 6)"
reiniciar() {
  rm -rf "$ESTADO" "$FAKE_DIR"/imagenes-* "$FAKE_DIR"/up-*.env
  git -C "$T/raiz" checkout -q --detach "$SHA0"
  escribir_env ":80"
}
version_actual() { cat "$ESTADO/VERSION_ACTUAL" 2> /dev/null; }
head_del_clon() { git -C "$T/raiz" rev-parse HEAD; }

# --- 7. Con dos versiones desplegadas, una tercera rota vuelve a la que estaba sirviendo ---------
echo "7. A, B y una C que no responde: vuelta atrás a B (no a A)"
reiniciar
desplegar "$SHA0" "$DA" "$FA" despliegue
desplegar "$SHA1" "$DB_" "$FB" despliegue
rm -f "$FAKE_DIR"/up-*.env
FAKE_DIGEST_ROTO="$DC" desplegar "$SHA2" "$DC" "$FC" despliegue
[ "$CODIGO" = 1 ] && ok "termina en 1" || mal "termina en 1 (código $CODIGO)" "$(cat "$T/salida.txt")"
verificar "avisa la vuelta atrás a B" contiene "$T/salida.txt" "VUELTA ATRÁS a $SHA1 completada"
[ "$(version_actual)" = "$SHA1 $DB_ $FB" ] && ok "la versión en servicio sigue siendo B" || mal "la versión en servicio sigue siendo B" "$(version_actual)"
ultimo="$(ls "$FAKE_DIR"/up-*.env | sort -t- -k2 -n | tail -1)"
verificar "el último env de Compose levanta las imágenes de B" contiene "$ultimo" "^DIGEST_BACKEND=$DB_$"
[ "$(head_del_clon)" = "$SHA1" ] && ok "el clon queda en el commit de B" || mal "el clon queda en el commit de B"
verificar "C no entra en el historial" no_contiene "$ESTADO/historial" "^$SHA2 "

# --- 8. Vuelta atrás manual: usa los digests del historial y rechaza lo que no está -------------
echo "8. Vuelta atrás a una versión del historial (con el tag vuelto a publicar) y a una que no está"
# El workflow manda los digests vacíos; aunque llegaran otros (el tag de A se volvió a publicar
# con la imagen de C), se usan los registrados.
desplegar "$SHA0" "$DC" "$FC" vuelta-atras
[ "$CODIGO" = 0 ] && ok "termina en 0" || mal "termina en 0 (código $CODIGO)" "$(cat "$T/salida.txt")"
verificar "usa los digests registrados en el historial" contiene "$ESTADO/compose.env" "^DIGEST_BACKEND=$DA$"
verificar "también el del frontend" contiene "$ESTADO/compose.env" "^DIGEST_FRONTEND=$FA$"
[ "$(version_actual)" = "$SHA0 $DA $FA" ] && ok "la versión en servicio pasa a ser A" || mal "la versión en servicio pasa a ser A" "$(version_actual)"
antes="$(version_actual)"
desplegar "$SHA2" "" "" vuelta-atras
[ "$CODIGO" = 1 ] && ok "un SHA fuera del historial termina en 1" || mal "un SHA fuera del historial termina en 1 (código $CODIGO)" "$(cat "$T/salida.txt")"
verificar "dice que la vuelta atrás se rechaza" contiene "$T/salida.txt" "vuelta atrás rechazada"
[ ! -s "$FAKE_DIR/docker.log" ] && ok "no toca Docker" || mal "no toca Docker" "$(cat "$FAKE_DIR/docker.log")"
[ "$(version_actual)" = "$antes" ] && ok "no cambia la versión en servicio" || mal "no cambia la versión en servicio"

# --- 9. Limpieza de imágenes: quedan solo la versión actual y la anterior ----------------------
echo "9. Después de tres despliegues quedan en disco solo las imágenes de la actual y la anterior"
reiniciar
desplegar "$SHA0" "$DA" "$FA" despliegue
desplegar "$SHA1" "$DB_" "$FB" despliegue
printf '%s\n' "$DA" "$DB_" "$DC" > "$FAKE_DIR/imagenes-reservas-backend"
printf '%s\n' "$FA" "$FB" "$FC" > "$FAKE_DIR/imagenes-reservas-frontend"
desplegar "$SHA2" "$DC" "$FC" despliegue
[ "$CODIGO" = 0 ] && ok "termina en 0" || mal "termina en 0 (código $CODIGO)" "$(cat "$T/salida.txt")"
[ "$(sort "$FAKE_DIR/imagenes-reservas-backend" | tr '\n' ' ')" = "$(printf '%s\n' "$DB_" "$DC" | sort | tr '\n' ' ')" ] \
  && ok "backend: quedan B y C" || mal "backend: quedan B y C" "$(cat "$FAKE_DIR/imagenes-reservas-backend")"
[ "$(sort "$FAKE_DIR/imagenes-reservas-frontend" | tr '\n' ' ')" = "$(printf '%s\n' "$FB" "$FC" | sort | tr '\n' ' ')" ] \
  && ok "frontend: quedan B y C" || mal "frontend: quedan B y C" "$(cat "$FAKE_DIR/imagenes-reservas-frontend")"

# --- 10. Una migración rota corta antes de levantar la versión nueva ----------------------------
echo "10. Migración rota: no se levanta la versión nueva"
reiniciar
desplegar "$SHA0" "$DA" "$FA" despliegue
FAKE_DOCKER_FALLA="prisma migrate deploy" desplegar "$SHA1" "$DB_" "$FB" despliegue
[ "$CODIGO" = 1 ] && ok "termina en 1" || mal "termina en 1 (código $CODIGO)" "$(cat "$T/salida.txt")"
verificar "avisa la migración fallida" contiene "$T/salida.txt" "falló una migración"
verificar "no levanta la aplicación (sin compose up de la versión)" no_contiene "$FAKE_DIR/docker.log" "up -d --remove-orphans"
verificar "no carga los datos iniciales" no_contiene "$FAKE_DIR/docker.log" "seed-produccion"
[ "$(version_actual)" = "$SHA0 $DA $FA" ] && ok "la versión en servicio sigue siendo A" || mal "la versión en servicio sigue siendo A" "$(version_actual)"
[ "$(head_del_clon)" = "$SHA0" ] && ok "el clon vuelve al commit de A" || mal "el clon vuelve al commit de A"
verificar "el env de Compose vuelve a las imágenes de A" contiene "$ESTADO/compose.env" "^DIGEST_BACKEND=$DA$"

# --- 11. .env ausente, con permisos abiertos o incompleto: error sin tocar nada -----------------
echo "11. .env inválido: termina en error sin tocar nada y sin imprimir valores"
reiniciar
desplegar "$SHA0" "$DA" "$FA" despliegue
antes="$(version_actual)"
env_invalido() { # env_invalido <descripción> <texto esperado> [VAR=valor]
  local desc="$1" esperado="$2"
  shift 2
  ( for asignacion in "$@"; do export "${asignacion?}"; done; desplegar "$SHA1" "$DB_" "$FB" despliegue; echo "$CODIGO" > "$T/codigo" )
  local codigo; codigo="$(cat "$T/codigo")"
  [ "$codigo" = 1 ] && ok "$desc: termina en 1" || mal "$desc: termina en 1 (código $codigo)" "$(cat "$T/salida.txt")"
  verificar "$desc: explica el problema" contiene "$T/salida.txt" "$esperado"
  [ ! -s "$FAKE_DIR/docker.log" ] && ok "$desc: no toca Docker" || mal "$desc: no toca Docker" "$(cat "$FAKE_DIR/docker.log")"
  [ "$(version_actual)" = "$antes" ] && [ "$(head_del_clon)" = "$SHA0" ] \
    && ok "$desc: no cambia la versión ni el clon" || mal "$desc: no cambia la versión ni el clon"
  local secreto
  for secreto in "$(printf 'j%.0s' $(seq 40))" "$(printf 'p%.0s' $(seq 30))" "ClaveDePrueba-2026"; do
    if grep -qF -- "$secreto" "$T/salida.txt"; then mal "$desc: no imprime valores del .env"; return; fi
  done
  ok "$desc: no imprime valores del .env"
}
mv "$T/raiz/.env" "$T/env.guardado"
env_invalido "sin .env" "no existe $T/raiz/.env"
mv "$T/env.guardado" "$T/raiz/.env"
env_invalido ".env con modo 644" "tiene modo 644" FAKE_ENV_MODO=644
grep -v '^ADMIN_PASSWORD=' "$T/raiz/.env" > "$T/env.sin-clave"
cp "$T/raiz/.env" "$T/env.guardado" && cp "$T/env.sin-clave" "$T/raiz/.env"
env_invalido "sin ADMIN_PASSWORD" "faltan variables en $T/raiz/.env (o están vacías): ADMIN_PASSWORD"
cp "$T/env.guardado" "$T/raiz/.env"

# --- 12. Conexión cortada: SIGHUP y salida cerrada a mitad del despliegue -----------------------
echo "12. Se corta la conexión durante la migración: el despliegue termina igual y el log queda completo"
reiniciar
desplegar "$SHA0" "$DA" "$FA" despliegue
: > "$FAKE_DIR/docker.log"; : > "$T/despliegue.log"
# La salida va a una tubería que ya se cerró (`true` no lee nada), y en la migración el simulacro
# de docker le manda SIGHUP al script, como sshd al caerse el SSH del runner.
PATH="$BIN:$PATH" RESERVAS_RAIZ="$T/raiz" RESERVAS_REGISTRO="registro.prueba/x" \
  RESERVAS_LOG="$T/despliegue.log" RESERVAS_SEGUNDOS_COMPROBACION=2 FAKE_DOCKER_HUP="prisma migrate deploy" \
  bash "$T/raiz/deploy/desplegar.sh" "$SHA1" "$DB_" "$FB" despliegue 2>&1 | true
CODIGO="${PIPESTATUS[0]}"
[ "$CODIGO" = 0 ] && ok "termina en 0" || mal "termina en 0 (código $CODIGO)"
[ "$(version_actual)" = "$SHA1 $DB_ $FB" ] && ok "queda desplegada la versión nueva" || mal "queda desplegada la versión nueva" "$(version_actual)"
verificar "llegó a levantar la versión (compose up)" contiene "$FAKE_DIR/docker.log" "up -d --remove-orphans"
# `tee` escribe el log en segundo plano: se le da un momento para terminar.
for _ in $(seq 50); do grep -q "DESPLEGADO $SHA1" "$T/despliegue.log" && break; command sleep 0.1; done
verificar "el log propio llega hasta el final" contiene "$T/despliegue.log" "DESPLEGADO $SHA1"
verificar "el log incluye la migración" contiene "$T/despliegue.log" "aplicando migraciones"

# --- 13. Los scripts de despliegue se versionan como ejecutables --------------------------------
# El comando forzado de authorized_keys y el sudoers ejecutan estos archivos directamente: con
# modo 100644 en Git, sshd responde `Permission denied` y todos los despliegues fallan.
echo "13. Modo ejecutable en Git"
RAIZ_REPO="$(cd "$AQUI/../.." && pwd)"
for f in deploy/desplegar.sh deploy/ssh-entrada.sh deploy/test/desplegar.test.sh scripts/cd/verificar-certificado.sh; do
  modo="$(git -C "$RAIZ_REPO" ls-files -s -- "$f" | cut -d" " -f1)"
  [ "$modo" = 100755 ] && ok "$f es ejecutable" || mal "$f es ejecutable (modo en Git: ${modo:-sin versionar})"
done

echo
echo "Resultado: $PASO comprobaciones correctas, $FALLO con fallas."
[ "$FALLO" = 0 ]
