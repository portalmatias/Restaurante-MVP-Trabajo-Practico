#!/usr/bin/env bash
#
# Pruebas locales de deploy/ssh-entrada.sh (tarea 5.3 de despliegue-continuo-ec2).
#
# Corren sin servidor SSH real: ejecutan ssh-entrada.sh con distintos SSH_ORIGINAL_COMMAND
# y un desplegar.sh falso que solo registra sus argumentos. Para apuntar al desplegar.sh de
# prueba se usa RESERVAS_DESPLEGAR. Se comprueba validación estricta, que no hay evaluación
# de shell y que los argumentos se pasan por separado.

set -u

SCRIPT_REAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/ssh-entrada.sh"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT

PASO=0
FALLO=0
ok() { PASO=$((PASO + 1)); printf '  ok   %s\n' "$1"; }
mal() { FALLO=$((FALLO + 1)); printf '  FALLA %s\n' "$1"; [ -z "${2:-}" ] || printf '%s\n' "$2" | sed 's/^/        | /'; }
verificar() {
  local desc="$1"
  shift
  if "$@" > /dev/null 2>&1; then ok "$desc"; else mal "$desc"; fi
}
contiene() { grep -q -- "$2" "$1"; }
no_contiene() { ! grep -q -- "$2" "$1"; }

# --- Desplegar falso --------------------------------------------------------------------------
DESPLEGAR_FAKE="$T/desplegar-falso.sh"
FAKE_LOG="$T/llamadas.log"
cat > "$DESPLEGAR_FAKE" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$#" >> "$FAKE_LOG"
for a in "\$@"; do
  printf '[ARG]%s\n' "\$a" >> "$FAKE_LOG"
done
exit 0
EOF
chmod +x "$DESPLEGAR_FAKE"
: > "$FAKE_LOG"

SHA_VALIDO="$(printf 'a%.0s' $(seq 40))"
DIGEST_VALIDO="sha256:$(printf 'b%.0s' $(seq 64))"
DIGEST_VALIDO2="sha256:$(printf 'c%.0s' $(seq 64))"

# --- Ejecutar ssh-entrada ---------------------------------------------------------------------
probar() {
  local cmd="$1"
  local salida="$T/salida.txt"
  : > "$FAKE_LOG"
  SSH_ORIGINAL_COMMAND="$cmd" RESERVAS_DESPLEGAR="$DESPLEGAR_FAKE" bash "$SCRIPT_REAL" > "$salida" 2>&1
  CODIGO=$?
  SALIDA_TXT="$salida"
}

# --- 1. Casos válidos -------------------------------------------------------------------------
echo "1. Casos válidos"

probar "$SHA_VALIDO $DIGEST_VALIDO $DIGEST_VALIDO2 despliegue"
[ "$CODIGO" = 0 ] && ok "despliegue válido termina en 0" || mal "despliegue válido termina en 0 (código $CODIGO)" "$(cat "$SALIDA_TXT")"
[ "$(wc -l < "$FAKE_LOG")" -ge 1 ] && ok "invoca a desplegar" || mal "invoca a desplegar"
[ "$(head -n1 "$FAKE_LOG")" = "4" ] && ok "pasa cuatro argumentos" || mal "pasa cuatro argumentos" "$(cat "$FAKE_LOG")"
grep -q '^\[ARG\]'"$SHA_VALIDO"'$' "$FAKE_LOG" && ok "pasa sha como primer argumento" || mal "pasa sha como primer argumento"
grep -q '^\[ARG\]'"$DIGEST_VALIDO"'$' "$FAKE_LOG" && ok "pasa digest backend" || mal "pasa digest backend"
grep -q '^\[ARG\]'"$DIGEST_VALIDO2"'$' "$FAKE_LOG" && ok "pasa digest frontend" || mal "pasa digest frontend"
grep -q '^\[ARG\]despliegue$' "$FAKE_LOG" && ok "pasa modo despliegue" || mal "pasa modo despliegue"

probar "$SHA_VALIDO - - vuelta-atras"
[ "$CODIGO" = 0 ] && ok "vuelta-atras con guiones termina en 0" || mal "vuelta-atras con guiones termina en 0 (código $CODIGO)" "$(cat "$SALIDA_TXT")"
[ "$(head -n1 "$FAKE_LOG")" = "4" ] && ok "vuelta-atras pasa cuatro argumentos" || mal "vuelta-atras pasa cuatro argumentos"
# El guion llega como cadena vacía
grep -A2 '^\[ARG\]'"$SHA_VALIDO"'$' "$FAKE_LOG" | grep -q '^\[ARG\]$' && ok "el primer guion se traduce a cadena vacía" || mal "el primer guion se traduce a cadena vacía" "$(cat "$FAKE_LOG")"

# --- 2. Casos rechazados con código 2 y sin invocar nada ---------------------------------------
echo "2. Casos rechazados"

probar ""
[ "$CODIGO" = 2 ] && ok "comando vacío rechaza con 2" || mal "comando vacío rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "comando vacío no invoca desplegar" || mal "comando vacío invoca desplegar"

probar "bash"
[ "$CODIGO" = 2 ] && ok "bash rechaza con 2" || mal "bash rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "bash no invoca desplegar" || mal "bash invoca desplegar"

probar "$SHA_VALIDO $DIGEST_VALIDO $DIGEST_VALIDO2 despliegue; id"
[ "$CODIGO" = 2 ] && ok "comando con punto y coma rechaza con 2" || mal "comando con punto y coma rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "punto y coma no invoca desplegar" || mal "punto y coma invoca desplegar"

probar "ls; id"
[ "$CODIGO" = 2 ] && ok "ls; id rechaza con 2" || mal "ls; id rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "ls; id no invoca desplegar" || mal "ls; id invoca desplegar"

