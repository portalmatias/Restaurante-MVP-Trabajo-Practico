#!/usr/bin/env bash
#
# Pruebas locales de deploy/desplegar.sh (tarea 5.2 de despliegue-continuo-ec2).
#
# Corren sin Docker, sin red y sin root: arman un repositorio Git temporal (un remoto y un clon
# que hace de /opt/reservas) y ponen delante en el PATH versiones simuladas de `docker`, `curl`,
# `flock`, `sleep` y `stat`. Lo que se comprueba es la lógica del script (decisiones, estado,
# etapa HTTP/HTTPS, vuelta atrás, reejecución), no Docker ni Caddy.
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
if [[ "$formato" == *content_type* ]]; then printf '200 application/json\n'; else printf '200'; fi
EOF
printf '#!/usr/bin/env bash\nexit 0\n' > "$BIN/flock"
printf '#!/usr/bin/env bash\nexit 0\n' > "$BIN/sleep"
cat > "$BIN/stat" <<'EOF'
#!/usr/bin/env bash
# El .env de prueba hace de archivo de root con modo 600 (chmod no se refleja en todos los sistemas).
for a in "$@"; do
  case "$a" in
    */.env) case " $* " in *" %u "* | *"'%u'"*) id -u ;; *) echo 600 ;; esac; exit 0 ;;
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
[ "$CODIGO" = 0 ] && ok "termina en 0" || mal "termina en 0 (código $CODIGO)" "$(cat "$T/salida.txt")"
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

# --- 7. Los scripts de despliegue se versionan como ejecutables ---------------------------------
# El comando forzado de authorized_keys y el sudoers ejecutan estos archivos directamente: con
# modo 100644 en Git, sshd responde `Permission denied` y todos los despliegues fallan.
echo "7. Modo ejecutable en Git"
RAIZ_REPO="$(cd "$AQUI/../.." && pwd)"
for f in deploy/desplegar.sh deploy/ssh-entrada.sh deploy/test/desplegar.test.sh scripts/cd/verificar-certificado.sh; do
  modo="$(git -C "$RAIZ_REPO" ls-files -s -- "$f" | cut -d" " -f1)"
  [ "$modo" = 100755 ] && ok "$f es ejecutable" || mal "$f es ejecutable (modo en Git: ${modo:-sin versionar})"
done

echo
echo "Resultado: $PASO comprobaciones correctas, $FALLO con fallas."
[ "$FALLO" = 0 ]
