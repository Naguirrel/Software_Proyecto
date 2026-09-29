#!/usr/bin/env bash
# Punto de entrada de cron. La configuracion vive fuera del repositorio.
set -u

for command_name in dirname mkdir flock mktemp mv tail wc date rm; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'CRITICAL: falta la herramienta requerida: %s\n' "$command_name" >&2
    exit 2
  fi
done

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)" || exit 2
env_file="${MONITOR_ENV_FILE:-/etc/visaguide/monitoring.env}"
if [[ "$env_file" != /* || ! -r "$env_file" ]]; then
  printf 'CRITICAL: MONITOR_ENV_FILE debe ser una ruta absoluta legible.\n' >&2
  exit 2
fi

# El operador controla este archivo; nunca se imprime su contenido.
set -a
# shellcheck disable=SC1090
if ! source "$env_file"; then
  printf 'CRITICAL: no se pudo cargar MONITOR_ENV_FILE.\n' >&2
  exit 2
fi
set +a

log_file="${MONITOR_LOG_FILE:-/var/log/visaguide/server-monitoring.log}"
max_lines="${MONITOR_MAX_LOG_LINES:-2000}"
if [[ "$log_file" != /* || "$log_file" == *%* || "$log_file" == *$'\n'* || ! "$max_lines" =~ ^[0-9]+$ ]] ||
  (( max_lines < 100 || max_lines > 10000 )); then
  printf 'CRITICAL: MONITOR_LOG_FILE o MONITOR_MAX_LOG_LINES invalido.\n' >&2
  exit 2
fi

log_dir="$(dirname -- "$log_file")"
if ! mkdir -p -- "$log_dir"; then
  printf 'CRITICAL: no se pudo crear el directorio de logs.\n' >&2
  exit 2
fi

exec 9>"${log_file}.lock" || exit 2
if ! flock -n 9; then
  # Otra revision sigue en curso; no solapar escrituras ni correos.
  exit 0
fi

if output="$("$script_dir/monitor_server.sh" 2>&1)"; then
  result=0
else
  result=$?
fi

if ! printf '[%s] Ejecucion programada\n%s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')" "$output" >> "$log_file"; then
  printf 'CRITICAL: no se pudo escribir el log de monitoreo.\n' >&2
  exit 2
fi

if (( result != 0 )) && [[ -n "${ALERT_EMAIL:-}" ]]; then
  if [[ ! "$ALERT_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    printf 'WARNING: ALERT_EMAIL invalido; no se envio correo.\n' >> "$log_file"
  elif ! command -v mail >/dev/null 2>&1; then
    printf 'WARNING: falta mail; instale mailutils y configure un MTA o relay SMTP.\n' >> "$log_file"
  elif ! printf '%s\n' "$output" | mail -s 'VisaGuide: alerta del servidor' -- "$ALERT_EMAIL" >/dev/null 2>&1; then
    printf 'WARNING: fallo el envio de correo; revise el MTA.\n' >> "$log_file"
  fi
fi

if (( $(wc -l < "$log_file") > max_lines )); then
  temp_log="$(mktemp "${log_file}.XXXXXX")" || exit 2
  if tail -n "$max_lines" "$log_file" > "$temp_log" && mv -- "$temp_log" "$log_file"; then
    :
  else
    rm -f -- "$temp_log"
    printf 'CRITICAL: no se pudo limitar el log.\n' >&2
    exit 2
  fi
fi

exit "$result"
