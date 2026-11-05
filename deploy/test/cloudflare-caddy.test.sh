#!/usr/bin/env bash
#
# Pruebas de integración de la confianza en Cloudflare de deploy/Caddyfile (tareas 2.1 y 3.1 de
# ip-real-detras-de-cloudflare).
#
# Levantan el Caddyfile REAL (la misma imagen fijada de producción) delante de un "eco" que
# devuelve los encabezados que le llegan desde Caddy, y le hablan desde contenedores con IP
# conocida en una red temporal. Una parte de esa red hace de "Cloudflare" (es la lista de
# confianza que se le pone a Caddy) y otra no. Así se comprueba, sin tocar la red de producción:
#   - qué IP recibe el backend como origen del visitante (X-Forwarded-For hacia el frontend),
#   - que un cliente que no es Cloudflare no puede elegir su origen,
#   - que lo que escribe un visitante en X-Forwarded-For, X-Real-IP o Forwarded no pasa,
#   - que el visitante no elige el host ni el esquema que ve el frontend (X-Forwarded-Host y
#     X-Forwarded-Proto), que Next usa para URLs absolutas, redirecciones y el chequeo de origen
#     de las server actions.
#
# Necesita Docker. Sin Docker FALLA a propósito (para que el CI no la saltee en silencio);
# quien no tenga Docker puede saltearla con SALTAR_CADDY=1.
#
# El eco responde con el nombre `frontend`, el mismo que usa el Caddyfile de producción, así el
# Caddyfile se prueba casi tal cual está: lo único que se cambia es la lista de la línea
# `trusted_proxies static` (por los rangos de la red de prueba); que esa lista sea la de
# Cloudflare lo comprueba scripts/cd/verificar-rangos-cloudflare.test.mjs.
#
# Variables opcionales:
#   CADDYFILE   Caddyfile a probar (por defecto deploy/Caddyfile).

set -u

if [ "${SALTAR_CADDY:-0}" = 1 ]; then
  echo "SALTADA (SALTAR_CADDY=1): sin Docker no se prueba la confianza en Cloudflare."
  exit 0
fi

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CADDYFILE="${CADDYFILE:-$RAIZ/deploy/Caddyfile}"
# Misma imagen (y digest) que producción: la prueba no debe depender de otra versión de Caddy.
IMAGEN="$(sed -n 's/^[[:space:]]*image: \(caddy:[^[:space:]]*\)$/\1/p' "$RAIZ/deploy/docker-compose.prod.yml" | head -1)"

if ! docker info > /dev/null 2>&1; then
  echo "FALLA: Docker no responde. Esta prueba lo necesita (SALTAR_CADDY=1 para saltearla)."
  exit 1
fi
if [ -z "$IMAGEN" ]; then
  echo "FALLA: no se encontró la imagen de Caddy en deploy/docker-compose.prod.yml."
  exit 1
fi

# Evita que Git Bash en Windows reescriba rutas dentro de los comandos de docker.
export MSYS_NO_PATHCONV=1

