#!/usr/bin/env bash
#
# Control del certificado de producción (D2 de despliegue-continuo-ec2). Lo usa
# .github/workflows/certificado.yml todos los días.
#
#   verificar-certificado.sh <nombre> [días-mínimos]
#
# Se conecta a <nombre>:443 y termina en error si el certificado no es válido para ese nombre
# (cadena no confiable, vencido o de otro nombre) o si le quedan menos de [días-mínimos] días
# (21 por defecto). Caddy renueva a los 30 días del vencimiento: a los 21, la renovación ya
# falló al menos una vez.
set -euo pipefail

nombre="${1:-}"
dias_minimos="${2:-21}"

if ! [[ "$nombre" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]]; then
  echo "Nombre inválido: '$nombre'. Tiene que ser un nombre de dominio en minúsculas." >&2
  exit 2
fi
if ! [[ "$dias_minimos" =~ ^[0-9]+$ ]]; then
  echo "Días mínimos inválidos: '$dias_minimos'." >&2
  exit 2
fi

temporal="$(mktemp -d)"
trap 'rm -rf "$temporal"' EXIT

# -verify_return_error corta el handshake si la cadena o el nombre no verifican.
if ! timeout 30 openssl s_client -connect "$nombre:443" -servername "$nombre" \
  -verify_hostname "$nombre" -verify_return_error < /dev/null \
  > "$temporal/salida" 2> "$temporal/errores"; then
  motivo="$(grep -m1 -iE 'verify error|error|unable|timed out|no route|connection' "$temporal/errores" || echo 'sin detalle')"
  # Un fallo de red o de DNS no es un certificado inválido: el aviso no tiene que mandar a
  # revisar el certificado cuando el problema es que el sitio no responde.
  if grep -qiE 'verify error|certificate verify|hostname mismatch|self.signed|expired' "$temporal/errores"; then
    echo "El certificado de $nombre NO es válido: $motivo" >&2
  else
    echo "No se pudo verificar el certificado de $nombre: no hubo conexión TLS (puede ser la red, el DNS o que el sitio no esté respondiendo). Detalle: $motivo" >&2
  fi
  exit 1
fi

openssl x509 -noout < "$temporal/salida" > /dev/null 2>&1 || {
  echo "No se pudo leer el certificado de $nombre." >&2
  exit 1
}
vencimiento="$(openssl x509 -noout -enddate < "$temporal/salida" | cut -d= -f2)"
if ! openssl x509 -noout -checkend "$((dias_minimos * 86400))" < "$temporal/salida" > /dev/null; then
  echo "Al certificado de $nombre le quedan menos de $dias_minimos días: vence el $vencimiento. Revisar la renovación de Caddy (docs/despliegue.md)." >&2
  exit 1
fi

echo "Certificado de $nombre válido; vence el $vencimiento (quedan $dias_minimos días o más)."
