#!/usr/bin/env bash
#
# Comando forzado de la clave SSH del workflow de CD (.github/workflows/cd.yml, job
# `desplegar`). Es lo único que esa clave puede ejecutar en el servidor.
#
# El workflow se conecta con `ssh ... "<sha> <digestBackend> <digestFrontend> <modo>"`. Con un
# comando forzado, sshd ignora lo que el cliente pidió ejecutar y corre este script, dejando
# lo pedido en SSH_ORIGINAL_COMMAND. Acá se valida con expresiones regulares estrictas y,
# solo si todo es válido, se ejecuta deploy/desplegar.sh como root mediante `sudo`.
#
#   sha             SHA completo del commit de main (40 hexadecimales en minúscula).
#   digestBackend   sha256:<64 hex>, o `-` si no hay (vuelta atrás: se usan los del historial).
#   digestFrontend  ídem.
#   modo            `despliegue` o `vuelta-atras`.
#
# El marcador `-` existe porque un campo vacío no se puede distinguir de un espacio de más en
# una línea separada por espacios; acá se traduce a la cadena vacía que espera desplegar.sh.
#
# Códigos de salida: 2 si el pedido no es válido (no se ejecuta nada); si no, el de
# desplegar.sh (0 desplegado; 1 falló).
#
# --- Instalación en el servidor (docs/despliegue.md, §4) ------------------------------------
#
# 1. Usuario `deploy`, sin contraseña y sin pertenecer al grupo `docker` (el grupo docker
#    equivale a root). El repositorio y este script son de root: `deploy` puede ejecutarlo
#    pero no modificarlo.
#
# 2. ~deploy/.ssh/authorized_keys, una sola línea (clave pública de github-actions-deploy):
#
#      command="/opt/reservas/deploy/ssh-entrada.sh",restrict ssh-ed25519 AAAA... github-actions-deploy
#
#    `restrict` desactiva pty, reenvío de puertos, de agente y de X11.
#
# 3. /etc/sudoers.d/reservas-deploy (se edita con `sudo visudo -f`), una sola línea que permite
#    ese script y ningún otro comando:
#
#      deploy ALL=(root) NOPASSWD: /opt/reservas/deploy/desplegar.sh
#
#    sudo compara los argumentos solo si se indican; los valida este script antes de llegar acá.
#
# Prueba local sin servidor: RESERVAS_DESPLEGAR apunta a otro script (solo para pruebas; en
# el servidor no se define y `sudo` solo admite la ruta de arriba).

set -euo pipefail

DESPLEGAR="${RESERVAS_DESPLEGAR:-/opt/reservas/deploy/desplegar.sh}"

rechazar() {
  printf 'ssh-entrada: pedido rechazado: %s\n' "$1" >&2
  exit 2
}

pedido="${SSH_ORIGINAL_COMMAND:-}"
[ -n "$pedido" ] || rechazar "no llegó ningún pedido."

# Solo letras minúsculas, dígitos, `:`, `-` y espacios simples: ningún metacaracter de shell
# (; | & $ ` ( ) < > comillas, saltos de línea) puede pasar de acá. El resto de las
# comprobaciones son por campo.
if ! [[ "$pedido" =~ ^[a-z0-9:-]+\ [a-z0-9:-]+\ [a-z0-9:-]+\ [a-z-]+$ ]]; then
  rechazar "formato inválido (se esperan exactamente 4 campos separados por un espacio)."
fi

read -r sha digest_backend digest_frontend modo <<< "$pedido"

[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || rechazar "SHA inválido."
[[ "$digest_backend" =~ ^(sha256:[0-9a-f]{64}|-)$ ]] || rechazar "digest del backend inválido."
[[ "$digest_frontend" =~ ^(sha256:[0-9a-f]{64}|-)$ ]] || rechazar "digest del frontend inválido."
[[ "$modo" =~ ^(despliegue|vuelta-atras)$ ]] || rechazar "modo inválido."

[ "$digest_backend" != "-" ] || digest_backend=""
[ "$digest_frontend" != "-" ] || digest_frontend=""

if [ -n "${RESERVAS_DESPLEGAR:-}" ]; then
  exec "$DESPLEGAR" "$sha" "$digest_backend" "$digest_frontend" "$modo"
fi
exec sudo -n "$DESPLEGAR" "$sha" "$digest_backend" "$digest_frontend" "$modo"