# docker cp necesita una ruta que entienda el propio docker: en Git Bash (Windows) hay que
# pasarla en formato mixto (C:/...); en Linux, cygpath no existe y la ruta sirve tal cual.
ruta_docker() { if command -v cygpath > /dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

PASO=0
FALLO=0
ok() { PASO=$((PASO + 1)); printf '  ok   %s\n' "$1"; }
mal() { FALLO=$((FALLO + 1)); printf '  FALLA %s\n' "$1"; [ -z "${2:-}" ] || printf '%s\n' "$2" | sed 's/^/        | /'; }

SUFIJO="$$-$RANDOM"
RED="cf-test-$SUFIJO"
ECO="cf-eco-$SUFIJO"
PROXY="cf-proxy-$SUFIJO"
T="$(mktemp -d)"

limpiar() {
  docker rm -f "$PROXY" "$ECO" > /dev/null 2>&1
  docker network rm "$RED" > /dev/null 2>&1
  rm -rf "$T"
}
trap limpiar EXIT

# --- Red temporal con un rango libre (docker rechaza los que se superponen) -------------------
BASE=""
BASE6=""
for tercer in $(seq 231 250); do
  if docker network create --ipv6 --subnet "10.$tercer.57.0/24" --subnet "fd5a:57:$tercer::/64" "$RED" > /dev/null 2>&1; then
    BASE="10.$tercer.57"
    BASE6="fd5a:57:$tercer:"
    break
  fi
done
if [ -z "$BASE" ]; then
  echo "FALLA: no se pudo crear una red temporal de Docker con IPv4 e IPv6."
  exit 1
fi

# Direcciones: .10 y .11 son "bordes de Cloudflare" (dentro del /25 que se declara de confianza);
# .200 es un cliente cualquiera que NO es Cloudflare.
# IPv6: ::10 es un borde de Cloudflare dentro del /121 de confianza (::0 a ::7f); ::200 queda fuera.
CONFIABLES="$BASE.0/25 ${BASE6}:/121"
BORDE_A6="${BASE6}:10"
AJENO6="${BASE6}:200"
PROXY6="${BASE6}:5"
BORDE_A="$BASE.10"
BORDE_B="$BASE.11"
AJENO="$BASE.200"

# --- Eco: devuelve los encabezados que recibe -------------------------------------------------
cat > "$T/eco.Caddyfile" <<'EOF'
{
	admin off
}
:3000 {
	respond "xff={header.X-Forwarded-For}|cf={header.CF-Connecting-IP}|xri={header.X-Real-IP}|fwd={header.Forwarded}|xfh={header.X-Forwarded-Host}|xfp={header.X-Forwarded-Proto}"
}
EOF
docker create --name "$ECO" --network "$RED" --network-alias frontend "$IMAGEN" caddy run --config /etc/caddy/Caddyfile > /dev/null
docker cp "$(ruta_docker "$T/eco.Caddyfile")" "$ECO:/etc/caddy/Caddyfile"
docker start "$ECO" > /dev/null

# --- Caddy bajo prueba ------------------------------------------------------------------------
# Copia del Caddyfile con la lista de confianza de la red de prueba. Si la línea no existe (por
# ejemplo, el Caddyfile viejo, sin `trusted_proxies`), queda igual: es lo que se quiere probar.
sed "s|^\([[:space:]]*trusted_proxies static\) .*\$|\1 $CONFIABLES|" "$CADDYFILE" > "$T/Caddyfile"
docker create --name "$PROXY" --network "$RED" --ip6 "$PROXY6" \
  -e SITE_ADDRESS=:80 \
  "$IMAGEN" caddy run --config /etc/caddy/Caddyfile > /dev/null
docker cp "$(ruta_docker "$T/Caddyfile")" "$PROXY:/etc/caddy/Caddyfile"
docker start "$PROXY" > /dev/null

# Espera a que Caddy responda (el eco ya está arriba).
LISTO=0
for _ in $(seq 1 30); do
  if docker run --rm --network "$RED" --ip "$BORDE_A" --entrypoint wget "$IMAGEN" -q -O - "http://$PROXY/" 2> /dev/null | grep -q '^xff='; then
    LISTO=1
    break
  fi
  sleep 1
done
if [ "$LISTO" != 1 ]; then
  echo "FALLA: Caddy no respondió. Registro:"
  docker logs "$PROXY" 2>&1 | tail -15 | sed 's/^/        | /'
  exit 1
fi

# pedir <ip-de-origen> [encabezado ...]  ->  imprime la línea del eco
pedir() {
  local desde="$1"
  shift
  local args=()
  local h
  for h in "$@"; do args+=("--header=$h"); done
  docker run --rm --network "$RED" --ip "$desde" --entrypoint wget "$IMAGEN" \
    -q -O - "${args[@]}" "http://$PROXY/" 2> /dev/null
}
# pedir6 <ip6-de-origen> [encabezado ...]  ->  igual que pedir, pero por IPv6 al proxy
pedir6() {
  local desde="$1"
  shift
  local args=()
  local h
  for h in "$@"; do args+=("--header=$h"); done
  docker run --rm --network "$RED" --ip6 "$desde" --entrypoint wget "$IMAGEN"     -q -O - "${args[@]}" "http://[$PROXY6]/" 2> /dev/null
}
campo() { printf '%s' "$1" | tr '|' '\n' | sed -n "s/^$2=//p"; }

VISITANTE_1="203.0.113.7"
VISITANTE_2="198.51.100.9"
VISITANTE_3="192.0.2.44"

# --- 1. El origen que llega es el del visitante -----------------------------------------------
echo "1. Origen real del visitante detrás de Cloudflare"
R="$(pedir "$BORDE_A" "CF-Connecting-IP: $VISITANTE_1")"
[ "$(campo "$R" xff)" = "$VISITANTE_1" ] \
  && ok "el origen es la IP que informa Cloudflare, no la del borde" \
  || mal "el origen es la IP que informa Cloudflare, no la del borde" "recibido: $R"

R1="$(pedir "$BORDE_A" "CF-Connecting-IP: $VISITANTE_1")"
R2="$(pedir "$BORDE_A" "CF-Connecting-IP: $VISITANTE_2")"
R3="$(pedir "$BORDE_A" "CF-Connecting-IP: $VISITANTE_3")"
X1="$(campo "$R1" xff)"; X2="$(campo "$R2" xff)"; X3="$(campo "$R3" xff)"
{ [ -n "$X1" ] && [ "$X1" != "$X2" ] && [ "$X1" != "$X3" ] && [ "$X2" != "$X3" ]; } \
  && ok "tres visitantes por el mismo borde llegan con tres orígenes distintos (tres contadores)" \
  || mal "tres visitantes por el mismo borde llegan con tres orígenes distintos (tres contadores)" "recibido: $X1 / $X2 / $X3"

RA="$(pedir "$BORDE_A" "CF-Connecting-IP: $VISITANTE_1")"
RB="$(pedir "$BORDE_B" "CF-Connecting-IP: $VISITANTE_1")"
{ [ -n "$(campo "$RA" xff)" ] && [ "$(campo "$RA" xff)" = "$(campo "$RB" xff)" ]; } \
  && ok "un mismo visitante por dos bordes distintos llega con el mismo origen (un contador)" \
  || mal "un mismo visitante por dos bordes distintos llega con el mismo origen (un contador)" "borde A: $RA / borde B: $RB"

# --- 2. Lo que escribe el visitante no pasa (guardas de regresión) ----------------------------
echo "2. El visitante no elige su origen"
R="$(pedir "$BORDE_A" "CF-Connecting-IP: $VISITANTE_1" "X-Forwarded-For: 6.6.6.6" "X-Real-IP: 7.7.7.7" "Forwarded: for=8.8.8.8")"
{ ! printf '%s' "$R" | grep -qE '6\.6\.6\.6|7\.7\.7\.7|8\.8\.8\.8'; } \
  && ok "X-Forwarded-For, X-Real-IP y Forwarded inventados no llegan al frontend" \
  || mal "X-Forwarded-For, X-Real-IP y Forwarded inventados no llegan al frontend" "recibido: $R"

R="$(pedir "$BORDE_A" "CF-Connecting-IP: $VISITANTE_1" "X-Forwarded-For: 6.6.6.6")"
[ "$(campo "$R" xff)" = "$VISITANTE_1" ] \
  && ok "con CF-Connecting-IP válido, el origen es solo ese (sin lo inventado)" \
  || mal "con CF-Connecting-IP válido, el origen es solo ese (sin lo inventado)" "recibido: $R"

R="$(pedir "$BORDE_A" "CF-Connecting-IP: $VISITANTE_1")"
{ [ -n "$(campo "$R" xff)" ] && [ -z "$(campo "$R" cf)" ]; }   && ok "CF-Connecting-IP se elimina antes de llegar al frontend (el eco lo ve vacío)"   || mal "CF-Connecting-IP se elimina antes de llegar al frontend (el eco lo ve vacío)" "recibido: $R"

# --- 3. Un cliente que no es Cloudflare no puede presentarse como otro ------------------------
echo "3. El encabezado de Cloudflare solo vale desde Cloudflare"
R="$(pedir "$AJENO" "CF-Connecting-IP: $VISITANTE_1" "X-Forwarded-For: 6.6.6.6" "X-Real-IP: 7.7.7.7")"
[ "$(campo "$R" xff)" = "$AJENO" ] \
  && ok "desde un origen que no es Cloudflare, el origen es su propia IP" \
  || mal "desde un origen que no es Cloudflare, el origen es su propia IP" "recibido: $R"
{ ! printf '%s' "$R" | grep -qE "$VISITANTE_1|6\.6\.6\.6|7\.7\.7\.7"; } \
  && ok "lo que inventó ese cliente no llega al frontend" \
  || mal "lo que inventó ese cliente no llega al frontend" "recibido: $R"

# --- 4. Cloudflare sin CF-Connecting-IP --------------------------------------------------------
echo "4. Conexión de Cloudflare sin CF-Connecting-IP"
R="$(pedir "$BORDE_A" "X-Forwarded-For: 6.6.6.6")"
[ "$(campo "$R" xff)" = "$BORDE_A" ] \
  && ok "se identifica por la dirección de la conexión, sin usar el X-Forwarded-For que traiga" \
  || mal "se identifica por la dirección de la conexión, sin usar el X-Forwarded-For que traiga" "recibido: $R"

# --- 5. Lo mismo por IPv6 ----------------------------------------------------------------------
echo "5. Conexiones por IPv6"
R="$(pedir6 "$BORDE_A6" "CF-Connecting-IP: $VISITANTE_1")"
[ "$(campo "$R" xff)" = "$VISITANTE_1" ]   && ok "un borde de Cloudflare por IPv6 (dentro del rango confiable) informa el origen del visitante"   || mal "un borde de Cloudflare por IPv6 (dentro del rango confiable) informa el origen del visitante" "recibido: $R"

R="$(pedir6 "$AJENO6" "CF-Connecting-IP: $VISITANTE_1" "X-Forwarded-For: 6.6.6.6")"
[ "$(campo "$R" xff)" = "$AJENO6" ]   && ok "un cliente IPv6 fuera del rango confiable se identifica por su propia IP"   || mal "un cliente IPv6 fuera del rango confiable se identifica por su propia IP" "recibido: $R"

# --- 6. El visitante no elige el host ni el esquema --------------------------------------------
# Detrás de un proxy de confianza, Caddy conserva el X-Forwarded-Host y el X-Forwarded-Proto que
# llegan, y Cloudflare deja pasar los del visitante. El Caddyfile tiene que fijarlos.
echo "6. Host y esquema que ve el frontend"
R="$(pedir "$BORDE_A" "CF-Connecting-IP: $VISITANTE_1" "X-Forwarded-Host: atacante.example" "X-Forwarded-Proto: https")"
[ "$(campo "$R" xfh)" = "$PROXY" ] \
  && ok "X-Forwarded-Host es el host del pedido, no el que inventó el visitante" \
  || mal "X-Forwarded-Host es el host del pedido, no el que inventó el visitante" "recibido: $R"
[ "$(campo "$R" xfp)" = "http" ] \
  && ok "X-Forwarded-Proto es el esquema de la conexión, no el que inventó el visitante" \
  || mal "X-Forwarded-Proto es el esquema de la conexión, no el que inventó el visitante" "recibido: $R"

echo
echo "Resultado: $PASO comprobaciones correctas, $FALLO con fallas."
[ "$FALLO" = 0 ]
