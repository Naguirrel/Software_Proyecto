#!/usr/bin/env bash
# Ejecutar en el host Ubuntu para medir sus recursos, no dentro de un contenedor.
set -u

for command_name in curl df free awk date sleep; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'CRITICAL: falta la herramienta requerida: %s\n' "$command_name" >&2
    exit 2
  fi
done

monitor_url="${MONITOR_URL:-https://visa-app.duckdns.org}"
threshold="${MONITOR_THRESHOLD:-80}"
disk_path="${MONITOR_DISK_PATH:-/}"

if [[ ! "$threshold" =~ ^[0-9]+$ ]] || (( threshold > 100 )); then
  printf 'CRITICAL: MONITOR_THRESHOLD debe ser un entero entre 0 y 100.\n' >&2
  exit 2
fi

if [[ ! "$monitor_url" =~ ^https?:// ]] || [[ "${monitor_url#*://}" == *@* ]]; then
  printf 'CRITICAL: MONITOR_URL debe ser HTTP(S) y no incluir credenciales.\n' >&2
  exit 2
fi

overall=0
report() {
  local level="$1" severity="$2" message="$3"
  printf '%s: %s\n' "$level" "$message"
  if (( severity > overall )); then
    overall="$severity"
  fi
}

is_percent() {
  [[ "$1" =~ ^[0-9]+([.][0-9]+)?$ ]]
}

check_resource() {
  local name="$1" value="$2"
  if ! is_percent "$value"; then
    report CRITICAL 2 "no se pudo medir $name"
  elif awk -v value="$value" -v limit="$threshold" 'BEGIN { exit !(value > limit) }'; then
    report WARNING 1 "$name=${value}% supera el umbral de ${threshold}%"
  else
    report OK 0 "$name=${value}% (umbral ${threshold}%)"
  fi
}

printf '[%s] Revision del servidor\n' "$(date '+%Y-%m-%d %H:%M:%S %z')"

if http_result="$(curl --silent --location --max-redirs 5 --connect-timeout 5 --max-time 15 \
  --output /dev/null --write-out '%{http_code} %{time_total}' -- "$monitor_url" 2>/dev/null)"; then
  read -r http_code response_time <<< "$http_result"
  if [[ "$http_code" =~ ^[0-9]{3}$ ]] && (( 10#$http_code >= 200 && 10#$http_code < 400 )); then
    report OK 0 "aplicacion HTTP=$http_code tiempo=${response_time}s"
  else
    report CRITICAL 2 "aplicacion HTTP=${http_code:-000} tiempo=${response_time:-N/D}s"
  fi
else
  report CRITICAL 2 "aplicacion sin respuesta HTTP=000 tiempo=N/D"
fi

# Dos lecturas de /proc/stat separadas por un segundo dan uso real de CPU.
cpu_first="$(awk '$1 == "cpu" { total = 0; for (i = 2; i <= 9; i++) total += $i; printf "%.0f %.0f\n", total, $5 + $6; exit }' "${MONITOR_PROC_STAT_FILE:-/proc/stat}" 2>/dev/null)"
sleep 1
cpu_second="$(awk '$1 == "cpu" { total = 0; for (i = 2; i <= 9; i++) total += $i; printf "%.0f %.0f\n", total, $5 + $6; exit }' "${MONITOR_PROC_STAT_FILE:-/proc/stat}" 2>/dev/null)"
read -r total_first idle_first <<< "$cpu_first"
read -r total_second idle_second <<< "$cpu_second"
cpu_percent=""
if [[ "${total_first:-}" =~ ^[0-9]+$ && "${idle_first:-}" =~ ^[0-9]+$ && \
      "${total_second:-}" =~ ^[0-9]+$ && "${idle_second:-}" =~ ^[0-9]+$ ]]; then
  cpu_percent="$(awk -v t1="$total_first" -v i1="$idle_first" \
    -v t2="$total_second" -v i2="$idle_second" \
    'BEGIN { delta = t2 - t1; idle = i2 - i1; if (delta <= 0 || idle < 0 || idle > delta) exit 1; printf "%.1f", 100 * (delta - idle) / delta }')" || cpu_percent=""
fi
check_resource CPU "$cpu_percent"

# La memoria disponible incluye cache recuperable; evita alertas falsas por cache.
memory_percent="$(free -b 2>/dev/null | awk '$1 == "Mem:" { if (NF >= 7 && $2 > 0 && $7 >= 0) printf "%.1f", 100 * ($2 - $7) / $2; exit }')"
check_resource memoria "$memory_percent"

disk_percent="$(df -P "$disk_path" 2>/dev/null | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')"
check_resource disco "$disk_percent"

case "$overall" in
  0) printf 'ESTADO FINAL: OK\n' ;;
  1) printf 'ESTADO FINAL: WARNING\n' ;;
  *) printf 'ESTADO FINAL: CRITICAL\n' ;;
esac
exit "$overall"