probar "\$(id) $DIGEST_VALIDO $DIGEST_VALIDO2 despliegue"
[ "$CODIGO" = 2 ] && ok "sustitución de comando rechaza con 2" || mal "sustitución de comando rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "sustitución de comando no invoca desplegar" || mal "sustitución de comando invoca desplegar"

SHA_CORTO="$(printf 'a%.0s' $(seq 39))"
probar "$SHA_CORTO $DIGEST_VALIDO $DIGEST_VALIDO2 despliegue"
[ "$CODIGO" = 2 ] && ok "SHA de 39 caracteres rechaza con 2" || mal "SHA de 39 rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "SHA de 39 no invoca desplegar" || mal "SHA de 39 invoca desplegar"

SHA_LARGO="$(printf 'a%.0s' $(seq 41))"
probar "$SHA_LARGO $DIGEST_VALIDO $DIGEST_VALIDO2 despliegue"
[ "$CODIGO" = 2 ] && ok "SHA de 41 caracteres rechaza con 2" || mal "SHA de 41 rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "SHA de 41 no invoca desplegar" || mal "SHA de 41 invoca desplegar"

SHA_MAYUS="$(printf 'A%.0s' $(seq 40))"
probar "$SHA_MAYUS $DIGEST_VALIDO $DIGEST_VALIDO2 despliegue"
[ "$CODIGO" = 2 ] && ok "SHA con mayúsculas rechaza con 2" || mal "SHA con mayúsculas rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "SHA con mayúsculas no invoca desplegar" || mal "SHA con mayúsculas invoca desplegar"

probar "$SHA_VALIDO sha256:abc $DIGEST_VALIDO2 despliegue"
[ "$CODIGO" = 2 ] && ok "digest sin 64 hex rechaza con 2" || mal "digest corto rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "digest corto no invoca desplegar" || mal "digest corto invoca desplegar"

probar "$SHA_VALIDO abcdef $DIGEST_VALIDO2 despliegue"
[ "$CODIGO" = 2 ] && ok "digest sin sha256: rechaza con 2" || mal "digest sin prefijo rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "digest sin prefijo no invoca desplegar" || mal "digest sin prefijo invoca desplegar"

probar "$SHA_VALIDO md5:$(printf 'd%.0s' $(seq 32)) $DIGEST_VALIDO2 despliegue"
[ "$CODIGO" = 2 ] && ok "digest md5 rechaza con 2" || mal "digest md5 rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "digest md5 no invoca desplegar" || mal "digest md5 invoca desplegar"

probar "$SHA_VALIDO $DIGEST_VALIDO $DIGEST_VALIDO2 borrar"
[ "$CODIGO" = 2 ] && ok "modo desconocido rechaza con 2" || mal "modo desconocido rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "modo desconocido no invoca desplegar" || mal "modo desconocido invoca desplegar"

probar "$SHA_VALIDO $DIGEST_VALIDO $DIGEST_VALIDO2 despliegue extra"
[ "$CODIGO" = 2 ] && ok "argumentos de más rechaza con 2" || mal "argumentos de más rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "argumentos de más no invoca desplegar" || mal "argumentos de más invoca desplegar"

probar "$SHA_VALIDO $DIGEST_VALIDO $DIGEST_VALIDO2 despliegue"$'\n'"id"
[ "$CODIGO" = 2 ] && ok "salto de línea rechaza con 2" || mal "salto de línea rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "salto de línea no invoca desplegar" || mal "salto de línea invoca desplegar"

probar "$SHA_VALIDO  $DIGEST_VALIDO $DIGEST_VALIDO2 despliegue"
[ "$CODIGO" = 2 ] && ok "espacios extra rechaza con 2" || mal "espacios extra rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "espacios extra no invoca desplegar" || mal "espacios extra invoca desplegar"

probar "$SHA_VALIDO	$DIGEST_VALIDO $DIGEST_VALIDO2 despliegue"
[ "$CODIGO" = 2 ] && ok "tabulaciones extra rechazan con 2" || mal "tabulaciones extra rechazan con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "tabulaciones extra no invocan desplegar" || mal "tabulaciones extra invocan desplegar"

# Metacaracteres de shell
for mc in ';' '|' '&' '$' '`' '>' '<' '(' ')' '"' "'"; do
  probar "${mc}$SHA_VALIDO $DIGEST_VALIDO $DIGEST_VALIDO2 despliegue"
  if [ "$CODIGO" = 2 ] && [ ! -s "$FAKE_LOG" ]; then
    ok "metacaracter '$mc' rechaza con 2 y no invoca"
  else
    mal "metacaracter '$mc' rechaza con 2 y no invoca" "codigo=$CODIGO log=$(cat "$FAKE_LOG")"
  fi
done

# --- 3. No se evalúa (no debe crear archivos marcadores) -------------------------------------
echo "3. Sin evaluación"
MARCADOR="$T/marcador-test"
rm -f "$MARCADOR"
probar "$SHA_VALIDO \$(touch $MARCADOR) $DIGEST_VALIDO2 despliegue"
[ ! -e "$MARCADOR" ] && ok "sustitución de comando no crea archivos" || mal "sustitución de comando crea archivos (se evaluó)"
[ "$CODIGO" = 2 ] && ok "pedido con sustitución rechaza con 2" || mal "pedido con sustitución rechaza con 2 (código $CODIGO)"
[ ! -s "$FAKE_LOG" ] && ok "sustitución no invoca desplegar" || mal "sustitución invoca desplegar"

echo
echo "Resultado: $PASO comprobaciones correctas, $FALLO con fallas."
[ "$FALLO" = 0 ]
