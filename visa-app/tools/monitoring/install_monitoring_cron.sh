#!/usr/bin/env bash
# Instala o actualiza una unica entrada en el crontab del usuario actual.
set -euo pipefail

if ! command -v dirname >/dev/null 2>&1; then
  printf 'ERROR: falta la herramienta requerida: dirname\n' >&2
  exit 2
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
job_script="$script_dir/run_monitoring_job.sh"
env_file="${MONITOR_ENV_FILE:-/etc/visaguide/monitoring.env}"
marker="# visaguide-server-monitoring"

if [[ "$env_file" != /* || "$env_file" == *%* || "$env_file" == *$'\n'* || "$job_script" == *%* || "$job_script" == *$'\n'* ]]; then
  printf 'ERROR: las rutas deben ser absolutas y no contener %% ni saltos de linea.\n' >&2
  exit 2
fi

quote_path() {
  local escaped="${1//\'/\'\\\'\'}"
  printf "'%s'" "$escaped"
}

cron_line="*/5 * * * * MONITOR_ENV_FILE=$(quote_path "$env_file") /bin/bash $(quote_path "$job_script") $marker"

if [[ "${DRY_RUN:-0}" == 1 ]]; then
  printf 'DRY_RUN: no se modifico el crontab. Entrada propuesta:\n%s\n' "$cron_line"
  exit 0
fi

for command_name in crontab mktemp awk grep rm; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'ERROR: falta la herramienta requerida: %s\n' "$command_name" >&2
    exit 2
  fi
done

if [[ ! -r "$env_file" ]]; then
  printf 'ERROR: cree MONITOR_ENV_FILE y otorgue lectura al usuario de cron.\n' >&2
  exit 2
fi

existing="$(mktemp)"
updated="$(mktemp)"
errors="$(mktemp)"
trap 'rm -f -- "$existing" "$updated" "$errors"' EXIT

if ! crontab -l > "$existing" 2> "$errors"; then
  if ! grep -qi 'no crontab\|sin crontab' "$errors"; then
    printf 'ERROR: no se pudo leer el crontab actual.\n' >&2
    exit 2
  fi
fi

awk -v marker="$marker" 'index($0, marker) == 0' "$existing" > "$updated"
printf '%s\n' "$cron_line" >> "$updated"
crontab "$updated"
printf 'Cron instalado: revision cada 5 minutos.\n'
